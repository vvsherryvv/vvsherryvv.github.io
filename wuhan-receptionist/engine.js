import knowledge from './knowledge.js';
import { applyProfileSlots, sanitizeProfile, shapeTripItinerary } from './profile.mjs';

export const MAX_MESSAGE_LEN = 2000;
export const MAX_HISTORY = 16;

const INTERESTS = [
  { id: 'heritage', label: '历史文博', keys: /历史|文博|博物馆|黄鹤楼|古迹|文物|省博/ },
  { id: 'lake', label: '湖景赏花', keys: /东湖|赏花|樱花|梅花|湖|绿道|磨山/ },
  { id: 'oldtown', label: '江岸老街与社区', keys: /江岸|智民|黎黄陂|老街|风貌|里分|汉口漫游|citywalk/i },
  { id: 'food', label: '汉派美食', keys: /美食|过早|吃|小吃|宵夜|户部巷|吉庆/ },
  { id: 'tech', label: '科技研学', keys: /科技|光谷|研学|科创|大学/ },
  { id: 'community', label: '智民里与SAIG现场', keys: /社区|spu|saig|比赛|接待|六站/i }
];

const DURATIONS = [
  { id: 'half', label: '半天', keys: /半天|上午|下午|三小时|4小时|四个小时|半日/ },
  { id: 'day', label: '一天', keys: /一天|一日|全天|24小时|一整天/ },
  { id: 'multi', label: '两到三天', keys: /两天|两日|三日|三天|两到三|周末|2天|3天/ }
];

const STARTS = [
  { id: 'jiangan', label: '江岸 / 智民里一带', keys: /智民|江岸|黎黄陂|汉口|大智门|江汉/ },
  { id: 'wuchang', label: '武昌 / 黄鹤楼一带', keys: /武昌|黄鹤楼|蛇山|长江大桥|司门口/ },
  { id: 'eastlake', label: '东湖 / 光谷一带', keys: /东湖|光谷|磨山|鲁磨|省博/ },
  { id: 'unspecified', label: '未指定出发点', keys: /.*/ }
];

export function sanitizeInput(raw) {
  if (raw == null) return '';
  let s = String(raw);
  if (s.length > MAX_MESSAGE_LEN) s = s.slice(0, MAX_MESSAGE_LEN);
  // neutralize tag injection in stored text; output is escaped in UI anyway
  s = s.replace(/\u0000/g, '').trim();
  return s;
}

export function detectMode() {
  return {
    mode: 'local',
    modelConfigured: false,
    modelName: null,
    label: 'local'
  };
}

function normalize(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '');
}

function scoreChunk(chunk, q) {
  const nq = normalize(q);
  let score = 0;
  const title = normalize(chunk.title);
  if (title && nq.includes(title)) score += 8;
  for (const t of chunk.tags) {
    if (nq.includes(String(t).toLowerCase())) score += 4;
  }
  const text = chunk.title + chunk.text;
  const keys = nq.length > 40 ? nq.slice(0, 40) : nq;
  // character bigrams for Chinese
  const grams = new Set();
  for (let i = 0; i < keys.length - 1; i++) grams.add(keys.slice(i, i + 2));
  let hits = 0;
  for (const g of grams) if (g.trim() && text.includes(g)) hits++;
  score += Math.min(12, hits);
  return score;
}

export function retrieve(query, limit = 6) {
  const scored = knowledge.chunks
    .map((c) => ({ c, s: scoreChunk(c, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit);
  return scored.map((x) => x.c);
}

function matchOne(list, text, fallback = null) {
  for (const item of list) {
    if (item.id === 'unspecified') continue;
    if (item.keys.test(text)) return item;
  }
  return fallback || list[list.length - 1];
}

export function parseItinerarySlots(text, prev = null) {
  const interest = matchOne(INTERESTS, text, prev?.interest || INTERESTS[0]);
  const duration = matchOne(DURATIONS, text, prev?.duration || DURATIONS[1]);
  const start = matchOne(STARTS, text, prev?.start || STARTS[3]);
  // if previous exists and message looks like a tweak, keep unspecified start unless mentioned
  let nextStart = start;
  if (prev && !STARTS.filter((s) => s.id !== 'unspecified').some((s) => s.keys.test(text))) {
    nextStart = prev.start;
  }
  if (prev && !DURATIONS.some((d) => d.keys.test(text))) {
    // keep duration unless mentioned
  }
  return {
    interest: INTERESTS.some((i) => i.keys.test(text)) ? interest : (prev?.interest || interest),
    duration: DURATIONS.some((d) => d.keys.test(text)) ? duration : (prev?.duration || duration),
    start: nextStart
  };
}

function withoutDrops(text) {
  return String(text || '').replace(/(?:不要|去掉|删除|取消|别去)[^，。,.]{0,16}/g, ' ');
}

function placeIn(raw) {
  const text = withoutDrops(raw);
  if (/光谷/.test(text)) return { interest: INTERESTS.find((item) => item.id === 'tech'), start: STARTS.find((item) => item.id === 'eastlake') };
  if (/东湖|磨山|绿道/.test(text)) return { interest: INTERESTS.find((item) => item.id === 'lake'), start: STARTS.find((item) => item.id === 'eastlake') };
  if (/黄鹤楼|蛇山/.test(text)) return { interest: INTERESTS.find((item) => item.id === 'heritage'), start: STARTS.find((item) => item.id === 'wuchang') };
  if (/智民|六站|黎黄陂|巴公|江岸/.test(text)) return { interest: INTERESTS.find((item) => item.id === 'oldtown'), start: STARTS.find((item) => item.id === 'jiangan') };
  if (/武昌/.test(text)) return { interest: INTERESTS.find((item) => item.id === 'heritage'), start: STARTS.find((item) => item.id === 'wuchang') };
  return null;
}

export function inferPlace(history) {
  const turns = (Array.isArray(history) ? history : []).filter((item) => !item || item.role !== 'assistant');
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const found = placeIn(turns[i] && turns[i].content);
    if (found && found.interest && found.start) return found;
  }
  return null;
}

export function resolveSlots(text, history, itinerary, profile) {
  const current = placeIn(text);
  const inherited = inferPlace(history);
  const prev = itinerary
    ? { interest: itinerary.interest, duration: itinerary.duration, start: itinerary.start }
    : (current || inherited);
  const slots = applyProfileSlots(parseItinerarySlots(text, prev), text, profile);
  const anchor = current || ((!itinerary && inherited) ? inherited : null);
  if (itinerary && !current) {
    slots.interest = itinerary.interest;
    slots.start = itinerary.start;
  } else if (anchor) {
    slots.interest = anchor.interest;
    slots.start = anchor.start;
  }
  return slots;
}

function stop(name, area, why, note, cites, status = '事实') {
  return { name, area, why, note, cites, status };
}

function buildItinerary(slots) {
  const { interest, duration, start } = slots;
  const t = (locator) => [{ id: 'tourism', locator }];
  const h = (locator) => [{ id: 'handbook', locator }];
  const zhimin = [
    stop('智民里 A1–A4 四站', '江岸历史风貌区', '先走社区内部：A1展厅与三楼智能体咨询、A4·A5教室直播间、A3路演与共享空间（图为示意）、A2场景博物馆。', '按六站顺序走，巴公房子不在本段。', h('第2、9–12页')),
    stop('黎黄陂路历史街区', '江岸', '国家级旅游休闲街区，可与智民里步行衔接。', '手册中的AI集市、OPC摊位是SAIG那三天的计划，日常按老街漫步理解，不要说成已经摆满摊位。', h('第16页'), '赛事期间计划')
  ];
  const crane = [
    stop('黄鹤楼公园', '武昌蛇山', '武汉最经典的地标，登楼可看两江三镇。', '手册记载门票70元/人（优惠以官方为准），开放约08:30–18:00，冬季可能调整。不提供即时余票。', t('PDF第6–7页'))
  ];
  const lake = [
    stop('东湖绿道 / 磨山一带', '武昌东湖', '城中湖骑行或步行，可按季节看樱、梅或湖景。', '范围较大，半天只选听涛或磨山一侧，以免赶路。收费与开放以景区官方为准。', t('PDF第8–9页，四季赏花自PDF第40页'))
  ];
  const museum = [
    stop('湖北省博物馆一带', '东湖附近', '手册文博章节的重点场馆，适合安排半天。', '预约、闭馆日以场馆官方为准。', t('PDF第14页起「文博场馆」'))
  ];
  const food = [
    stop('汉派过早或夜市街巷', '视出发点就近', '可在吉庆街、户部巷、粮道街或汉口漫游沿线解决一餐。', '只作片区建议，不推荐具体排队店铺，不提供实时营业信息。', t('PDF第160页起；序言PDF第5页；汉口漫游约PDF第201页'))
  ];
  const guguang = [
    stop('光谷 / 科技研学片区', '东湖高新区', '可结合手册「科技研学」章节做参观向行程。', '数命SPU社区在光谷创新天地另有场地，手册未做内部导览，不宜虚构路线。', t('PDF第130页起'), '需结合官方信息')
  ];

  let days = [];
  const idur = duration.id;
  const iint = interest.id;
  const istart = start.id;

  const communityFirst = istart === 'jiangan' || iint === 'community' || iint === 'oldtown';

  if (idur === 'half') {
    if (iint === 'lake' && istart !== 'jiangan') {
      days = [{ title: '半天 · 东湖', items: [...lake, ...food.slice(0, 0)] }];
    } else if (iint === 'heritage' && !communityFirst) {
      days = [{ title: '半天 · 武昌地标', items: [...crane] }];
    } else if (iint === 'food' && istart === 'wuchang') {
      days = [{ title: '半天 · 黄鹤楼与就近用餐', items: [...crane, ...food] }];
    } else if (iint === 'tech') {
      days = [{ title: '半天 · 东湖或光谷方向', items: istart === 'wuchang' ? [...crane] : [...guguang] }];
    } else {
      days = [{ title: '半天 · 江岸智民里与老街', items: [...zhimin] }];
    }
  } else if (idur === 'day') {
    if (communityFirst && (iint === 'community' || iint === 'oldtown' || iint === 'food')) {
      days = [{ title: '一天 · 江岸社区与汉口漫游', items: [...zhimin, ...food] }];
    } else if (iint === 'lake') {
      days = [{ title: '一天 · 黄鹤楼与东湖', items: [...crane, ...lake] }];
    } else if (iint === 'tech') {
      days = [{ title: '一天 · 文博与科技片区', items: [...museum, ...guguang] }];
    } else if (iint === 'food') {
      days = [{ title: '一天 · 地标与美食街巷', items: [...crane, ...food, ...zhimin.slice(1)] }];
    } else {
      // heritage default
      if (istart === 'jiangan') {
        days = [{ title: '一天 · 先江岸再武昌地标', items: [...zhimin, ...crane] }];
      } else {
        days = [{ title: '一天 · 黄鹤楼与省博', items: [...crane, ...museum] }];
      }
    }
  } else {
    // multi
    days = [
      { title: '第一天 · 武昌江湖印象', items: [...crane, ...lake] },
      { title: '第二天 · 江岸社区与汉口', items: [...zhimin, ...food] }
    ];
    if (iint === 'heritage') {
      days[0] = { title: '第一天 · 黄鹤楼与文博', items: [...crane, ...museum] };
    }
    if (iint === 'tech') {
      days.push({ title: '第三天可选 · 科技研学', items: [...guguang] });
    } else if (iint === 'lake') {
      days[0] = { title: '第一天 · 东湖与黄鹤楼', items: [...lake, ...crane] };
    } else {
      days.push({ title: '第三天可选 · 黄陂木兰山水', items: [
        stop('黄陂木兰文化生态旅游区', '黄陂', '山水与木兰主题，适合用一整天，不必硬塞进城中日程。', '需预留往返时间，本接待员不提供实时交通。', t('PDF第10–11页'))
      ] });
    }
  }

  const disclaimer = '行程依据《2026武汉旅游产品手册》和《智民里参访手册》整理，是结构化建议，不是实时订票或导航。门票、开放时间和交通请以各单位官方最新信息为准。涉及赛事集市、巴公房子等，已按手册标明计划或筹备状态。';

  return {
    theme: `${duration.label} · ${interest.label} · 从${start.label}出发`,
    interest,
    duration,
    start,
    days,
    disclaimer,
    sourcesIntro: '主要依据见各站备注中的页码。'
  };
}

function applyWalkLimits(itinerary, text) {
  if (!itinerary) return itinerary;
  if (/少走|走少|走不动/.test(text)) {
    for (const day of itinerary.days) {
      const kept = (day.items || []).filter((it) => !/黎黄陂|巴公/.test(it.name));
      if (kept.length) day.items = kept;
    }
    itinerary.days = itinerary.days.filter((day) => day.items && day.items.length);
  }
  if (/不要|去掉|删除|取消/.test(text) && /巴公/.test(text)) {
    for (const day of itinerary.days || []) {
      day.items = (day.items || []).filter((it) => !/巴公/.test(it.name));
      for (const it of day.items) {
        if (it.note) it.note = String(it.note).replace(/巴公房子不在本段。?/g, '这段只走社区内部。');
      }
    }
    itinerary.days = itinerary.days.filter((day) => day.items && day.items.length);
  }
  return itinerary;
}

function tweakItinerary(prev, text) {
  if (!prev) return buildItinerary(parseItinerarySlots(text));
  let slots = {
    interest: prev.interest,
    duration: prev.duration,
    start: prev.start
  };
  if (DURATIONS.some((d) => d.keys.test(text))) slots.duration = matchOne(DURATIONS, text, slots.duration);
  if (INTERESTS.some((i) => i.keys.test(text))) slots.interest = matchOne(INTERESTS, text, slots.interest);
  if (STARTS.filter((s) => s.id !== 'unspecified').some((s) => s.keys.test(text))) {
    slots.start = matchOne(STARTS, text, slots.start);
  }
  if (/更短|压缩|少走|不要那么多|改成半天|只要半天/.test(text)) slots.duration = DURATIONS[0];
  if (/加一天|再多一天|改成两天|改成三天/.test(text)) slots.duration = DURATIONS[2];
  const itinerary = buildItinerary(slots);
  // drop a named stop
  // named-stop drops are handled in dropMap below
  // simpler drop keywords
  const dropMap = [
    [/黄鹤楼/, '黄鹤楼'],
    [/东湖/, '东湖'],
    [/智民|社区/, '智民里'],
    [/黎黄陂/, '黎黄陂'],
    [/省博|博物馆/, '博物馆'],
    [/光谷/, '光谷'],
    [/木兰/, '木兰'],
    [/美食|过早/, '过早'],
    [/巴公/, '巴公']
  ];
  for (const [re, key] of dropMap) {
    if ((/不要|去掉|删除|取消|路过即可|跳过/.test(text)) && re.test(text)) {
      for (const day of itinerary.days) {
        day.items = day.items.filter((it) => !it.name.includes(key) && !it.area.includes(key));
      }
      itinerary.days = itinerary.days.filter((d) => d.items.length);
    }
  }
  if (/加.*美食|再加.*吃|补一餐|加上过早|过早|多留时间.*吃/.test(text)) {
    const already = itinerary.days.some((d) => d.items.some((i) => i.name.includes('过早') || i.name.includes('美食')));
    if (!already) {
      itinerary.days[itinerary.days.length - 1].items.push(stop(
        '汉派过早或夜市街巷',
        '就近街巷',
        '按你的追问补上一顿美食停留。',
        '只作片区建议，不提供实时店铺信息。',
        [{ id: 'tourism', locator: 'PDF第160页起「汉派美食」' }]
      ));
    }
  }
  applyWalkLimits(itinerary, text);
  itinerary.theme = `${slots.duration.label} · ${slots.interest.label} · 从${slots.start.label}出发（已按追问调整）`;
  itinerary.interest = slots.interest;
  itinerary.duration = slots.duration;
  itinerary.start = slots.start;
  return itinerary;
}

export function detectIntent(text, hasItinerary, history = []) {
  const t = text;
  if (!t) return 'greeting';
  if (/你(现在)?(用的|是|接了|接入).{0,8}(大模型|GPT|ChatGPT|联网)|是不是(联网)?大模型|有没有接入大模型|模型状态|你是模型吗/.test(t)) return 'model_status';
  if (/你是谁|你叫什么|官方名字|形象叫|鲸|豚|吉祥物/.test(t) && !/规划|行程/.test(t)) return 'identity';
  if (/资料来源|引自哪|页码|根据什么文件|出处/.test(t)) return 'sources';
  if (/官网|网址|dlife/i.test(t) && !/行程|规划/.test(t)) return 'site';
  const itineraryAsk = /行程|规划|路线|怎么玩|玩几天|安排一天|安排半天|三日游|一日游|从.+出发|想去|【选择:/.test(t);
  const inheritedPlace = inferPlace(history);
  const wantsAdjust = /改成|改一天|调整|不要|去掉|换成|再加|更短|压缩|加点|改为|出发|少走|走少|半天|半日/.test(t);
  const itineraryTweak = wantsAdjust && (hasItinerary || inheritedPlace) && !/六站怎么走|怎么走/.test(t);
  if (itineraryTweak) return 'itinerary_adjust';
  if (itineraryAsk) return 'itinerary';
  if (/六站|怎么走|导览|A1|A2|A3|A4|A5|巴公|黎黄陂|咖啡厅|打包厂/.test(t)) return 'six';
  if (/社区|智民里|光谷创新|工坊|体验区/.test(t)) return 'community';
  if (/赛程|几天比赛|48小时|16小时|不通宵|奖金|100万|报名|提交|视频|#SAIG|人气|黑客松|真实订单|选手|108|和平打包|平和打包/.test(t) || /SAIG|saig|大赛|比赛/.test(t)) return 'saig';
  if (/什么是SPU|超级个体|U\s*=\s*P|P\^S|五项能力|BIWEN|一人公司|OPC/.test(t) || /数命SPU(?!社区)/.test(t) || /(^|[^区里])SPU/.test(t) && /理念|是什么|公式|能力/.test(t)) return 'spu';
  if (/SPU/.test(t) && /介绍|什么/.test(t) && /社区/.test(t)) return 'community';
  if (/SPU/.test(t) && /介绍|什么|理念/.test(t)) return 'spu';
  if (/武汉|江城|黄鹤楼|东湖|木兰|过早|三镇|介绍(一下)?这座城/.test(t)) return 'wuhan';
  if (/你好|您好|嗨|在吗|开始/.test(t) && t.length < 12) return 'greeting';
  return 'generic';
}

function isOutOfScope(text) {
  const t = text;
  if (/今天(的)?(天气|气温)|实时(路况|地铁|公交|票|航班)|现在几点开|余票|帮我(买|订|下单|支付|挂号)|股票|加密货币|写(一段)?(病毒|木马)|如何入侵/.test(t)) return true;
  if (/北京旅游|上海行程|杭州西湖|成都宽窄|西安兵马俑/.test(t) && !/对比|不像|不同于武汉/.test(t)) return true;
  if (/诊断|开药|处方|诉讼策略|代写作业交卷/.test(t)) return true;
  return false;
}

function formatCites(cites) {
  const sources = knowledge.sources;
  return (cites || []).map((c) => {
    const s = sources[c.id] || { title: c.id, kind: '' };
    return {
      title: s.title,
      kind: s.kind,
      locator: c.locator,
      note: s.note || ''
    };
  });
}

function uniqueCites(list) {
  const seen = new Set();
  const out = [];
  for (const c of list) {
    const k = c.title + '|' + c.locator;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

function chunkCites(chunks) {
  return uniqueCites(chunks.flatMap((c) => formatCites(c.cites)));
}

function statusNote(status) {
  if (!status || status === '事实') return '';
  return `（资料状态：${status}）`;
}

function answerFromChunks(intro, chunks, extraCites = []) {
  const body = chunks
    .map((c) => `${c.text}${statusNote(c.status) ? ' ' + statusNote(c.status) : ''}`)
    .join('\n\n');
  return {
    text: `${intro}${body}`,
    sources: uniqueCites([...chunkCites(chunks), ...formatCites(extraCites)])
  };
}

function greeting() {
  return {
    text: '你好，我是城市AI接待员小熠。我可以介绍武汉，带你走一遍智民里六站，按兴趣做一份短途旅游规划，也可以说明数命SPU和SAIG比赛。形象用的是赛题提供的蓝鲸豚正面，资料里没有公布这个形象的官方名字。\n\n请直接问，或点上面的快捷问题。票价、公交和开园时间我只转述手册记载，并提醒以官方为准，不会假装自己掌握实时信息。',
    sources: formatCites([
      { id: 'comp', locator: '线上赛四项功能要求' },
      { id: 'handbook', locator: '封面、第2页六站路线' }
    ]),
    suggestions: ['介绍一下武汉', '智民里六站怎么走', '从智民里出发，做一天行程', 'SAIG比赛怎么安排']
  };
}

function localAnswer(intent, text, itinerary, history, profile) {
  if (isOutOfScope(text)) {
    return {
      text: '这个问题已经超出我的知识范围。我只能依据赛题文件、2026旅游手册、武汉概览（年代较早）和《智民里参访手册》介绍武汉、数命SPU社区、旅游规划和SAIG比赛，不能提供实时天气、路况、余票，也不能处理下单、医疗或与武汉接待无关的事项。如果你愿意，可以换一个和来访、社区或行程有关的问题。',
      sources: formatCites([{ id: 'comp', locator: '线上赛四项功能范围' }]),
      scope: 'out',
      suggestions: ['介绍数命SPU社区', '规划半天江岸行程', 'SAIG赛程以手册怎么写']
    };
  }

  if (intent === 'model_status') {
    return {
      text: '我按已经导入的赛题文件和参访手册做知识问答，没有接入联网大模型，也没有实时路况、余票或天气。票价、开放时间和赛程只转述资料里的记载，赛程和现场信息以官网或各单位官方公布为准。',
      sources: formatCites([{ id: 'comp', locator: '线上赛四项功能范围' }]),
      scope: 'in',
      suggestions: ['介绍一下武汉', '智民里六站怎么走', 'SAIG比赛怎么安排']
    };
  }

  if (intent === 'greeting') return { ...greeting(), scope: 'in' };

  if (intent === 'identity') {
    return {
      text: '我是城市AI接待员小熠，面向初到武汉、智民里或SAIG的来宾。视觉形象裁切自赛题素材里的蓝鲸豚三视图正面，并保留透明背景。参访手册的咖啡厅页也出现了类似形象，但该页配图多为「示意图·AI生成」。赛题和手册没有公布这个形象的官方名字，小熠是本页接待员的称呼。',
      sources: formatCites([
        { id: 'comp', locator: '配套形象素材《武汉SPU城市AI接待员虚拟形象.png》' },
        { id: 'handbook', locator: '第13页图注' }
      ]),
      scope: 'in',
      suggestions: ['介绍智民里', '机器人咖啡厅是真的吗']
    };
  }

  if (intent === 'sources') {
    const list = Object.values(knowledge.sources)
      .map((s) => `${s.kind}：《${s.title}》——${s.note}`)
      .join('\n');
    return {
      text: `我的回答都来自已导入的赛题文件和参访手册，不检索互联网。冲突处理规则是：赛题文件保证四项硬性功能与提交要求，手册丰富场景；信息不对称时以手册为准，赛程仍注明以官网最终公布为准。\n\n${list}`,
      sources: formatCites(Object.keys(knowledge.sources).map((id) => ({ id, locator: '文献说明' }))),
      scope: 'in'
    };
  }

  if (intent === 'site') {
    const chunks = knowledge.chunks.filter((c) => c.tags.includes('saig') && /官网/.test(c.title + c.text));
    const { text, sources } = answerFromChunks('', chunks.length ? chunks : retrieve('官网 dlife', 2));
    return { text, sources, scope: 'in' };
  }

  if (intent === 'itinerary' || intent === 'itinerary_adjust') {
    const built = applyWalkLimits(intent === 'itinerary_adjust' && itinerary
      ? tweakItinerary(itinerary, text)
      : buildItinerary(resolveSlots(text, history, itinerary, profile)), text);
    const next = shapeTripItinerary(built, text, profile);
    const lines = [
      intent === 'itinerary_adjust' ? '已按你的追问做了调整。' : '这是一份结构化短行程，可再告诉我缩短、换出发点或增减站点。',
      `主题：${next.theme}`
    ];
    if (next.partyNote) lines.push(next.partyNote);
    next.days.forEach((day, i) => {
      lines.push(`\n${day.title}`);
      day.items.forEach((it, j) => {
        const st = it.status && it.status !== '事实' ? `〔${it.status}〕` : '';
        lines.push(`${j + 1}. ${it.name}（${it.area}）${st}：${it.why} ${it.note}`);
      });
    });
    lines.push('\n' + next.disclaimer);
    const cites = uniqueCites(next.days.flatMap((d) => d.items.flatMap((it) => formatCites(it.cites))));
    return {
      text: lines.join('\n'),
      sources: cites,
      itinerary: next,
      scope: 'in',
      suggestions: ['改成半天，从智民里出发', '不要黄鹤楼，多留点时间吃过早', '再介绍一下A1栋']
    };
  }

  if (intent === 'six') {
    const chunks = knowledge.chunks.filter((c) => c.tags.includes('six') || c.tags.includes('zhiminli'));
    // if asking one stop, filter
    const focus = [
      [/A1|一栋|智能体咨询/, 'a1'],
      [/A4|A5|教室|直播/, 'a4a5'],
      [/A3|路演|共享餐/, 'a3'],
      [/A2|博物馆|场景展示/, 'a2'],
      [/巴公/, 'bagong'],
      [/黎黄陂|集市/, 'lihuangpi'],
      [/咖啡/, 'cafe'],
      [/打包厂|黑客松现场/, 'six']
    ];
    let picked = chunks;
    const wantAll = /六站|怎么走|导览/.test(text);
    for (const [re, tag] of focus) {
      if (re.test(text)) {
        let focused = knowledge.chunks.filter((c) => c.tags.includes(tag) || (tag === 'six' && /打包厂/.test(c.text)));
        if (/打包厂|黑客松现场/.test(text)) {
          focused = knowledge.chunks.filter((c) => /平和打包厂/.test(c.text) || /打包厂/.test(c.title + c.text));
        }
        const overview = knowledge.chunks.filter((c) => c.tags.includes('route') || c.title.includes('六站怎么走') || c.title.includes('智民里定位'));
        picked = wantAll ? [...overview, ...focused] : focused;
        break;
      }
    }
    if (/是真的吗|实拍|示意图|筹备/.test(text)) {
      picked = knowledge.chunks.filter((c) => ['cafe', 'bagong', 'a3', 'lihuangpi', 'media'].some((t) => c.tags.includes(t) || c.title.includes('图像')));
    }
    const { text: body, sources } = answerFromChunks('先按参访手册把空间讲清楚，并区分实拍、示意和筹备中的内容。\n\n', picked.slice(0, 6));
    return { text: body, sources, scope: 'in', suggestions: ['巴公房子现在能去吗', '从智民里出发做半天规划'] };
  }

  const tagMap = {
    wuhan: ['wuhan'],
    community: ['community', 'zhiminli'],
    spu: ['spu'],
    saig: ['saig']
  };
  if (tagMap[intent]) {
    let chunks = knowledge.chunks.filter((c) => c.tags.some((t) => tagMap[intent].includes(t)));
    if (intent === 'saig') {
      // always include schedule + conflict when asking about time
      if (/赛程|小时|通宵|路演|几号|日程|奖金|108/.test(text)) {
        chunks = knowledge.chunks.filter((c) => /schedule|conflict|prize|theme/.test(c.tags.join() + c.title) || ['schedule','conflict','prize','theme'].some((k) => c.tags.includes(k) || c.title.includes('赛程') || c.title.includes('差异') || c.title.includes('奖金') || c.title.includes('SAIG是什么')));
      }
    }
    if (intent === 'wuhan' && /年鉴|统计|人口|面积/.test(text)) {
      chunks = knowledge.chunks.filter((c) => c.tags.includes('city') || /年鉴|概览资料/.test(c.title));
    }
    const intros = {
      wuhan: '下面依据旅游手册和概览来介绍，涉及旧年鉴数字时会标明年代。\n\n',
      community: '先说社区总体，再落到智民里。光谷创新天地在社区说明里有，但参访手册未做内部导览。\n\n',
      spu: '',
      saig: '赛题文件保证任务定义，现场赛程在信息不对称时以手册为准，并以官网最终公布为准。\n\n'
    };
    const { text: body, sources } = answerFromChunks(intros[intent] || '', chunks.slice(0, 6));
    const suggestions = {
      wuhan: ['东湖怎么玩', '从黄鹤楼出发做一天行程'],
      community: ['六站怎么走', 'A1栋三楼是做什么的'],
      spu: ['BIWEN是做什么的', '再介绍SAIG比赛'],
      saig: ['两天16小时是怎么排的', '线上赛必须具备哪些功能']
    };
    return { text: body, sources, scope: 'in', suggestions: suggestions[intent] };
  }

  // generic retrieval
  const hits = retrieve(text, 4);
  if (!hits.length || scoreChunk(hits[0], text) < 4) {
    return {
      text: '我不太确定这和武汉来访、智民里或SAIG直接有关。我的知识范围是：介绍武汉、介绍数命SPU社区（含六站导览）、做不涉及实时票务的旅游规划，以及说明数命SPU与SAIG。请换一个具体一点的问题，例如「A3栋是什么」或「帮我安排一天江岸行程」。',
      sources: formatCites([{ id: 'comp', locator: '线上赛四项功能范围' }]),
      scope: 'partial',
      suggestions: ['介绍武汉', '智民里六站怎么走', 'SAIG是什么']
    };
  }
  const { text: body, sources } = answerFromChunks('我根据资料里最相近的几段来回答，若不是你想问的，请再具体一点。\n\n', hits);
  return { text: body, sources, scope: 'in' };
}

export const PLACE_IMAGES = [
  {
    id: 'zhiminli-photo',
    file: 'zhiminli-photo.jpg',
    width: 1600,
    height: 900,
    alt: '智民里红砖楼实拍，灰石基座与深色窗框',
    caption: '智民里红砖楼实拍。这是建筑立面照片，不是设计图，也不是平和打包厂。',
    kind: '实拍',
    stops: [/智民里/]
  },
  {
    id: 'zhiminli-design',
    file: 'zhiminli-design.jpg',
    width: 1600,
    height: 990,
    alt: '智民里鸟瞰设计图，标出A1至A5的相对位置，不是实拍',
    caption: '智民里鸟瞰设计图，标出A1至A5。设计图，不是实拍。',
    kind: '设计图',
    stops: [/智民里/]
  },
  {
    id: 'yellow-crane',
    file: 'wuhan-yellow-crane.jpg',
    width: 1600,
    height: 1200,
    alt: '武汉黄鹤楼，楼额写有黄鹤楼三字',
    caption: '黄鹤楼，武汉蛇山。这是楼体近景，不是江城全景。',
    kind: '实拍',
    stops: [/黄鹤楼/],
    credit: {
      author: '螺钉',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:武汉黄鹤楼.jpg'
    }
  },
  {
    id: 'east-lake',
    file: 'wuhan-east-lake.jpg',
    width: 1600,
    height: 1200,
    alt: '武汉东湖景区水面与对岸城市天际线',
    caption: '东湖，武汉东湖景区。这是湖面一景，不是整个东湖的全景。',
    kind: '实拍',
    stops: [/东湖/],
    credit: {
      author: 'Fxqf',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Wuhan_East_Lake_03.jpg'
    }
  },
  {
    id: 'mulan-tianchi',
    file: 'wuhan-mulan-tianchi.jpg',
    width: 1600,
    height: 1200,
    alt: '武汉黄陂木兰天池的大天池，湖中可见隐仙居',
    caption: '木兰天池的大天池，湖中为隐仙居。它在武汉黄陂，是木兰文化生态旅游区里的一个子景区；这不是整个生态区的鸟瞰，也不是云南的木兰。',
    kind: '实拍',
    stops: [/木兰/],
    credit: {
      author: 'Wang31',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:木兰天池_2024-04-24.jpg'
    }
  }
];

function stopText(stop) {
  return `${stop && stop.name || ''} ${stop && stop.area || ''}`;
}

export function selectImages({ intent, text = '', answerText = '', itinerary = null, library = PLACE_IMAGES } = {}) {
  const items = [];
  if (itinerary && Array.isArray(itinerary.days)) {
    for (const day of itinerary.days) {
      for (const stop of day.items || []) items.push(stop);
    }
  }
  const picked = [];
  const seen = new Set();
  const add = (img) => {
    if (!img || seen.has(img.id) || picked.length >= 3) return;
    if (/avatar|鲸|豚/i.test(img.file || '')) return;
    seen.add(img.id);
    picked.push({
      id: img.id,
      file: img.file,
      width: img.width,
      height: img.height,
      alt: img.alt,
      caption: img.caption,
      kind: img.kind,
      credit: img.credit || null
    });
  };
  if (items.length) {
    for (const stop of items) {
      for (const img of library) {
        if ((img.stops || []).some((re) => re.test(stopText(stop)))) add(img);
      }
    }
    return picked;
  }
  if (intent === 'wuhan') {
    const views = [
      { id: 'yellow-crane', test: /黄鹤楼/ },
      { id: 'east-lake', test: /东湖/ },
      { id: 'mulan-tianchi', test: /木兰/ }
    ];
    const focused = views.filter((view) => view.test.test(text));
    const ids = focused.length ? focused.map((view) => view.id) : views.map((view) => view.id);
    for (const id of ids) add(library.find((img) => img.id === id));
    return picked;
  }
  if (intent === 'spu' || intent === 'greeting' || intent === 'identity') return [];
  const blob = `${text}\n${answerText}`;
  if (/巴公/.test(text) && !/智民里|六站|A\d/.test(text)) return [];
  if (/黎黄陂/.test(text) && !/智民里|六站/.test(text)) return [];
  if (intent === 'six' || intent === 'community') {
    const designOnly = /A3|路演|是实景吗|实拍吗|示意图/.test(text) && !/六站|怎么走|导览|社区/.test(text);
    for (const img of library) {
      if (!String(img.id || '').startsWith('zhiminli')) continue;
      if (designOnly && img.kind !== '设计图') continue;
      add(img);
    }
    return picked;
  }
  if (intent === 'saig' && /智民里/.test(blob)) {
    for (const img of library) if (img.id === 'zhiminli-photo') add(img);
  }
  return picked;
}

export async function reply({ message, history = [], itinerary = null, profile = null } = {}) {
  const text = sanitizeInput(message);
  if (!text) {
    return {
      ok: false,
      error: 'empty',
      reply: { text: '请先输入你的问题。', sources: [], scope: 'partial' }
    };
  }
  const safeHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY) : [];
  const intent = detectIntent(text, Boolean(itinerary), safeHistory);
  const local = localAnswer(intent, text, itinerary, safeHistory, sanitizeProfile(profile));
  return {
    ok: true,
    mode: 'local',
    modeLabel: 'local',
    modelUsed: false,
    intent,
    reply: {
      text: local.text,
      sources: local.sources || [],
      suggestions: local.suggestions || [],
      scope: local.scope || 'in',
      itinerary: local.itinerary || null,
      images: local.scope === 'out' ? [] : selectImages({
        intent,
        text,
        answerText: local.text,
        itinerary: local.itinerary || null
      })
    }
  };
}

export { knowledge };
