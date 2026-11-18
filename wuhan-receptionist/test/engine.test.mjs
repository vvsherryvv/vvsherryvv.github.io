import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reply, detectIntent, detectMode, sanitizeInput } from '../engine.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
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

async function ask(q, itinerary = null) {
  return reply({ message: q, itinerary });
}

const wuhan = await ask('请介绍一下武汉');
ok('四项-介绍武汉', /江城|长江|黄鹤楼|三镇/.test(wuhan.reply.text), wuhan.reply.text.slice(0, 80));
ok('武汉含来源数据结构', wuhan.reply.sources.some((s) => /旅游产品手册|武汉概览/.test(s.title)));
ok('武汉不把年鉴当2026', !/2026年.*(人口|常住|生产总值)/.test(wuhan.reply.text));

const community = await ask('请介绍数命SPU社区和智民里');
ok('四项-介绍社区', /智民里|光谷创新天地|8000/.test(community.reply.text));
ok('社区含手册或社区说明页', community.reply.sources.some((s) => /社区说明|参访手册/.test(s.title)));

const six = await ask('智民里六站怎么走？巴公房子能去吗？');
ok('六站导览', /A1|黎黄陂|六站/.test(six.reply.text));
ok('区分筹备', /筹备/.test(six.reply.text));

const cafe = await ask('机器人咖啡厅是实拍吗');
ok('示意图不作实拍', /示意图|AI生成|不能当成已经营业的实拍|不能当成已经营业/.test(cafe.reply.text));

const plan = await ask('从智民里出发，帮我安排一天行程，我对老街和社区感兴趣');
ok('四项-旅游规划', plan.reply.itinerary && plan.reply.itinerary.days.length >= 1);
ok('行程含结构化站点', plan.reply.itinerary.days[0].items.length >= 1);
ok('行程卡字段完整', plan.reply.itinerary.days.every((day) => day.title && day.items.every((item) => item.name && item.area && item.why)));
ok('行程含页码来源', plan.reply.sources.some((s) => /PDF第|第\d+页/.test(s.locator)));
ok('行程声明非实时', /实时|官方为准/.test(plan.reply.text + (plan.reply.itinerary.disclaimer || '')));
ok('默认一天含黎黄陂', plan.reply.itinerary.days.some((d) => d.items.some((item) => item.name.includes('黎黄陂'))));

const adjusted = await ask('改成半天，不要黎黄陂路，再加点美食', plan.reply.itinerary);
ok('追问调整生效', adjusted.reply.itinerary && /半天/.test(adjusted.reply.itinerary.theme));
ok('追问可去掉站点或压缩', /半天/.test(adjusted.reply.text) || adjusted.reply.itinerary.duration.id === 'half');
ok('半天追问去掉黎黄陂', !adjusted.reply.itinerary.days.some((d) => d.items.some((item) => item.name.includes('黎黄陂'))));

const multi = await ask('从智民里出发，安排两天行程，我对老街感兴趣');
const oneDay = await ask('改一天，不要黎黄陂路', multi.reply.itinerary);
ok('改一天仍返回行程卡', oneDay.intent === 'itinerary_adjust' && oneDay.reply.itinerary && /一天/.test(oneDay.reply.itinerary.theme));
ok('改一天去掉黎黄陂', !JSON.stringify(oneDay.reply.itinerary).includes('黎黄陂'));
ok('改一天保留可展示字段', Boolean(oneDay.reply.itinerary.disclaimer) && oneDay.reply.itinerary.days.length >= 1);

const spu = await ask('数命SPU是什么，公式怎么写');
ok('四项-介绍SPU', /超级个体|U\s*=\s*P/.test(spu.reply.text) && /独立判断|承担责任/.test(spu.reply.text));

const saig = await ask('SAIG比赛是48小时通宵吗，赛程怎么安排');
ok('四项-介绍比赛', /真实订单|16小时|108/.test(saig.reply.text));
ok('手册冲突优先-采用16小时不通宵', /两天16小时|16小时/.test(saig.reply.text) && /不通宵/.test(saig.reply.text));
ok('仍说明官网为准', /官网/.test(saig.reply.text));
ok('不把48小时说成现行安排的唯一结论', !/^[\s\S]*比赛为48小时(?![\s\S]*手册)/.test(saig.reply.text) && /16小时/.test(saig.reply.text));

const unknown = await ask('今天北京下雨吗，帮我买一张机票');
ok('未知/域外问题降级', unknown.reply.scope === 'out' && /超出/.test(unknown.reply.text));
ok('域外不编造天气', !/降雨概率|准时起飞/.test(unknown.reply.text));

const model = await ask('你是不是接入了联网大模型？');
ok('被问到模型时说明本地知识库', model.intent === 'model_status' && /没有接入联网大模型/.test(model.reply.text) && /实时/.test(model.reply.text));
ok('平时回答不主动声称联网模型', !/已接入|正在调用大模型/.test(wuhan.reply.text + plan.reply.text));

const xss = await ask('<script>alert(1)</script>介绍黄鹤楼');
ok('XSS输入仍给安全文本', /黄鹤楼/.test(xss.reply.text) && !xss.reply.text.includes('<script>alert(1)</script>'));
ok('XSS不进入行程字段', !JSON.stringify(xss.reply.itinerary || '').includes('<script>'));

ok('静态模式始终为local', detectMode().mode === 'local' && detectMode({ OPENAI_API_KEY: 'present' }).mode === 'local');
ok('空密钥不升为模型模式', detectMode({ OPENAI_API_KEY: '  ' }).mode === 'local');
ok('输入截断', sanitizeInput('汉'.repeat(3000)).length === 2000);
ok('意图识别行程', detectIntent('帮我做一日游', false) === 'itinerary');

const hello = await ask('你好');
ok('问候自称城市AI接待员小熠', hello.intent === 'greeting' && /我是城市AI接待员小熠/.test(hello.reply.text));
ok('问候不把鲸豚形象原名说成小熠', !/本来名叫小熠|官方名字是小熠|形象名叫小熠/.test(hello.reply.text));
const who = await ask('你叫什么');
ok('被问名字时自称城市AI接待员小熠', who.intent === 'identity' && /我是城市AI接待员小熠/.test(who.reply.text));
ok('被问名字时说明形象没有公布官方名字', /没有公布这个形象的官方名字/.test(who.reply.text) && !/本来名叫小熠/.test(who.reply.text));

const { selectImages, PLACE_IMAGES } = await import('../engine.js');
const placeFiles = PLACE_IMAGES.map((img) => img.file);
ok('配图含智民里和三处武汉实景', placeFiles.includes('zhiminli-photo.jpg') && placeFiles.includes('wuhan-yellow-crane.jpg') && placeFiles.includes('wuhan-east-lake.jpg') && placeFiles.includes('wuhan-mulan-tianchi.jpg') && placeFiles.every((file) => !/avatar|鲸|豚/.test(file)));
const wuhanImages = (await ask('请介绍一下武汉')).reply.images;
ok('介绍武汉配黄鹤楼东湖和木兰天池', wuhanImages.map((img) => img.id).join(',') === 'yellow-crane,east-lake,mulan-tianchi');
ok('木兰图标明大天池而不是整个生态区或云南', /大天池/.test(wuhanImages[2].caption) && /黄陂/.test(wuhanImages[2].caption) && /不是整个生态区的鸟瞰/.test(wuhanImages[2].caption) && /不是云南/.test(wuhanImages[2].caption));
ok('武汉图带可核验署名', wuhanImages.every((img) => img.credit && img.credit.licenseUrl.startsWith('https://creativecommons.org/') && img.credit.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:')));
const craneOnly = (await ask('黄鹤楼在蛇山吗')).reply.images;
ok('只问黄鹤楼不配东湖或木兰', craneOnly.length === 1 && craneOnly[0].id === 'yellow-crane');
const lakeOnly = (await ask('介绍东湖')).reply.images;
ok('只问东湖不配黄鹤楼', lakeOnly.length === 1 && lakeOnly[0].id === 'east-lake');
const mulanOnly = (await ask('木兰天池是哪里')).reply.images;
ok('只问木兰不配黄鹤楼', mulanOnly.length === 1 && mulanOnly[0].id === 'mulan-tianchi');
const sixImages = (await ask('智民里六站怎么走')).reply.images;
ok('六站配实拍和设计图', sixImages.length === 2 && sixImages.every((img) => img.id.startsWith('zhiminli')) && sixImages.some((img) => img.kind === '实拍') && sixImages.some((img) => img.kind === '设计图' && /不是实拍/.test(img.caption)));
const a3Images = (await ask('A3栋是什么，是实景吗')).reply.images;
ok('A3只配设计图不把实拍当实景', a3Images.length === 1 && a3Images[0].kind === '设计图');
const spuImages = (await ask('数命SPU是什么，公式怎么写')).reply.images;
ok('SPU理念无场地图', spuImages.length === 0);
const saigImages = (await ask('SAIG比赛是48小时通宵吗，赛程怎么安排')).reply.images;
ok('SAIG提到智民里时配一张实拍', saigImages.length === 1 && saigImages[0].kind === '实拍' && /不是平和打包厂/.test(saigImages[0].caption));
const tripImages = plan.reply.images || [];
ok('含智民里的行程有配图', tripImages.some((img) => img.id === 'zhiminli-photo'));
const droppedRoad = await ask('改一天，不要黎黄陂路', plan.reply.itinerary);
const withFakeRoad = selectImages({
  intent: 'itinerary_adjust',
  text: '不要黎黄陂路',
  itinerary: plan.reply.itinerary,
  library: [...PLACE_IMAGES, { id: 'lihuangpi', file: 'lihuangpi.jpg', width: 4, height: 3, alt: '黎黄陂路', caption: '黎黄陂路', kind: '实拍', stops: [/黎黄陂/] }]
});
const afterDrop = selectImages({
  intent: 'itinerary_adjust',
  text: '不要黎黄陂路',
  itinerary: droppedRoad.reply.itinerary,
  library: [...PLACE_IMAGES, { id: 'lihuangpi', file: 'lihuangpi.jpg', width: 4, height: 3, alt: '黎黄陂路', caption: '黎黄陂路', kind: '实拍', stops: [/黎黄陂/] }]
});
ok('行程里有黎黄陂站时可以挂上该站图', withFakeRoad.some((img) => img.id === 'lihuangpi'));
ok('去掉黎黄陂路后不再保留该站配图', !afterDrop.some((img) => img.id === 'lihuangpi') && !JSON.stringify(droppedRoad.reply.images).includes('lihuangpi'));
ok('去掉黎黄陂后智民里图仍可留下', afterDrop.some((img) => img.id === 'zhiminli-photo'));
const noCommunity = await ask('不要智民里', plan.reply.itinerary);
ok('去掉智民里后不再配智民里图', !(noCommunity.reply.images || []).some((img) => /zhiminli/.test(img.file)));
const craneDay = await ask('从黄鹤楼出发，安排一天行程');
ok('黄鹤楼行程配黄鹤楼图', (craneDay.reply.images || []).some((img) => img.id === 'yellow-crane'));
const noCrane = await ask('不要黄鹤楼', craneDay.reply.itinerary);
ok('去掉黄鹤楼后不再配黄鹤楼图', !(noCrane.reply.images || []).some((img) => img.id === 'yellow-crane'));

const pageFiles = ['index.html', 'styles.css', 'app.js', 'chat-ui.js', 'engine.js'];
const bundled = pageFiles.map((name) => readFileSync(join(ROOT, name), 'utf8')).join('\n');
ok('移动布局含媒体查询', /@media \(max-width: 860px\)/.test(readFileSync(join(ROOT, 'styles.css'), 'utf8')));
ok('含viewport', /width=device-width/.test(readFileSync(join(ROOT, 'index.html'), 'utf8')));
ok('页面不依赖不可用服务', !/localhost:8788|\/api\/chat|\/api\/mode|server\.mjs|api\.openai\.com/.test(bundled));
ok('页面资产使用相对路径', /src="assets\/avatar-front-cutout\.png"/.test(bundled) && /src="app\.js/.test(bundled) && /href="styles\.css/.test(bundled));
ok('没有表单标签', !/<form\b/i.test(bundled));

const zhiminHistory = [
  { role: 'user', content: '智民里六站怎么走' },
  { role: 'assistant', content: '六站是A1、A4、A3、A2、巴公房子和黎黄陂路。' },
  { role: 'user', content: '周边怎么逛，按片区分组推荐' },
  { role: 'assistant', content: '周边可以按江岸社区和稍远的武昌地标分开看。' }
];
const halfWalk = await reply({ message: '我们只有半天，能不能少走一点', history: zhiminHistory });
const halfNames = (halfWalk.reply.itinerary?.days || []).flatMap((day) => day.items.map((item) => item.name)).join(' | ');
ok('半天少走仍留在智民里', halfWalk.intent === 'itinerary_adjust' && /智民里/.test(halfNames) && !/黄鹤楼/.test(halfNames) && !/黎黄陂/.test(halfNames), halfNames);
const dropBagong = await reply({
  message: '去掉巴公房子，再给一个行程',
  history: zhiminHistory.concat([{ role: 'user', content: '我们只有半天，能不能少走一点' }]),
  itinerary: halfWalk.reply.itinerary
});
const bagongNames = (dropBagong.reply.itinerary?.days || []).flatMap((day) => day.items.map((item) => item.name)).join(' | ');
const bagongBlob = `${dropBagong.reply.text}\n${JSON.stringify(dropBagong.reply.itinerary)}`;
ok('去掉巴公后卡片和文字都不是黄鹤楼', /智民里/.test(bagongNames) && !/黄鹤楼公园/.test(bagongNames) && !/巴公房子（/.test(bagongBlob) && !/黄鹤楼公园/.test(dropBagong.reply.text), bagongNames);
ok('去掉巴公后不配黄鹤楼图', !(dropBagong.reply.images || []).some((img) => img.id === 'yellow-crane'));

const craneRoute = await ask('从黄鹤楼出发，安排一天行程');
const craneHalf = await reply({
  message: '改成半天，少走路',
  history: [{ role: 'user', content: '从黄鹤楼出发，安排一天行程' }],
  itinerary: craneRoute.reply.itinerary
});
const craneHalfNames = (craneHalf.reply.itinerary?.days || []).flatMap((day) => day.items.map((item) => item.name)).join(' | ');
ok('非社区路线少走不会改去智民里', /黄鹤楼/.test(craneHalfNames) && !/智民里/.test(craneHalfNames), craneHalfNames);
const toLake = await reply({
  message: '改去东湖，安排半天',
  history: zhiminHistory,
  itinerary: halfWalk.reply.itinerary
});
const lakeNames = (toLake.reply.itinerary?.days || []).flatMap((day) => day.items.map((item) => item.name)).join(' | ');
ok('明确换区时可以离开智民里', /东湖/.test(lakeNames) && !/智民里 A1/.test(lakeNames), lakeNames);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'test') continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, acc);
    else acc.push(path);
  }
  return acc;
}
const published = walk(ROOT).map((path) => relative(ROOT, path));
ok('不发布说明、环境文件或服务配置', !published.some((path) => /使用说明|\.env|server\.mjs|node_modules|backup/i.test(path)));

console.log('\nResult', { passed, failed: failures.length, failures });
if (failures.length) process.exit(1);
