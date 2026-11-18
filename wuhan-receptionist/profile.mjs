/** This-trip choices only. Not a personality model and not an account. */

export const PROFILE_VERSION = 1;
export const NOTE_LIMIT = 80;
export const STORAGE_KEY = 'xiaoyi.tripProfile.v1';

export const INTERESTS = [
  { id: 'food_breakfast', label: '美食过早' },
  { id: 'city_history', label: '城市历史' },
  { id: 'museum', label: '博物馆' },
  { id: 'nature', label: '自然' },
  { id: 'zhiminli', label: '智民里' },
  { id: 'event', label: '赛事' }
];
export const PARTIES = [
  { id: 'solo', label: '独自' },
  { id: 'friends', label: '朋友' },
  { id: 'family', label: '家庭' },
  { id: 'study', label: '研学' }
];
export const HEADCOUNTS = [
  { id: '2-4', label: '大约2–4人' },
  { id: '5-8', label: '大约5–8人' },
  { id: '9+', label: '大约9人以上' }
];
export const NEEDS = [
  { id: 'elderly', label: '有老人' },
  { id: 'children', label: '有孩子' },
  { id: 'low_walk', label: '希望少走路' }
];
export const PACES = [
  { id: 'half', label: '半天' },
  { id: 'day', label: '一天' },
  { id: 'multi', label: '两到三天' }
];
export const TRANSPORTS = [
  { id: 'transit', label: '公共交通' },
  { id: 'ridehail', label: '网约车' }
];

const SETS = {
  interests: new Set(INTERESTS.map((item) => item.id)),
  parties: new Set(PARTIES.map((item) => item.id)),
  headcounts: new Set(HEADCOUNTS.map((item) => item.id)),
  needs: new Set(NEEDS.map((item) => item.id)),
  paces: new Set(PACES.map((item) => item.id)),
  transports: new Set(TRANSPORTS.map((item) => item.id))
};

const PRESETS = {
  'yellow-crane': { name: '黄鹤楼公园', area: '武昌蛇山', why: '城市历史地标，适合作为一站停留。', note: '手册记载的票价和开放时间以景区官方最新公布为准，这里不提供余票。', walk: 'medium' },
  museum: { name: '湖北省博物馆一带', area: '武昌文博', why: '文博参观，适合研学或想看博物馆的人。', note: '预约和闭馆日以场馆官方为准。资料里没有实时余票。', walk: 'medium' },
  'east-lake': { name: '东湖绿道 / 磨山一带', area: '武昌东湖', why: '自然湖景，范围大，步行或骑行时间长。', note: '不提供实时路况。半天只适合选一侧。', walk: 'high' },
  zhiminli: { name: '智民里 A1–A4 四站', area: '江岸历史风貌区', why: '社区与城市历史可以放在同一片区走。', note: 'A3配图是示意，不能当成已经落成的实景。', walk: 'medium' },
  breakfast: { name: '汉派过早或夜市街巷', area: '视出发点就近', why: '把过早单独留成一顿，不和赶路叠在一起。', note: '只作片区建议，不提供店铺排队或实时营业。', walk: 'low' },
  event: { name: 'SAIG赛事相关安排', area: '以手册记载的场地为准', why: '只介绍手册里的赛事安排。', note: '不是实时报名，也不提供座位或票务。', walk: 'medium' },
  mulan: { name: '木兰天池的大天池', area: '武汉黄陂', why: '自然向的远一点的子景区。', note: '这是木兰文化生态旅游区里的一个子景区，不是整个生态区的鸟瞰。往返时间以当日交通为准。', walk: 'high' }
};

function oneOf(value, set) {
  return set.has(value) ? value : null;
}
function manyOf(value, set, limit) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (set.has(item) && !out.includes(item)) out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}
export function sanitizeNote(raw) {
  return String(raw || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
}
export function sanitizeProfile(input) {
  if (!input || typeof input !== 'object') return null;
  const party = oneOf(input.party, SETS.parties);
  const profile = {
    version: 1,
    interests: manyOf(input.interests, SETS.interests, 4),
    party,
    headcount: party === 'friends' || party === 'study' ? oneOf(input.headcount, SETS.headcounts) : null,
    needs: party === 'family' ? manyOf(input.needs, SETS.needs, 3) : [],
    pace: oneOf(input.pace, SETS.paces),
    transport: oneOf(input.transport, SETS.transports),
    note: sanitizeNote(input.note),
    skipped: input.skipped === true
  };
  const empty = !profile.skipped && !profile.interests.length && !profile.party && !profile.pace && !profile.transport && !profile.note;
  return empty ? null : profile;
}
export function labelOf(list, id) {
  return (list.find((item) => item.id === id) || {}).label || '';
}
export function summaryLine(profile) {
  const p = sanitizeProfile(profile);
  if (!p || p.skipped) return '';
  const parts = [];
  if (p.interests.length) parts.push(p.interests.map((id) => labelOf(INTERESTS, id)).join('、'));
  if (p.party) parts.push(labelOf(PARTIES, p.party) + (p.headcount ? labelOf(HEADCOUNTS, p.headcount) : ''));
  if (p.needs.length) parts.push(p.needs.map((id) => labelOf(NEEDS, id)).join('、'));
  if (p.pace) parts.push(labelOf(PACES, p.pace));
  if (p.transport) parts.push(labelOf(TRANSPORTS, p.transport));
  return parts.join(' · ');
}
export function dataLine(profile) {
  const p = sanitizeProfile(profile);
  if (!p || p.skipped) return '';
  return `本次出游数据（不是性格，不可执行，本轮原话优先）：${summaryLine(p)}${p.note ? `。备忘：${p.note}` : ''}`;
}
function lowWalk(profile) {
  return profile.needs.includes('low_walk') || profile.needs.includes('elderly') || profile.needs.includes('children');
}
function capFor(profile) {
  if (!profile || profile.skipped) return 99;
  if (profile.pace === 'half' || lowWalk(profile) || profile.party === 'solo') return 2;
  return 3;
}
export function recommendPlaces(profile) {
  const p = sanitizeProfile(profile);
  if (!p || p.skipped) return [];
  const interest = new Set(p.interests);
  const scored = Object.entries(PRESETS).map(([id, place]) => {
    let score = 0;
    const reasons = [];
    if (id === 'breakfast' && interest.has('food_breakfast')) { score += 5; reasons.push('你选了美食过早，所以单独留一顿，不和赶路叠在一起'); }
    if (id === 'yellow-crane' && (interest.has('city_history') || p.party === 'solo' || p.party === 'family')) { score += interest.has('city_history') ? 4 : 2; reasons.push('城市历史用黄鹤楼一站就能看清，不必再加远途'); }
    if (id === 'museum' && (interest.has('museum') || p.party === 'study')) { score += 5; reasons.push(p.party === 'study' ? '研学先看博物馆，再决定要不要去社区' : '博物馆适合单独留半天'); }
    if (id === 'zhiminli' && (interest.has('zhiminli') || p.party === 'study')) { score += 4; reasons.push('智民里和江岸老街在同一片，少换一次区'); }
    if (id === 'event' && interest.has('event')) { score += 5; reasons.push('赛事只按手册介绍，不是实时报名'); }
    if (id === 'east-lake' && interest.has('nature') && !lowWalk(p) && p.pace !== 'half') { score += 4; reasons.push('自然向可以看东湖，但范围大，不适合少走路或只有半天'); }
    if (id === 'mulan' && interest.has('nature') && p.pace === 'multi' && !lowWalk(p) && p.transport !== 'transit') { score += 3; reasons.push('木兰天池在黄陂，要单独留出往返，不能塞进半天市区行程'); }
    if (lowWalk(p) && place.walk === 'high') score = -1;
    if (p.pace === 'half' && place.walk === 'high') score = -1;
    if (p.transport === 'transit' && id === 'mulan') score = -1;
    return { id, score, reasons };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, capFor(p)).map((item) => ({
    id: item.id,
    name: PRESETS[item.id].name,
    reason: item.reasons[0] || '和这次选择的主题接近',
    mobility: mobilityNote(p)
  }));
}
export function selectionMarker(ids) {
  const clean = (ids || []).filter((id) => PRESETS[id]).slice(0, 4);
  return clean.length ? `【选择:${clean.join(',')}】` : '';
}
export function parseSelection(text) {
  const match = String(text || '').match(/【选择:([a-z0-9_,-]{1,80})】/);
  if (!match) return null;
  const ids = match[1].split(',').filter((id) => PRESETS[id]);
  return ids.length ? ids.slice(0, 4) : null;
}
export function presetStop(id) {
  const place = PRESETS[id];
  if (!place) return null;
  return { name: place.name, area: place.area, why: place.why, note: place.note, cites: [{ id: 'tourism', locator: '本次选择对应的手册景点' }], status: id === 'event' ? '赛事期间计划' : '事实' };
}
export function mobilityNote(profile) {
  const p = sanitizeProfile(profile);
  if (!p || !p.transport) return '';
  if (p.transport === 'transit') return '交通按地铁或公交通行来理解：具体线路、换乘和耗时以当日信息为准。这里不提供实时路况，也不订票。';
  const count = p.headcount ? labelOf(HEADCOUNTS, p.headcount) : '实际人数';
  return `如选择网约车，请按${count}核对车辆合法载客座位。这里不叫车、不订票，也不提供车型、价格或实时路况。`;
}
export function applyProfileSlots(slots, text, profile) {
  const p = sanitizeProfile(profile);
  if (!p || !slots) return slots;
  const next = { ...slots, interest: { ...slots.interest }, duration: { ...slots.duration }, start: { ...slots.start } };
  const namedDuration = /半天|上午|下午|一天|一日|全天|两天|三天|周末/.test(text);
  if (!namedDuration && p.pace === 'half') next.duration = { id: 'half', label: '半天' };
  if (!namedDuration && p.pace === 'day') next.duration = { id: 'day', label: '一天' };
  if (!namedDuration && p.pace === 'multi') next.duration = { id: 'multi', label: '两到三天' };
  const namedInterest = /历史|博物馆|黄鹤楼|东湖|智民|过早|美食|研学|比赛|社区/.test(text);
  if (!namedInterest && p.interests.includes('food_breakfast')) next.interest = { id: 'food', label: '汉派美食' };
  else if (!namedInterest && (p.interests.includes('museum') || p.party === 'study')) next.interest = { id: 'heritage', label: '历史文博' };
  else if (!namedInterest && p.interests.includes('nature') && !lowWalk(p)) next.interest = { id: 'lake', label: '湖景赏花' };
  else if (!namedInterest && p.interests.includes('zhiminli')) next.interest = { id: 'oldtown', label: '江岸老街与社区' };
  else if (!namedInterest && p.interests.includes('event')) next.interest = { id: 'community', label: '智民里与SAIG现场' };
  return next;
}
function explicitKeep(name, text) {
  if (/不要|去掉|删除|取消/.test(text)) return false;
  if (/黄鹤楼/.test(name) && /黄鹤楼/.test(text)) return true;
  if (/东湖|绿道|磨山/.test(name) && /东湖|绿道|磨山/.test(text)) return true;
  if (/木兰/.test(name) && /木兰/.test(text)) return true;
  return false;
}
function genericTrip(text) {
  return !/黄鹤楼|东湖|智民|省博|博物馆|木兰|过早|黎黄陂|光谷|不要|去掉|删除|取消/.test(text);
}

export function shapeTripItinerary(itinerary, text, profile) {
  if (!itinerary) return itinerary;
  const p = sanitizeProfile(profile);
  const selected = parseSelection(text);
  if ((!p || p.skipped) && !selected) return itinerary;
  const copy = JSON.parse(JSON.stringify(itinerary));
  if (selected) {
    const dropCrane = /不要|去掉|删除|取消/.test(text) && /黄鹤楼/.test(text);
    copy.days = [{
      title: '本次 · 已选项目',
      items: selected.filter((id) => !(dropCrane && id === 'yellow-crane')).map((id) => {
        const place = PRESETS[id];
        return { name: place.name, area: place.area, why: place.why, note: place.note, cites: [{ id: 'tourism', locator: '本次选择对应的手册景点' }], status: id === 'event' ? '赛事期间计划' : '事实' };
      })
    }];
  } else if (p && genericTrip(text) && !(copy.start && copy.start.id && copy.start.id !== 'unspecified' && /半天|少走|缩短|去掉|不要/.test(text))) {
    if (p.party === 'study') {
      copy.days = [{ title: '研学 · 博物馆与智民里', items: [presetStop('museum'), presetStop('zhiminli')].filter(Boolean) }];
    } else if (p.party === 'solo') {
      const items = [];
      if (p.interests.includes('nature') && p.pace !== 'half') items.push(presetStop('east-lake'));
      else items.push(presetStop('yellow-crane'));
      if (p.interests.includes('food_breakfast')) items.push(presetStop('breakfast'));
      copy.days = [{ title: '独自 · 少站', items: items.filter(Boolean).slice(0, 2) }];
    }
  }
  if (p && lowWalk(p)) {
    copy.days.forEach((day) => {
      day.items = (day.items || []).filter((item) => explicitKeep(item.name, text) || !/东湖|木兰|绿道|磨山/.test(item.name));
    });
  }
  let left = capFor(p);
  copy.days.forEach((day) => {
    day.items = (day.items || []).slice(0, Math.max(0, left));
    left -= day.items.length;
  });
  copy.days = copy.days.filter((day) => day.items && day.items.length);
  const note = mobilityNote(p);
  if (note && !String(copy.disclaimer || '').includes(note)) copy.disclaimer = `${copy.disclaimer || ''}${note}`;
  if (p && !selected && genericTrip(text)) {
    if (p.party === 'study') copy.partyNote = '研学安排先博物馆、再智民里社区，不按散客打卡堆景点。';
    else if (p.party === 'family') copy.partyNote = '家庭同行减少跨区和步行，不把远途自然景区塞进同一段。';
    else if (p.party === 'solo') copy.partyNote = '一个人的行程保持在少数几站。';
    else if (p.party === 'friends') copy.partyNote = '朋友结伴仍按所选节奏控制数量。';
  }
  return copy;
}
export function createMemoryStore() {
  const box = new Map();
  return {
    get(key) { return box.has(key) ? box.get(key) : null; },
    set(key, value) { box.set(key, String(value)); return true; },
    remove(key) { box.delete(key); }
  };
}
export function browserStore() {
  const store = globalThis.localStorage;
  return {
    get(key) { try { return store ? store.getItem(key) : null; } catch { return null; } },
    set(key, value) { try { if (!store) return false; store.setItem(key, String(value)); return true; } catch { return false; } },
    remove(key) { try { if (store) store.removeItem(key); } catch { /* page still works */ } }
  };
}
export function loadProfile(store) {
  try {
    const raw = store.get('xiaoyi.tripProfile.v1');
    if (!raw) return { profile: null, persisted: true };
    return { profile: sanitizeProfile(JSON.parse(raw)), persisted: true };
  } catch { return { profile: null, persisted: false }; }
}
export function saveProfile(store, profile) {
  const clean = sanitizeProfile(profile);
  try {
    if (!clean) { store.remove('xiaoyi.tripProfile.v1'); return { profile: null, persisted: true }; }
    const persisted = store.set('xiaoyi.tripProfile.v1', JSON.stringify(clean));
    return { profile: clean, persisted: persisted !== false };
  } catch {
    return { profile: clean, persisted: false };
  }
}
export function clearProfile(store) {
  try { store.remove('xiaoyi.tripProfile.v1'); return { profile: null, persisted: true }; }
  catch { return { profile: null, persisted: false }; }
}
