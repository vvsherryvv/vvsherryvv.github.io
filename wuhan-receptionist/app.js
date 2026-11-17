import {
  escapeHtml,
  revealText,
  waitMs,
  isNearBottom,
  NEAR_BOTTOM_PX,
  LINE_DELAY_MS,
  createRunControl,
  createSkip,
  performChatRequest,
  commitReplyContext,
  canAcceptSend,
  errorReply,
  appendAnswerImages
} from './chat-ui.js';
import { reply as answerLocally } from './engine.js';
import { browserStore, loadProfile } from './profile.mjs';
import { mountTripSheet } from './trip-ui.mjs';

const $ = (id) => document.getElementById(id);

const state = {
  history: [],
  itinerary: null,
  profile: null,
  mode: 'local',
  busy: false
};

const STARTERS = [
  '介绍一下武汉',
  '智民里六站怎么走',
  '从智民里出发，安排一天行程',
  '数命SPU是什么',
  'SAIG比赛怎么安排'
];

const WELCOME = {
  text: '你好，我是城市AI接待员小熠。我可以介绍武汉和数命SPU社区，按兴趣生成短行程，也可以说明SPU理念与SAIG比赛。',
  suggestions: STARTERS
};

const runs = createRunControl();
let skip = createSkip();
let inFlightReveal = null;
let sessionTick = 0;
let followScroll = true;
let hintNeeded = false;

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isMobileGuide() {
  return window.matchMedia && window.matchMedia('(max-width: 860px)').matches;
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function setMode(info) {
  state.mode = (info && info.mode) || 'local';
}

function renderStarters(items = STARTERS) {
  const box = $('chips');
  if (!box) return;
  box.innerHTML = '';
  items.forEach((text) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = text;
    b.addEventListener('click', () => send(text));
    if (state.busy) b.disabled = true;
    box.appendChild(b);
  });
}

function itineraryCard(it) {
  if (!it) return '';
  const days = (it.days || []).map((d) => {
    const lis = (d.items || []).map((item) => {
      const flag = item.status && item.status !== '事实' ? `<span class="flag">${escapeHtml(item.status)}</span>` : '';
      return `<li><strong>${escapeHtml(item.name)}</strong>${flag} · ${escapeHtml(item.area)}<br>${escapeHtml(item.why)} ${escapeHtml(item.note || '')}</li>`;
    }).join('');
    return `<p><strong>${escapeHtml(d.title)}</strong></p><ol>${lis}</ol>`;
  }).join('');
  const party = it.partyNote ? `<p>${escapeHtml(it.partyNote)}</p>` : '';
  return `<div class="itinerary-card"><strong>${escapeHtml(it.theme)}</strong>${days}${party}<p>${escapeHtml(it.disclaimer || '')}</p></div>`;
}

function fillMeta(meta, payload) {
  if (!meta) return;
  meta.innerHTML = itineraryCard(payload.itinerary);
  appendAnswerImages(meta, payload.images);
  if (payload.suggestions && payload.suggestions.length) {
    const row = document.createElement('div');
    row.className = 'suggest-row';
    payload.suggestions.forEach((s) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'suggest';
      b.textContent = s;
      b.disabled = state.busy;
      b.addEventListener('click', () => send(s));
      row.appendChild(b);
    });
    meta.appendChild(row);
  }
}

function threadMetrics() {
  const node = $('thread');
  if (!node) return { scrollTop: 0, scrollHeight: 0, clientHeight: 0 };
  return {
    scrollTop: node.scrollTop,
    scrollHeight: node.scrollHeight,
    clientHeight: node.clientHeight
  };
}

function updateFollowFromScroll() {
  const m = threadMetrics();
  followScroll = isNearBottom(m.scrollTop, m.scrollHeight, m.clientHeight, NEAR_BOTTOM_PX);
  if (followScroll) {
    hintNeeded = false;
    setHintVisible(false);
  }
}

function setHintVisible(on) {
  const btn = $('newHint');
  if (!btn) return;
  btn.hidden = !on;
}

function scrollThreadToBottom() {
  const node = $('thread');
  if (!node) return;
  node.scrollTop = node.scrollHeight;
}

function maybeFollowScroll() {
  if (followScroll) {
    scrollThreadToBottom();
    hintNeeded = false;
    setHintVisible(false);
    return;
  }
  hintNeeded = true;
  setHintVisible(true);
}

function resumeFollow() {
  followScroll = true;
  hintNeeded = false;
  setHintVisible(false);
  scrollThreadToBottom();
}

function setBusyUI(busy) {
  state.busy = busy;
  const sendBtn = $('btnSend');
  if (sendBtn) sendBtn.disabled = busy;
  document.querySelectorAll('[data-send], .chip, .suggest').forEach((node) => {
    node.disabled = busy;
  });
  const desk = $('desk');
  if (desk) desk.classList.toggle('is-busy', busy);
  const input = $('input');
  if (input) input.setAttribute('aria-busy', busy ? 'true' : 'false');
}

function showLoading(on) {
  const existing = $('loadingRow');
  if (!on) {
    if (existing) existing.remove();
    return;
  }
  if (existing) return;
  const row = el('<div class="loading-row" id="loadingRow" role="status">正在整理回答…</div>');
  $('thread').appendChild(row);
  maybeFollowScroll();
}

function addUserMsg(text) {
  const wrap = document.createElement('article');
  wrap.className = 'msg user';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  wrap.appendChild(bubble);
  $('thread').appendChild(wrap);
}

async function addBotMessage(payload, { typewrite = true, run, instant = false } = {}) {
  const wrap = document.createElement('article');
  wrap.className = 'msg bot';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  wrap.appendChild(bubble);
  const meta = document.createElement('div');
  meta.className = 'meta';
  wrap.appendChild(meta);
  $('thread').appendChild(wrap);
  maybeFollowScroll();

  const reduced = prefersReducedMotion() || instant;
  if (typewrite && !reduced) wrap.classList.add('is-revealing');

  const task = revealText({
    el: bubble,
    text: payload.text || '',
    reducedMotion: reduced || !typewrite,
    signal: run && run.signal,
    skip,
    wait: () => waitMs(LINE_DELAY_MS, run && run.signal),
    onTick: () => maybeFollowScroll()
  });
  inFlightReveal = task;
  let result;
  try {
    result = await task;
  } finally {
    if (inFlightReveal === task) inFlightReveal = null;
    wrap.classList.remove('is-revealing');
  }

  if (result.cancelled || !wrap.isConnected) return result;
  if (run && !runs.isCurrent(run.id)) return result;
  fillMeta(meta, payload);
  maybeFollowScroll();
  return result;
}

async function settleReveal() {
  if (skip) skip.skip();
  if (inFlightReveal) {
    try { await inFlightReveal; } catch { /* ignore */ }
  }
}

async function welcome() {
  skip = createSkip();
  const run = runs.start();
  await addBotMessage(WELCOME, { typewrite: true, run });
}

function loadMode() {
  setMode({ mode: 'local' });
}

async function answerFromAgentOrLocal(payload, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch('/api/receptionist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
      signal: controller.signal
    });
    if (!res.ok) return answerLocally(payload);
    const data = await res.json();
    if (!data || data.ok === false || !data.reply) return answerLocally(payload);
    return data;
  } catch {
    return answerLocally(payload);
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

async function send(text) {
  const msg = String(text || '').trim();
  if (!canAcceptSend(state.busy, msg)) return;

  const tick = sessionTick;
  setBusyUI(true);
  await settleReveal();
  if (tick !== sessionTick) return;

  skip = createSkip();
  const run = runs.start();
  followScroll = true;
  setHintVisible(false);
  if (isMobileGuide()) setGuideOpen(false);

  addUserMsg(msg);
  const input = $('input');
  if (input) {
    input.value = '';
    autoSize(input);
  }
  maybeFollowScroll();
  showLoading(true);

  const result = await performChatRequest({
    answerFn: (payload) => answerFromAgentOrLocal(payload, run.signal),
    payload: {
      message: msg,
      history: state.history,
      itinerary: state.itinerary,
      profile: state.profile && !state.profile.skipped ? state.profile : null
    },
    signal: run.signal
  });

  if (!runs.isCurrent(run.id)) return;

  showLoading(false);

  if (result.error === 'aborted') {
    setBusyUI(false);
    return;
  }
  if (!result.ok) {
    await addBotMessage(errorReply(result.error), { typewrite: false, run, instant: true });
    if (runs.isCurrent(run.id)) {
      setBusyUI(false);
      focusComposerIfRoom();
    }
    return;
  }

  const data = result.data;
  if (data.modeLabel) setMode({ mode: data.mode, label: data.modeLabel });
  const reply = data.reply || { text: '', sources: [] };
  commitReplyContext(state, msg, reply);

  await addBotMessage(reply, { typewrite: true, run });

  if (runs.isCurrent(run.id)) {
    setBusyUI(false);
    focusComposerIfRoom();
  }
}

function autoSize(t) {
  t.style.height = 'auto';
  t.style.height = Math.min(t.scrollHeight, 140) + 'px';
}

async function reset() {
  sessionTick += 1;
  skip = createSkip();
  runs.start();
  inFlightReveal = null;
  showLoading(false);
  setBusyUI(false);
  state.history = [];
  state.itinerary = null;
  followScroll = true;
  hintNeeded = false;
  setHintVisible(false);
  $('thread').innerHTML = '';
  welcome();
}

function setGuideOpen(open) {
  const guide = $('guide');
  const backdrop = $('guideBackdrop');
  const btn = $('btnGuide');
  if (!guide) return;
  guide.classList.toggle('is-open', open);
  if (backdrop) {
    backdrop.classList.toggle('is-open', open);
    backdrop.hidden = !open;
  }
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function bindSenders() {
  document.querySelectorAll('[data-send]').forEach((node) => {
    node.addEventListener('click', () => send(node.getAttribute('data-send')));
  });
}

const tripRoot = $('trip');
if (tripRoot) {
  mountTripSheet(tripRoot, {
    store: browserStore(),
    onChange(profile) { state.profile = profile; },
    onPlan(text) { send(text); }
  });
}

$('btnSend').addEventListener('click', () => send($('input').value));
$('input').addEventListener('input', (e) => autoSize(e.target));
$('input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send($('input').value);
  }
});
$('btnReset').addEventListener('click', () => { reset(); });
$('thread').addEventListener('scroll', updateFollowFromScroll, { passive: true });
$('newHint').addEventListener('click', resumeFollow);

$('btnGuide').addEventListener('click', () => {
  const open = !$('guide').classList.contains('is-open');
  setGuideOpen(open);
});
$('guideBackdrop').addEventListener('click', () => setGuideOpen(false));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setGuideOpen(false);
});

function composerMayTakeFocus() {
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  return !coarse && height >= 780;
}

function focusComposerIfRoom() {
  const input = $('input');
  if (!input || !composerMayTakeFocus()) return;
  input.focus({ preventScroll: true });
}

function pinShell() {
  const shell = document.querySelector('.shell');
  const vv = window.visualViewport;
  const height = Math.round(Math.min(window.innerHeight, vv ? vv.height : window.innerHeight));
  const top = vv && vv.height <= window.innerHeight + 1 ? Math.round(vv.offsetTop) : 0;
  if (!shell) return;
  shell.style.height = `${height}px`;
  shell.style.top = `${top}px`;
  const guide = document.querySelector('.guide');
  if (guide && window.matchMedia('(max-width: 860px)').matches) {
    guide.style.height = `${height}px`;
    guide.style.top = `${top}px`;
  }
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', pinShell);
  window.visualViewport.addEventListener('scroll', pinShell);
}
window.addEventListener('resize', pinShell);
window.addEventListener('orientationchange', () => { setTimeout(pinShell, 60); });
pinShell();

bindSenders();
welcome();
loadMode();
focusComposerIfRoom();
