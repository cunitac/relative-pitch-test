// ===== CONSTANTS =====

const SLIDER_WIDTH  = 200;  // cents — fixed slider range width
const ALT_PERIOD_MS = 700;  // ms per note in alternating mode

// Silent mode: append ?silent to URL (for automated testing / preview without audio)
const SILENT_MODE = new URLSearchParams(location.search).has('silent');

// Fixed order: simul+upper ×2, simul+base ×2, alt+upper ×2, alt+base ×2
const TEST_COMBOS = [
  { playMode: 'simul', moveMode: 'upper' },
  { playMode: 'simul', moveMode: 'upper' },
  { playMode: 'simul', moveMode: 'base'  },
  { playMode: 'simul', moveMode: 'base'  },
  { playMode: 'alt',   moveMode: 'upper' },
  { playMode: 'alt',   moveMode: 'upper' },
  { playMode: 'alt',   moveMode: 'base'  },
  { playMode: 'alt',   moveMode: 'base'  },
];


// ===== INTERVAL DATA =====
// desc format: lower:upper (e.g. P5 = 2:3)

const JUST = [
  { id:'p1',   abbr:'P1',  name:'完全1度',         ratio:1,      desc:'1:1'    },
  { id:'m2j',  abbr:'m2',  name:'短2度（純正）',    ratio:16/15,  desc:'15:16'  },
  { id:'M2j',  abbr:'M2',  name:'長2度（純正）',    ratio:9/8,    desc:'8:9'    },
  { id:'m3j',  abbr:'m3',  name:'短3度（純正）',    ratio:6/5,    desc:'5:6'    },
  { id:'M3j',  abbr:'M3',  name:'長3度（純正）',    ratio:5/4,    desc:'4:5'    },
  { id:'p4j',  abbr:'P4',  name:'完全4度（純正）',  ratio:4/3,    desc:'3:4'    },
  { id:'ttj',  abbr:'TT',  name:'増4度（純正）',    ratio:45/32,  desc:'32:45'  },
  { id:'p5j',  abbr:'P5',  name:'完全5度（純正）',  ratio:3/2,    desc:'2:3'    },
  { id:'m6j',  abbr:'m6',  name:'短6度（純正）',    ratio:8/5,    desc:'5:8'    },
  { id:'M6j',  abbr:'M6',  name:'長6度（純正）',    ratio:5/3,    desc:'3:5'    },
  { id:'m7j',  abbr:'m7',  name:'短7度（純正）',    ratio:9/5,    desc:'5:9'    },
  { id:'M7j',  abbr:'M7',  name:'長7度（純正）',    ratio:15/8,   desc:'8:15'   },
  { id:'p8',   abbr:'P8',  name:'完全8度',          ratio:2,      desc:'1:2'    },
  { id:'m9j',  abbr:'m9',  name:'短9度（純正）',    ratio:32/15,  desc:'15:32'  },
  { id:'M9j',  abbr:'M9',  name:'長9度（純正）',    ratio:9/4,    desc:'4:9'    },
  { id:'m10j', abbr:'m10', name:'短10度（純正）',   ratio:12/5,   desc:'5:12'   },
  { id:'M10j', abbr:'M10', name:'長10度（純正）',   ratio:5/2,    desc:'2:5'    },
  { id:'p11j', abbr:'P11', name:'完全11度（純正）', ratio:8/3,    desc:'3:8'    },
  { id:'a11j', abbr:'A11', name:'増11度（純正）',   ratio:45/16,  desc:'16:45'  },
  { id:'p12j', abbr:'P12', name:'完全12度（純正）', ratio:3,      desc:'1:3'    },
  { id:'m13j', abbr:'m13', name:'短13度（純正）',   ratio:16/5,   desc:'5:16'   },
  { id:'M13j', abbr:'M13', name:'長13度（純正）',   ratio:10/3,   desc:'3:10'   },
  { id:'m14j', abbr:'m14', name:'短14度（純正）',   ratio:18/5,   desc:'5:18'   },
  { id:'M14j', abbr:'M14', name:'長14度（純正）',   ratio:15/4,   desc:'4:15'   },
  { id:'p15',  abbr:'P15', name:'完全15度',         ratio:4,      desc:'1:4'    },
];

const ET_ABBRS = ['P1','m2','M2','m3','M3','P4','TT','P5','m6','M6','m7','M7',
                  'P8','m9','M9','m10','M10','P11','A11','P12','m13','M13','m14','M14','P15'];
const ET_NAMES = ['完全1度','短2度','長2度','短3度','長3度','完全4度','増4度','完全5度',
                  '短6度','長6度','短7度','長7度','完全8度','短9度','長9度','短10度',
                  '長10度','完全11度','増11度','完全12度','短13度','長13度','短14度',
                  '長14度','完全15度'];

const EQUAL = Array.from({length: 25}, (_, i) => {
  const ratio = Math.pow(2, i / 12);
  // desc: lower:upper format
  const desc = i === 0 ? '1:1'
             : i === 12 ? '1:2'
             : i === 24 ? '1:4'
             : `1:2^(${i}/12)`;
  return { id: `et${i}`, abbr: ET_ABBRS[i], name: `${ET_NAMES[i]}（平均）`, ratio, desc };
});

[...JUST, ...EQUAL].forEach(iv => { iv.cents = 1200 * Math.log2(iv.ratio); });


// ===== AUDIO =====

const HARMONICS = [
  [1,.48],[2,.28],[3,.16],[4,.09],[5,.055],[6,.034],[7,.022],[8,.014],
];

let ctx, masterGain, baseNode, upperNode;
let isPlaying = false;

function ensureCtx() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new AudioContext();
  masterGain = ctx.createGain();
  masterGain.gain.value = SILENT_MODE ? 0 : 1;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 8;
  comp.ratio.value = 4; comp.attack.value = .002; comp.release.value = .15;
  masterGain.connect(comp);
  comp.connect(ctx.destination);
}

function makeTone(freq, amp) {
  const gn = ctx.createGain();
  gn.gain.setValueAtTime(0, ctx.currentTime);
  gn.gain.linearRampToValueAtTime(amp, ctx.currentTime + .03);
  gn.connect(masterGain);
  const oscs = HARMONICS.map(([n, a]) => {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = Math.max(20, freq * n); g.gain.value = a;
    osc.connect(g); g.connect(gn); osc.start();
    return { osc, n };
  });
  return { gn, oscs };
}

function setFreq(node, freq) {
  const t = ctx.currentTime;
  node.oscs.forEach(({osc,n}) =>
    osc.frequency.setTargetAtTime(Math.max(20, freq * n), t, .006));
}

function killNode(node) {
  if (!node) return;
  node.gn.gain.setTargetAtTime(0, ctx.currentTime, .05);
  node.oscs.forEach(({osc}) => { try { osc.stop(ctx.currentTime + .35); } catch(e){} });
}


// ===== ALTERNATING MODE =====

let altTimer = null;
let altPhase = 0;

function stopAlternating() {
  if (altTimer) { clearInterval(altTimer); altTimer = null; }
}

function startAlternating() {
  stopAlternating();
  altPhase = 0;
  if (baseNode)  baseNode.gn.gain.setTargetAtTime(0.34, ctx.currentTime, 0.03);
  if (upperNode) upperNode.gn.gain.setTargetAtTime(0,   ctx.currentTime, 0.03);
  altTimer = setInterval(() => {
    if (!isPlaying) return;
    if (altPhase === 0) {
      if (baseNode)  baseNode.gn.gain.setTargetAtTime(0,    ctx.currentTime, 0.04);
      if (upperNode) upperNode.gn.gain.setTargetAtTime(0.34, ctx.currentTime, 0.04);
      altPhase = 1;
    } else {
      if (upperNode) upperNode.gn.gain.setTargetAtTime(0,    ctx.currentTime, 0.04);
      if (baseNode)  baseNode.gn.gain.setTargetAtTime(0.34,  ctx.currentTime, 0.04);
      altPhase = 0;
    }
  }, ALT_PERIOD_MS);
}

function setPlayMode(mode) {
  playMode = mode;
  document.querySelectorAll('.mode-btn[data-mode]').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode));
  if (!isPlaying) return;
  if (mode === 'simul') {
    stopAlternating();
    if (baseNode)  baseNode.gn.gain.setTargetAtTime(0.34, ctx.currentTime, 0.03);
    if (upperNode) upperNode.gn.gain.setTargetAtTime(0.34, ctx.currentTime, 0.03);
  } else {
    startAlternating();
  }
}


// ===== AUDIO START / STOP =====

function startAudio() {
  ensureCtx();
  if (isPlaying) return;
  isPlaying = true;
  const { baseHz, upperHz } = currentFreqs();
  if (playMode === 'alt') {
    baseNode  = makeTone(baseHz, 0.34);
    upperNode = makeTone(upperHz, 0);
    startAlternating();
  } else {
    baseNode  = makeTone(baseHz, 0.34);
    upperNode = makeTone(upperHz, 0.34);
  }
  playBtn.textContent = '■ 停止';
  submitBtn.disabled  = false;
}

function stopAudio() {
  if (!isPlaying) return;
  isPlaying = false;
  stopAlternating();
  killNode(baseNode); killNode(upperNode);
  baseNode = upperNode = null;
  playBtn.textContent = '▶ 再生';
  submitBtn.disabled  = true;
}

function currentFreqs() {
  if (moveMode === 'upper') {
    return { baseHz: baseFreq, upperHz: baseFreq * Math.pow(2, cents / 1200) };
  } else {
    return { upperHz: upperAnchor, baseHz: upperAnchor * Math.pow(2, -cents / 1200) };
  }
}

function updatePitch() {
  if (moveMode === 'upper') {
    if (upperNode) setFreq(upperNode, baseFreq * Math.pow(2, cents / 1200));
  } else {
    if (baseNode)  setFreq(baseNode,  upperAnchor * Math.pow(2, -cents / 1200));
  }
}


// ===== GAME STATE =====

let appMode    = 'test';
let targetIv   = null;
let baseFreq   = 440;
let cents      = 0;      // always = interval in cents (upper - base), regardless of mode
let sliderMin  = -100;
let sliderMax  = 100;
let playMode   = 'simul';
let moveMode   = 'upper';
let upperAnchor = 440;
let currentTab  = 'just';

// Test state
let testQuestions = [];
let testAnswers   = [];
let testQIdx      = 0;


// ===== SLIDER HELPERS =====
// In "base" mode the slider is inverted: right = base up = interval down.
// sliderPos is the HTML slider's value; cents is always the interval.

function sliderPosFromCents(c) {
  return moveMode === 'base' ? (sliderMin + sliderMax - c) : c;
}

function centsFromSliderPos(pos) {
  return moveMode === 'base' ? (sliderMin + sliderMax - pos) : pos;
}

function updateFill() {
  const pos = sliderPosFromCents(cents);
  const pct = ((pos - sliderMin) / SLIDER_WIDTH) * 100;
  pitchSlider.style.background =
    `linear-gradient(to right, var(--accent) ${pct}%, var(--track) ${pct}%)`;
}

function syncSlider() {
  pitchSlider.value = sliderPosFromCents(cents);
  updateFill();
}


// ===== GRID SNAP =====
// Snap raw cents to the nearest point on the target-relative 0.1¢ grid.
// Ensures dev = cents − targetCents is always an exact multiple of 0.1¢.
function snapToGrid(raw, targetCents) {
  return Math.round((raw - targetCents) / 0.1) * 0.1 + targetCents;
}


// ===== RANDOM HELPERS =====

function randomBase() {
  return 110 * Math.pow(2, Math.floor(Math.random() * 25) / 12);
}

function randomSliderRange(targetCents) {
  // lo uniform in [target−W, target] → target has uniform position in [0,1] within window
  // No clamping: allows negative cents or > 2400¢ (audio handles all values)
  const lo = targetCents - Math.random() * SLIDER_WIDTH;
  return { lo, hi: lo + SLIDER_WIDTH };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


// ===== DOM REFERENCES =====

const secHome       = document.getElementById('secHome');
const secPlay       = document.getElementById('secPlay');
const secResult     = document.getElementById('secResult');
const secTestResult = document.getElementById('secTestResult');
const ivGrid        = document.getElementById('ivGrid');
const playName      = document.getElementById('playName');
const playRatio     = document.getElementById('playRatio');
const pitchSlider   = document.getElementById('pitchSlider');
const playBtn       = document.getElementById('playBtn');
const submitBtn     = document.getElementById('submitBtn');
const backBtn       = document.getElementById('backBtn');
const scoreNum      = document.getElementById('scoreNum');
const scoreGrade    = document.getElementById('scoreGrade');
const resultDl      = document.getElementById('resultDl');
const retryBtn      = document.getElementById('retryBtn');
const nextBtn       = document.getElementById('nextBtn');
const tweetBtn      = document.getElementById('tweetBtn');
const testHeader    = document.getElementById('testHeader');
const modeToggles   = document.getElementById('modeToggles');
const testQNum      = document.getElementById('testQNum');
const testBadge1    = document.getElementById('testBadge1');
const testBadge2    = document.getElementById('testBadge2');

const ALL_SECTIONS = [secHome, secPlay, secResult, secTestResult];

function showSection(...visible) {
  ALL_SECTIONS.forEach(s => { s.hidden = !visible.includes(s); });
}


// ===== TABS =====

function setAppMode(mode) {
  appMode = mode;
  document.querySelectorAll('#modeTabs .tab').forEach(t =>
    t.classList.toggle('active', t.dataset.mode === mode));
  document.getElementById('homeHint').textContent = mode === 'test'
    ? '音程を選んでテスト開始（4パターン×2問）'
    : '音程を選んで自由練習';
}

function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll('#tuningTabs .tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab));
  renderGrid(tab);
}


// ===== INTERVAL GRID =====

function renderGrid(tab) {
  const list = tab === 'just' ? JUST : EQUAL;
  ivGrid.innerHTML = '';
  list.forEach(iv => {
    const btn = document.createElement('button');
    btn.className = 'iv-btn';
    const shortName = iv.name.replace('（純正）','').replace('（平均）','');
    btn.innerHTML =
      `<span class="iv-abbr">${iv.abbr}</span>` +
      `<span class="iv-sub">${shortName}</span>` +
      `<span class="iv-ratio">${iv.desc}</span>`;
    btn.addEventListener('click', () => {
      if (appMode === 'test') startTestForInterval(iv);
      else startLearnGame(iv);
    });
    ivGrid.appendChild(btn);
  });
}


// ===== GAME CORE =====

function setupGame(iv) {
  targetIv = iv;
  playName.textContent  = iv.name;
  playRatio.textContent = iv.desc;

  baseFreq = randomBase();

  const { lo, hi } = randomSliderRange(iv.cents);
  sliderMin = lo;
  sliderMax = hi;
  pitchSlider.min  = lo;
  pitchSlider.max  = hi;
  pitchSlider.step = 0.1;

  cents = Math.max(lo, Math.min(hi, snapToGrid((lo + hi) / 2, iv.cents)));
  upperAnchor = baseFreq * Math.pow(2, cents / 1200);

  syncSlider();
  stopAudio();
  startAudio();
}


// ===== MOVE MODE =====

function setMoveMode(mode) {
  if (mode === moveMode) return;
  if (mode === 'base' && isPlaying) {
    upperAnchor = baseFreq * Math.pow(2, cents / 1200);
  }
  moveMode = mode;
  document.querySelectorAll('.move-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.move === mode));
  syncSlider();
  if (!isPlaying) return;
  if (mode === 'upper') {
    if (baseNode)  setFreq(baseNode,  baseFreq);
    if (upperNode) setFreq(upperNode, baseFreq * Math.pow(2, cents / 1200));
  } else {
    if (upperNode) setFreq(upperNode, upperAnchor);
    if (baseNode)  setFreq(baseNode,  upperAnchor * Math.pow(2, -cents / 1200));
  }
}


// ===== LEARN MODE =====

function startLearnGame(iv) {
  testHeader.hidden  = true;
  modeToggles.hidden = false;
  backBtn.textContent   = '← 戻る';
  submitBtn.textContent = '回答する';

  setupGame(iv);
  showSection(secPlay);
}

const NOTE_NAMES = ['A','A#','B','C','C#','D','D#','E','F','F#','G','G#'];
function hzToNote(hz) {
  const semis  = Math.round(12 * Math.log2(hz / 440));
  const octave = Math.floor((semis + 57) / 12);
  return NOTE_NAMES[((semis % 12) + 12) % 12] + octave;
}

function scoreColor(absD) {
  return absD < 5 ? '#16a34a' : absD < 15 ? '#ca8a04' : '#dc2626';
}

function gradeFromAvg(avg) {
  if (avg >= 100) return { grade: '完璧！',         color: '#16a34a' };
  if (avg >= 99)  return { grade: 'ほぼ完璧！',     color: '#16a34a' };
  if (avg >= 97)  return { grade: '超優秀！',       color: '#15803d' };
  if (avg >= 95)  return { grade: '優秀！',         color: '#15803d' };
  if (avg >= 85)  return { grade: '素晴らしい！',   color: '#15803d' };
  if (avg >= 70)  return { grade: 'よくできました', color: '#ca8a04' };
  if (avg >= 50)  return { grade: 'もう少し',       color: '#ea580c' };
  return                { grade: '練習あるのみ',   color: '#dc2626' };
}

// Render score with small decimal part: e.g. 87<span>.4</span>  87<span>.0</span>  (0点のみ小数なし)
function setScoreDisplay(el, score) {
  const int = Math.floor(score);
  const dec = Math.round((score - int) * 10);
  el.innerHTML = score === 0
    ? `0`
    : `${int}<span class="score-dec">.${dec}</span>`;
}

// Show result screen — used by both learn and test (per-question)
function showResultScreen({ score, dev, extraDl = '', showRetry, showTweet, nextLabel, onNext, onTweet }) {
  const absD  = Math.abs(dev);
  const sign  = dev >= 0 ? '+' : '';
  const color = scoreColor(absD);
  const { grade } = gradeFromAvg(score);

  setScoreDisplay(scoreNum, score);
  scoreNum.style.color   = color;
  scoreGrade.textContent = grade;
  scoreGrade.style.color = color;
  scoreNum.style.animation = 'none';
  requestAnimationFrame(() => { scoreNum.style.animation = ''; });

  resultDl.innerHTML =
    `<dt>ずれ</dt><dd style="color:${color}">${sign}${dev.toFixed(2)} セント</dd>` +
    extraDl;

  retryBtn.hidden = !showRetry;
  tweetBtn.hidden = !showTweet;
  nextBtn.textContent = nextLabel;
  nextBtn._onNext = onNext;
  if (onTweet) tweetBtn.onclick = onTweet;

  showSection(secResult);
}

function showLearnResult() {
  stopAudio();
  const dev   = cents - targetIv.cents;
  const absD  = Math.abs(dev);
  const score = Math.round(Math.max(0, 100 - absD * 2) * 10) / 10;
  const sign  = dev >= 0 ? '+' : '';
  const color = scoreColor(absD);

  const fixedHz    = moveMode === 'upper' ? baseFreq : upperAnchor;
  const fixedLabel = moveMode === 'upper' ? '基音' : '固定音（上）';
  const targetHz   = moveMode === 'upper' ? baseFreq * targetIv.ratio : upperAnchor / targetIv.ratio;
  const yourHz     = moveMode === 'upper'
    ? baseFreq * Math.pow(2, cents / 1200)
    : upperAnchor * Math.pow(2, -cents / 1200);

  const extraDl =
    `<dt>${fixedLabel}</dt><dd>${fixedHz.toFixed(1)} Hz（${hzToNote(fixedHz)}）</dd>` +
    `<dt>目標</dt><dd>${targetHz.toFixed(1)} Hz</dd>` +
    `<dt>あなたの設定</dt><dd>${yourHz.toFixed(1)} Hz</dd>`;

  const tweet = `相対音感テスト「${targetIv.name}」で${score}点！（ずれ${sign}${dev.toFixed(1)}¢）#相対音感テスト`;

  showResultScreen({
    score, dev, extraDl,
    showRetry: true, showTweet: true,
    nextLabel: '別の音程',
    onNext: () => showSection(secHome),
    onTweet: () => window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`, '_blank'),
  });
}


// ===== TEST MODE =====

function startTestForInterval(iv) {
  // Fixed order: simul+upper×2, simul+base×2, alt+upper×2, alt+base×2
  testQuestions = TEST_COMBOS.map(combo => ({ ...combo, iv }));
  testAnswers   = [];
  testQIdx      = 0;
  playTestQuestion(0);
}

function playTestQuestion(idx) {
  const q = testQuestions[idx];

  playMode = q.playMode;
  moveMode = q.moveMode;
  document.querySelectorAll('.mode-btn[data-mode]').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === playMode));
  document.querySelectorAll('.move-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.move === moveMode));

  testHeader.hidden  = false;
  modeToggles.hidden = true;
  backBtn.textContent   = '中断';
  submitBtn.textContent = '回答する';

  testQNum.textContent   = `問題 ${idx + 1} / 8`;
  testBadge1.textContent = q.playMode === 'simul' ? '同時' : '交互';
  testBadge2.textContent = q.moveMode === 'upper' ? '上を動かす' : '下を動かす';

  setupGame(q.iv);
  showSection(secPlay);
}

function submitTestAnswer() {
  stopAudio();
  const dev   = cents - testQuestions[testQIdx].iv.cents;
  const score = Math.round(Math.max(0, 100 - Math.abs(dev) * 2) * 10) / 10;
  testAnswers.push({ ...testQuestions[testQIdx], cents, dev, score });

  testQIdx++;
  const isLast = testQIdx >= 8;

  // Show per-question result before continuing
  showResultScreen({
    score, dev,
    showRetry: false, showTweet: false,
    nextLabel: isLast ? '結果を見る' : `次の問題（${testQIdx}/8）→`,
    onNext: isLast ? showTestResult : () => playTestQuestion(testQIdx),
  });
}

function showTestResult() {
  showSection(secTestResult);

  const total = Math.round(testAnswers.reduce((s, a) => s + a.score, 0) * 10) / 10;
  const avg   = Math.round(total / 8 * 10) / 10;
  const { grade, color } = gradeFromAvg(avg);

  const tsn = document.getElementById('testScoreNum');
  const tsg = document.getElementById('testScoreGrade');
  setScoreDisplay(tsn, total);
  tsn.style.color   = color;
  tsg.textContent   = `${grade}（平均 ${avg.toFixed(1)}点）`;
  tsg.style.color   = color;
  tsn.style.animation = 'none';
  requestAnimationFrame(() => { tsn.style.animation = ''; });

  // Group labels for table header
  const comboLabels = ['同時・上', '同時・上', '同時・下', '同時・下',
                       '交互・上', '交互・上', '交互・下', '交互・下'];

  const rows = testAnswers.map((a, i) => {
    const sign = a.dev >= 0 ? '+' : '';
    const dc   = scoreColor(Math.abs(a.dev));
    const pl   = a.playMode === 'simul' ? '同時' : '交互';
    const ml   = a.moveMode === 'upper' ? '上' : '下';
    return `<tr>
      <td class="tc-q">${i + 1}</td>
      <td class="tc-mode"><span class="tbadge">${pl}</span><span class="tbadge">${ml}</span></td>
      <td class="tc-dev" style="color:${dc}">${sign}${a.dev.toFixed(1)}¢</td>
      <td class="tc-sc">${a.score}</td>
    </tr>`;
  }).join('');

  document.getElementById('testTable').innerHTML =
    `<thead><tr><th>#</th><th>モード</th><th>ずれ</th><th>点</th></tr></thead>` +
    `<tbody>${rows}</tbody>`;

  const ivName = testAnswers[0].iv.name;
  const tweetText = buildTestTweet(ivName, total, avg, testAnswers);
  document.getElementById('testTweetBtn').onclick = () =>
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
}

function buildTestTweet(ivName, total, avg, answers) {
  // Pairs: [0,1]=simul+upper, [2,3]=simul+base, [4,5]=alt+upper, [6,7]=alt+base
  const groups = [
    { label: '同時・上', idx: [0,1] },
    { label: '同時・下', idx: [2,3] },
    { label: '交互・上', idx: [4,5] },
    { label: '交互・下', idx: [6,7] },
  ];
  const lines = groups.map(g =>
    `${g.label}: ${g.idx.map(i => answers[i].score + '点').join(' / ')}`
  );
  return [
    `🎵 相対音感テスト「${ivName}」`,
    `合計 ${total.toFixed(1)} / 800点（平均 ${avg.toFixed(1)}点）`,
    ...lines,
    '#相対音感テスト',
  ].join('\n');
}


// ===== SLIDER CONTROL =====

// delta > 0 always means "active note goes UP" (slider right):
//   upper mode: upper note up  → cents increases
//   base  mode: base  note up  → cents decreases (interval shrinks)
function applyDelta(delta) {
  const intervalDelta = moveMode === 'base' ? -delta : delta;
  cents = Math.max(sliderMin, Math.min(sliderMax,
    snapToGrid(cents + intervalDelta, targetIv.cents)));
  syncSlider();
  if (isPlaying) updatePitch();
}

pitchSlider.addEventListener('input', () => {
  const raw = centsFromSliderPos(parseFloat(pitchSlider.value));
  cents = Math.max(sliderMin, Math.min(sliderMax, snapToGrid(raw, targetIv.cents)));
  syncSlider();
  if (isPlaying) updatePitch();
});

pitchSlider.addEventListener('wheel', e => {
  e.preventDefault();
  applyDelta(e.deltaY > 0 ? -1 : 1);
}, { passive: false });

pitchSlider.addEventListener('keydown', e => {
  let step = 0;
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp')   step =  (e.shiftKey ? 10 : 1);
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowDown') step = -(e.shiftKey ? 10 : 1);
  if (!step) return;
  e.preventDefault();
  applyDelta(step);
});


// ===== BUTTON EVENTS =====

document.querySelectorAll('#modeTabs .tab').forEach(t =>
  t.addEventListener('click', () => setAppMode(t.dataset.mode))
);
document.querySelectorAll('#tuningTabs .tab').forEach(t =>
  t.addEventListener('click', () => setTab(t.dataset.tab))
);
document.querySelectorAll('.mode-btn[data-mode]').forEach(btn =>
  btn.addEventListener('click', () => setPlayMode(btn.dataset.mode))
);
document.querySelectorAll('.move-btn').forEach(btn =>
  btn.addEventListener('click', () => setMoveMode(btn.dataset.move))
);

document.querySelectorAll('.fine-btn').forEach(btn => {
  const delta = parseFloat(btn.dataset.delta);
  btn.addEventListener('click', () => applyDelta(delta));
  let holdTimer, holdInterval;
  const startHold = () => {
    holdTimer = setTimeout(() => {
      holdInterval = setInterval(() => applyDelta(delta), 80);
    }, 400);
  };
  const stopHold = () => { clearTimeout(holdTimer); clearInterval(holdInterval); };
  btn.addEventListener('pointerdown', startHold);
  btn.addEventListener('pointerup',   stopHold);
  btn.addEventListener('pointerout',  stopHold);
});

playBtn.addEventListener('click', () => {
  if (isPlaying) stopAudio(); else startAudio();
});

submitBtn.addEventListener('click', () => {
  if (appMode === 'test') submitTestAnswer();
  else showLearnResult();
});

backBtn.addEventListener('click', () => {
  stopAudio();
  showSection(secHome);
});

// nextBtn handler is set dynamically by showResultScreen
nextBtn.addEventListener('click', () => {
  if (typeof nextBtn._onNext === 'function') nextBtn._onNext();
});

retryBtn.addEventListener('click', () => {
  startLearnGame(targetIv);
});

document.getElementById('testRetryBtn').addEventListener('click', () => {
  startTestForInterval(testAnswers[0].iv);
});
document.getElementById('testHomeBtn').addEventListener('click', () => {
  showSection(secHome);
});


// ===== INIT =====

renderGrid('just');
