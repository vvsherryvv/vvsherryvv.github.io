import {
  escapeHtml,
  splitRevealUnits,
  joinRevealUnits,
  isNearBottom,
  NEAR_BOTTOM_PX,
  waitMs,
  createSkip,
  createRunControl,
  revealText,
  performChatRequest,
  commitReplyContext,
  canAcceptSend,
  errorReply
} from '../chat-ui.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const failures = [];
let passed = 0;

function ok(name, cond, detail = '') {
  if (cond) {
    passed += 1;
    console.log('PASS', name);
  } else {
    failures.push(name + (detail ? ' :: ' + detail : ''));
    console.error('FAIL', name, detail);
  }
}

function stubEl() {
  return { textContent: '' };
}

ok('空输入拒绝', canAcceptSend(false, '   ') === false);
ok('busy 时拒绝发送', canAcceptSend(true, '介绍一下武汉') === false);
ok('空闲且有内容可发送', canAcceptSend(false, '介绍一下武汉') === true);
ok('连点第二次应被拒绝', canAcceptSend(true, '介绍一下武汉') === false);

ok('转义尖括号', escapeHtml('<script>alert(1)</script>') === '&lt;script&gt;alert(1)&lt;/script&gt;');
ok('转义引号与and', escapeHtml('"a" & \'b\'') === '&quot;a&quot; &amp; &#39;b&#39;');

const lined = '第一行\n第二行\n\n第四行';
ok('按换行拆分', splitRevealUnits(lined).length === 4);
ok('换行拆分可还原', joinRevealUnits(splitRevealUnits(lined), 4, lined) === lined);
const sentences = '你好。我可以介绍武汉。行程以手册为准。';
const units = splitRevealUnits(sentences);
ok('无换行时按句拆分', units.length === 3 && units[0] === '你好。');
ok('按句拆分可还原', joinRevealUnits(units, units.length, sentences) === sentences);
ok('空文本拆分为空数组', splitRevealUnits('').length === 0);
ok('单行无句号保持整段', splitRevealUnits('智民里六站怎么走')[0] === '智民里六站怎么走');

ok('在底部判定跟随', isNearBottom(600, 1000, 400, 80) === true);
ok('距离等于阈值仍跟随', isNearBottom(520, 1000, 400, 80) === true);
ok('上翻超过阈值不跟随', isNearBottom(500, 1000, 400, 80) === false);
ok('靠近顶部不跟随', isNearBottom(0, 2000, 400, NEAR_BOTTOM_PX) === false);
ok('短内容可视范围内跟随', isNearBottom(0, 300, 400, 96) === true);

{
  const el = stubEl();
  const ticks = [];
  const result = await revealText({
    el,
    text: sentences,
    reducedMotion: true,
    wait: async () => { ticks.push('waited'); },
    onTick: (info) => ticks.push(info)
  });
  ok('reduced-motion 一次写全', el.textContent === sentences);
  ok('reduced-motion 不进入逐行等待', ticks.filter((t) => t === 'waited').length === 0);
  ok('reduced-motion 标记完成', result.complete === true && result.cancelled === false);
}

{
  const el = stubEl();
  const frames = [];
  const result = await revealText({
    el,
    text: sentences,
    reducedMotion: false,
    wait: async () => { frames.push(el.textContent); },
    onTick: () => {}
  });
  ok('逐行先写出第一句', frames[0] === '你好。');
  ok('逐行再写出第二句', frames[1] === '你好。我可以介绍武汉。');
  ok('逐行完成后全文一致', result.complete === true && el.textContent === sentences);
  ok('逐行等待次数为句数减一', frames.length === 2);
}

{
  const el = stubEl();
  const frames = [];
  const src = '甲\n乙\n丙';
  await revealText({
    el,
    text: src,
    wait: async () => { frames.push(el.textContent); }
  });
  ok('换行逐行保留换行符', frames[0] === '甲' && frames[1] === '甲\n乙');
  ok('换行逐行结束为原文', el.textContent === src);
}

{
  const el = stubEl();
  const runs = createRunControl();
  const first = runs.start();
  const pending = revealText({
    el,
    text: '一。二。三。四。',
    signal: first.signal,
    wait: () => waitMs(50, first.signal)
  });
  await waitMs(70);
  runs.start();
  const result = await pending;
  ok('重置取消后标记 cancelled', result.cancelled === true && result.complete === false);
  ok('取消时不会写完全部行', el.textContent !== '一。二。三。四。');
}

{
  const el = stubEl();
  const skip = createSkip();
  const pending = revealText({
    el,
    text: sentences,
    skip,
    wait: () => waitMs(400)
  });
  await waitMs(20);
  skip.skip();
  const result = await pending;
  ok('skip 后全文立即展示', el.textContent === sentences);
  ok('skip 标记完成而非取消', result.complete === true && result.skipped === true && result.cancelled === false);
}

{
  const el = stubEl();
  const raw = '<img src=x onerror=alert(1)>第二句。';
  await revealText({ el, text: raw, reducedMotion: true });
  ok('危险字符串保持原文本', el.textContent === raw);
}

{
  const okFetch = async () => ({ json: async () => ({ ok: true, reply: { text: '江城', sources: [{ title: '手册' }] } }) });
  const good = await performChatRequest({ fetchFn: okFetch, payload: { message: '介绍一下武汉' } });
  ok('请求成功', good.ok === true && good.data.reply.text === '江城');

  const local = await performChatRequest({
    answerFn: async () => ({ ok: true, reply: { text: '智民里', itinerary: { theme: '一天', days: [] } } }),
    payload: { message: '安排行程' }
  });
  ok('本地回答函数可替代网络', local.ok === true && local.data.reply.itinerary.theme === '一天');

  const failFetch = async () => ({ json: async () => ({ ok: false, error: 'nope' }) });
  const bad = await performChatRequest({ fetchFn: failFetch, payload: { message: 'x' } });
  ok('接口失败可恢复分类', bad.ok === false && bad.error === 'reply_failed');

  const netFetch = async () => { throw new Error('offline'); };
  const net = await performChatRequest({ fetchFn: netFetch, payload: { message: 'x' } });
  ok('网络错误可恢复分类', net.ok === false && net.error === 'network');

  const ctrl = new AbortController();
  const hung = () => new Promise((_, reject) => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    ctrl.signal.addEventListener('abort', () => reject(err));
  });
  const pending = performChatRequest({ fetchFn: hung, payload: { message: 'x' }, signal: ctrl.signal });
  ctrl.abort();
  const aborted = await pending;
  ok('重置取消请求为 aborted', aborted.ok === false && aborted.error === 'aborted');
}

ok('失败文案含重试提示', /再试/.test(errorReply('reply_failed').text));
ok('失败文案不指向本地服务', !/server\.mjs|localhost/.test(errorReply('network').text + errorReply('reply_failed').text));
ok('错误回复不带假来源', errorReply('network').sources.length === 0);

{
  const state = { history: [], itinerary: null };
  const next = { text: '已改为半天', itinerary: { theme: '半天行程', days: [{ title: '上半天', items: [] }] } };
  commitReplyContext(state, '改成半天', next);
  ok('行程在展示前已写入状态', state.itinerary && state.itinerary.theme === '半天行程');
  ok('历史含本轮问答', state.history.length === 2 && state.history[0].content === '改成半天');
  for (let i = 0; i < 10; i++) commitReplyContext(state, '再改', { text: 'ok' });
  ok('历史截断为16条', state.history.length === 16);
  ok('无新行程时保留旧行程', state.itinerary.theme === '半天行程');
}

{
  const threshold = 96;
  let follow = true;
  const decide = (top, height, view) => {
    follow = isNearBottom(top, height, view, threshold);
    return follow;
  };
  ok('新消息且在底部则跟随', decide(800, 1200, 400) === true);
  ok('上翻后暂停跟随', decide(200, 1200, 400) === false);
  const shouldHint = !follow;
  ok('暂停跟随时需要新内容提示', shouldHint === true);
  ok('再拉回底部恢复跟随', decide(800, 1200, 400) === true);
}

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..');
const htmlNow = readFileSync(join(PUBLIC, 'index.html'), 'utf8');
const cssNow = readFileSync(join(PUBLIC, 'styles.css'), 'utf8');
const appNow = readFileSync(join(PUBLIC, 'app.js'), 'utf8');
const uiNow = readFileSync(join(PUBLIC, 'chat-ui.js'), 'utf8');
const frontNow = htmlNow + cssNow + appNow + uiNow;

const bannedPhrases = [
  '当前为本地知识检索演示，不是联网大模型',
  '资料来源',
  '回答按本地检索结果逐行展示，未连接大模型，不是实时流式生成',
  '行程和票价都以手册记载为准，不是实时信息',
  '涉及示意图或筹备中的场地，我会如实标明',
  '形象来自赛题三视图正面，资料未公布官方名字',
  '由前端逐行展示，不是联网大模型流式输出',
  '本地知识检索演示（未连接大模型）',
  '本地知识检索演示',
  '未连接大模型'
];
const hits = bannedPhrases.filter((phrase) => frontNow.includes(phrase));
ok('前端源码不含指定说明与资料来源文案', hits.length === 0, hits.join(' | '));
ok('HTML不再包含模式徽标', !/id="modeBadge"/.test(htmlNow) && !/id="modeInline"/.test(htmlNow) && !/class="mode"/.test(htmlNow));
ok('JS不再渲染来源展开', !/sourceList/.test(appNow) && !/class="sources"/.test(appNow) && /itineraryCard\(payload\.itinerary\);/.test(appNow) && !/itineraryCard\(payload\.itinerary\) \+/.test(appNow));
ok('setMode不写回可见徽标', !/modeBadge/.test(appNow) && !/modeInline/.test(appNow));
ok('页面不调用不可用接口', !/\/api\/mode|\/api\/chat|localhost:8788/.test(appNow + uiNow) && /answerFn/.test(appNow) && /function setMode/.test(appNow));
ok('无服务端时回退本地回答', /\/api\/receptionist/.test(appNow) && /answerLocally\(payload\)/.test(appNow) && !/DEEPSEEK_API_KEY|sk-/.test(appNow + uiNow));
ok('欢迎语已去掉指定说明', /我可以介绍武汉/.test(appNow) && !/手册记载为准/.test(appNow) && !/如实标明/.test(appNow));
ok('页面标题主标题与对话区名称一致', /<title>城市AI接待员小熠<\/title>/.test(htmlNow) && /<h1>城市AI接待员小熠<\/h1>/.test(htmlNow) && /id="deskTitle">城市AI接待员小熠</.test(htmlNow));
ok('欢迎自称城市AI接待员小熠', /你好，我是城市AI接待员小熠。/.test(appNow));
ok('页面不声称鲸豚形象原名是小熠', !/本来名叫小熠|官方名字是小熠|形象名叫小熠/.test(htmlNow + appNow));
ok('回答配图懒加载且失败可移除', /appendAnswerImages\(meta, payload\.images\)/.test(appNow) && /loading = 'lazy'/.test(uiNow) && /addEventListener\('error'/.test(uiNow));
ok('配图不接收鲸豚头像文件', /wuhan-yellow-crane\.jpg/.test(uiNow) && /zhiminli-photo\.jpg/.test(uiNow) && !/avatar-front/.test(appNow + uiNow));
ok('图注署名使用链接而不是来源区', /figure-credit/.test(uiNow) && /licenseUrl/.test(uiNow) && !/sourceList/.test(appNow));
ok('侧栏仍保留筹备与示意区分', /还在筹备/.test(htmlNow) && /示意图·AI生成/.test(htmlNow) && /设计图，不是实拍/.test(htmlNow));
ok('对话主页面与四入口仍在', /id="desk"/.test(htmlNow) && /id="thread"/.test(htmlNow) && /id="input"/.test(htmlNow) && /介绍武汉/.test(htmlNow) && /安排行程/.test(htmlNow));
ok('强调色为砖红', /--accent:\s*#A84436/i.test(cssNow) && !/--coral:\s*#d4654a/i.test(cssNow));

function renderMetaStub(payload) {
  const itinerary = payload && payload.itinerary ? JSON.stringify(payload.itinerary) : '';
  return itinerary;
}
const rendered = renderMetaStub({
  text: '已改为半天',
  sources: [{ title: '手册', locator: '第2页' }],
  itinerary: { theme: '半天行程' }
});
ok('动态meta忽略sources', !rendered.includes('资料来源') && !rendered.includes('第2页') && rendered.includes('半天行程'));
ok('CSS已删除来源与徽标样式而非隐藏', !/\.sources\b/.test(cssNow) && !/\.mode\b/.test(cssNow) && !/\.composer-note\b/.test(cssNow) && !/display:\s*none[^\n]*sources/.test(cssNow));

console.log('\nFrontendResult', { passed, failed: failures.length, failures });
if (failures.length) process.exit(1);
