import { runAgent, takeToken } from '../wuhan-receptionist/agent.mjs';

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };

function clientIp(req) {
  const forwarded = req.headers && (req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For']);
  return String(forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0].trim().slice(0, 80);
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32_000) {
      const error = new Error('too_large');
      error.code = 'too_large';
      throw error;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method' });
    return;
  }
  const ip = clientIp(req);
  let body = {};
  try {
    body = await readBody(req);
  } catch {
    res.status(400).json({ ok: false, error: 'bad_json' });
    return;
  }
  if (!takeToken(ip)) {
    const limited = await runAgent({
      message: body.message,
      history: body.history,
      itinerary: body.itinerary,
      profile: body.profile
    }, { env: {} });
    res.status(200).json({ ...limited, fallback: 'rate_limit' });
    return;
  }
  const result = await runAgent({
    message: body.message,
    history: body.history,
    itinerary: body.itinerary,
    profile: body.profile
  }, { env: process.env });
  res.status(200).json(result);
}
