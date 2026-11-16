/** Shared, Node-testable helpers for the receptionist chat UI.
 *  Line reveal is a frontend presentation only — not model streaming.
 */

export const LINE_DELAY_MS = 320;
export const NEAR_BOTTOM_PX = 96;

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function splitRevealUnits(text) {
  const raw = String(text ?? '');
  if (!raw) return [];
  if (raw.includes('\n')) return raw.split('\n');
  const parts = raw.split(/(?<=[。！？!?])/).filter((s) => s !== '');
  return parts.length ? parts : [raw];
}

export function joinRevealUnits(units, count, source) {
  const slice = units.slice(0, count);
  if (String(source ?? '').includes('\n')) return slice.join('\n');
  return slice.join('');
}

export function isNearBottom(scrollTop, scrollHeight, clientHeight, threshold = NEAR_BOTTOM_PX) {
  return Number(scrollHeight) - Number(scrollTop) - Number(clientHeight) <= Number(threshold);
}

export function waitMs(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const err = new Error('aborted');
      err.name = 'AbortError';
      reject(err);
      return;
    }
    const timer = setTimeout(resolve, ms);
    if (!signal) return;
    const onAbort = () => {
      clearTimeout(timer);
      const err = new Error('aborted');
      err.name = 'AbortError';
      reject(err);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function createSkip() {
  let skipped = false;
  const listeners = new Set();
  return {
    skip() {
      if (skipped) return;
      skipped = true;
      for (const fn of listeners) fn();
    },
    get skipped() { return skipped; },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
}

export function createRunControl() {
  let id = 0;
  let controller = null;
  return {
    get id() { return id; },
    get signal() { return controller ? controller.signal : undefined; },
    start() {
      if (controller) controller.abort();
      id += 1;
      controller = new AbortController();
      return { id, signal: controller.signal };
    },
    abort() {
      if (controller) controller.abort();
    },
    isCurrent(runId) { return runId === id; }
  };
}

export async function revealText({
  el,
  text,
  reducedMotion = false,
  signal,
  skip,
  wait,
  onTick
} = {}) {
  const raw = String(text ?? '');
  if (!el) return { cancelled: false, complete: true, skipped: false };

  const finish = (extra = {}) => {
    el.textContent = raw;
    onTick && onTick({ done: true, skipped: !!extra.skipped });
    return { cancelled: false, complete: true, skipped: false, ...extra };
  };

  if (reducedMotion || skip?.skipped) return finish({ skipped: !!skip?.skipped });

  const units = splitRevealUnits(raw);
  if (units.length <= 1) return finish();

  const waitFn = wait || (() => waitMs(LINE_DELAY_MS, signal));

  for (let i = 0; i < units.length; i++) {
    if (signal?.aborted) return { cancelled: true, complete: false, skipped: false };
    if (skip?.skipped) return finish({ skipped: true });
    el.textContent = joinRevealUnits(units, i + 1, raw);
    onTick && onTick({ done: false, index: i + 1, total: units.length });
    if (i === units.length - 1) break;
    try {
      await waitOrSkip(waitFn, skip);
    } catch (err) {
      if (err && err.name === 'AbortError') {
        return { cancelled: true, complete: false, skipped: false };
      }
      if (err && err.name === 'SkipError') return finish({ skipped: true });
      throw err;
    }
  }
  return finish();
}

function waitOrSkip(waitFn, skip) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let unsub = null;
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      if (unsub) unsub();
      fn(value);
    };
    if (skip) {
      if (skip.skipped) {
        const err = new Error('skipped');
        err.name = 'SkipError';
        reject(err);
        return;
      }
      unsub = skip.subscribe(() => {
        const err = new Error('skipped');
        err.name = 'SkipError';
        settle(reject, err);
      });
    }
    Promise.resolve()
      .then(() => waitFn())
      .then((value) => settle(resolve, value))
      .catch((err) => settle(reject, err));
  });
}

export async function performChatRequest({ fetchFn, answerFn, payload, signal, endpoint } = {}) {
  try {
    if (signal?.aborted) return { ok: false, error: 'aborted', data: null };
    if (answerFn) {
      const data = await answerFn(payload || {});
      if (signal?.aborted) return { ok: false, error: 'aborted', data: null };
      if (!data || data.ok === false) return { ok: false, error: 'reply_failed', data: data || null };
      return { ok: true, error: null, data };
    }
    if (typeof fetchFn !== 'function') return { ok: false, error: 'network', data: null };
    const res = await fetchFn(endpoint || '', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
      signal
    });
    const data = await res.json();
    if (!data || data.ok === false) return { ok: false, error: 'reply_failed', data: data || null };
    return { ok: true, error: null, data };
  } catch (err) {
    if (err && err.name === 'AbortError') return { ok: false, error: 'aborted', data: null };
    return { ok: false, error: 'network', data: null };
  }
}

export function commitReplyContext(state, userMessage, reply) {
  const next = state || { history: [], itinerary: null };
  if (!next.history) next.history = [];
  if (reply && Object.prototype.hasOwnProperty.call(reply, 'itinerary') && reply.itinerary) {
    next.itinerary = reply.itinerary;
  }
  next.history.push(
    { role: 'user', content: userMessage },
    { role: 'assistant', content: (reply && reply.text) || '' }
  );
  if (next.history.length > 16) next.history = next.history.slice(-16);
  return next;
}

export function canAcceptSend(busy, message) {
  const msg = String(message || '').trim();
  if (!msg) return false;
  if (busy) return false;
  return true;
}

export function errorReply(kind) {
  if (kind === 'reply_failed') {
    return { text: '这次没有回答成功，请稍后再试，或换一种问法。', sources: [] };
  }
  return {
    text: '这次没有完成回答，请再试一次，或把问题说得更具体一些。',
    sources: []
  };
}
