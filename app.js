// ===============================
// 鲁本斯管比赛版仿真 - app.js
// ===============================

// ---------- 一、先拿到 HTML 里的控件 ----------
const freqSlider = document.getElementById("freqSlider");
const ampSlider = document.getElementById("ampSlider");
const modeSlider = document.getElementById("modeSlider");

const snapBtn = document.getElementById("snapBtn");
const autoBtn = document.getElementById("autoBtn");
const overlayBtn = document.getElementById("overlayBtn");
const resetBtn = document.getElementById("resetBtn");

const freqValue = document.getElementById("freqValue");
const modeValue = document.getElementById("modeValue");
const resValue = document.getElementById("resValue");
const halfLambdaValue = document.getElementById("halfLambdaValue");

// ---------- 二、整个仿真的“全局状态” ----------
const state = {
  tubeLength: 1.2,       // 管长（米），这里是演示用参数
  soundSpeed: 340,       // 声速（m/s），先固定成空气近似值
  holeCount: 64,         // 喷孔数量
  showOverlay: true,     // 是否显示物理辅助层
  autoSweep: false,      // 是否自动扫频
  invertPattern: false,  // 是否把火焰图样反过来
  flames: [],            // 存每个火焰的数据
  canvasW: 1200,
  canvasH: 640
};

// ---------- 三、常用工具函数 ----------

// 共振频率：f_n = n * v / (2L)
// 这是两端封闭/压力驻波可视化里常用的演示关系
function resonanceFrequency(n) {
  return n * state.soundSpeed / (2 * state.tubeLength);
}

// 半波长：lambda / 2 = L / n
function halfLambda(n) {
  return state.tubeLength / n;
}

// 把数值限制在某个范围内
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// 让动画“慢慢逼近目标值”，看起来更顺滑
function smoothApproach(current, target, speed) {
  return current + (target - current) * speed;
}

// ---------- 四、初始化火焰数组 ----------
// 这里每一根火焰都记住自己的当前高度、目标高度、相位
function initFlames() {
  state.flames = [];

  for (let i = 0; i < state.holeCount; i++) {
    state.flames.push({
      currentHeight: 60,
      targetHeight: 60,
      phase: Math.random() * 1000
    });
  }
}

// ---------- 五、更新右下角数值 ----------
function updateHUD() {
  const f = Number(freqSlider.value);
  const n = Number(modeSlider.value);
  const fn = resonanceFrequency(n);
  const hl = halfLambda(n);

  freqValue.textContent = f.toFixed(0);
  modeValue.textContent = n.toFixed(0);
  resValue.textContent = fn.toFixed(0);
  halfLambdaValue.textContent = hl.toFixed(2);
}

// ---------- 六、按钮事件 ----------
snapBtn.addEventListener("click", () => {
  const n = Number(modeSlider.value);
  const fn = resonanceFrequency(n);
  freqSlider.value = clamp(Math.round(fn), Number(freqSlider.min), Number(freqSlider.max));
  updateHUD();
});

autoBtn.addEventListener("click", () => {
  state.autoSweep = !state.autoSweep;
  autoBtn.textContent = state.autoSweep ? "自动扫频：开" : "自动扫频：关";
});

overlayBtn.addEventListener("click", () => {
  state.showOverlay = !state.showOverlay;
  overlayBtn.textContent = state.showOverlay ? "物理辅助层：开" : "物理辅助层：关";
});

resetBtn.addEventListener("click", () => {
  freqSlider.value = 250;
  ampSlider.value = 72;
  modeSlider.value = 2;
  state.autoSweep = false;
  state.showOverlay = true;

  autoBtn.textContent = "自动扫频：关";
  overlayBtn.textContent = "物理辅助层：开";

  updateHUD();
});

freqSlider.addEventListener("input", updateHUD);
ampSlider.addEventListener("input", updateHUD);
modeSlider.addEventListener("input", updateHUD);

// ---------- 七、p5.js 的 setup ----------
// setup 只执行一次：创建画布、初始化火焰
function setup() {
  const holder = document.getElementById("canvas-holder");
  const rect = holder.getBoundingClientRect();

  state.canvasW = rect.width;
  state.canvasH = rect.height;

  const canvas = createCanvas(state.canvasW, state.canvasH);
  canvas.parent("canvas-holder");

  initFlames();
  updateHUD();
}

// ---------- 八、窗口尺寸变化时，自适应 ----------
function windowResized() {
  const holder = document.getElementById("canvas-holder");
  const rect = holder.getBoundingClientRect();

  state.canvasW = rect.width;
  state.canvasH = rect.height;

  resizeCanvas(state.canvasW, state.canvasH);
}

// ---------- 九、计算某个位置上的“图样强度” ----------
// 这里我们不做科研级燃烧模拟，而是做比赛展示用的可视化模型。
// 思路是：频率越接近该模态共振频率，空间图样越清晰；离得远就越平。
function computePatternStrength(xNorm, mode, clarity) {
  // 压力型空间分布的简化可视化模型
  let basePattern = Math.abs(Math.cos(mode * Math.PI * xNorm));

  // 如果需要把图样反过来，这里只改一行
  if (state.invertPattern) {
    basePattern = 1 - basePattern;
  }

  // clarity 越小，图样越接近平坦；clarity 越大，图样越明显
  const flattened = 0.55;
  return flattened + (basePattern - flattened) * clarity;
}

// ---------- 十、更新每根火焰的目标高度 ----------
function updateFlameTargets() {
  const f = Number(freqSlider.value);
  const mode = Number(modeSlider.value);
  const ampLevel = Number(ampSlider.value);

  const fn = resonanceFrequency(mode);

  // detune = 当前频率离目标共振频率有多远
  const detune = Math.abs(f - fn);

  // 这里控制“靠近共振时突然变清晰”的感觉
  // 数字越小，共振吸附越明显；数字越大，容忍范围越宽
  const width = 25 + mode * 5;

  // 用高斯型方式做清晰度
  const clarity = Math.exp(-Math.pow(detune / width, 2));

  // 把滑块数值转成像素高度
  const baseHeight = 38;
  const ampPixels = map(ampLevel, 20, 100, 40, 170);

  for (let i = 0; i < state.holeCount; i++) {
    const xNorm = i / (state.holeCount - 1);
    const strength = computePatternStrength(xNorm, mode, clarity);

    const target = baseHeight + ampPixels * strength;
    state.flames[i].targetHeight = target;
  }
}

// ---------- 十一、把当前高度慢慢逼近目标高度 ----------
function animateFlames() {
  for (const flame of state.flames) {
    flame.currentHeight = smoothApproach(flame.currentHeight, flame.targetHeight, 0.09);
  }
}

// ---------- 十二、画背景 ----------
function drawBackgroundGlow() {
  background(3, 7, 13);

  noStroke();

  // 上方蓝色氛围
  fill(20, 60, 110, 30);
  ellipse(width * 0.5, height * 0.12, width * 0.9, height * 0.35);

  // 中央浅亮区域
  fill(35, 70, 120, 16);
  ellipse(width * 0.5, height * 0.58, width * 0.8, height * 0.7);
}

// ---------- 十三、画金属管 ----------
function drawTube(tubeX, tubeY, tubeW, tubeH) {
  const ctx = drawingContext;

  // 管体阴影
  ctx.save();
  ctx.shadowBlur = 24;
  ctx.shadowColor = "rgba(0,0,0,0.55)";

  const grad = ctx.createLinearGradient(tubeX, tubeY, tubeX, tubeY + tubeH);
  grad.addColorStop(0, "#7a8597");
  grad.addColorStop(0.18, "#d6dceb");
  grad.addColorStop(0.38, "#8b94a7");
  grad.addColorStop(0.62, "#5d6778");
  grad.addColorStop(1, "#2a303a");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(tubeX, tubeY, tubeW, tubeH, 18);
  ctx.fill();

  ctx.restore();

  // 高光线
  stroke(255, 255, 255, 55);
  strokeWeight(2);
  line(tubeX + 20, tubeY + 12, tubeX + tubeW - 20, tubeY + 12);

  // 底部暗线
  stroke(0, 0, 0, 70);
  strokeWeight(2);
  line(tubeX + 16, tubeY + tubeH - 10, tubeX + tubeW - 16, tubeY + tubeH - 10);

  noStroke();
}

// ---------- 十四、画喷孔 ----------
function drawNozzles(tubeX, tubeY, tubeW) {
  const startX = tubeX + 24;
  const endX = tubeX + tubeW - 24;
  const nozzleY = tubeY + 6;

  for (let i = 0; i < state.holeCount; i++) {
    const x = map(i, 0, state.holeCount - 1, startX, endX);
    fill(25, 35, 48);
    ellipse(x, nozzleY, 5.2, 3.2);
  }
}

// ---------- 十五、画单根火焰 ----------
// 做法：外层大辉光 + 中层橙色 + 内层亮黄
function drawFlame(x, baseY, flameHeight, idx, timeSec) {
  const flicker =
    Math.sin(timeSec * 8 + idx * 0.35 + state.flames[idx].phase) * 2.8 +
    noise(idx * 0.14, timeSec * 1.8) * 4.0;

  const h = Math.max(12, flameHeight + flicker);

  // 火焰宽度随高度略变
  const w = map(h, 20, 220, 6, 14);

  // ---- 外层辉光 ----
  noStroke();
  drawingContext.save();
  drawingContext.shadowBlur = 20;
  drawingContext.shadowColor = "rgba(255, 140, 30, 0.45)";

  fill(255, 120, 20, 30);
  beginShape();
  vertex(x, baseY);
  bezierVertex(
    x - w * 1.4, baseY - h * 0.30,
    x - w * 1.0, baseY - h * 0.82,
    x,          baseY - h
  );
  bezierVertex(
    x + w * 1.0, baseY - h * 0.82,
    x + w * 1.4, baseY - h * 0.30,
    x,          baseY
  );
  endShape(CLOSE);

  drawingContext.restore();

  // ---- 中层火焰 ----
  fill(255, 138, 28, 170);
  beginShape();
  vertex(x, baseY);
  bezierVertex(
    x - w,      baseY - h * 0.28,
    x - w * 0.75, baseY - h * 0.78,
    x,          baseY - h * 0.96
  );
  bezierVertex(
    x + w * 0.75, baseY - h * 0.78,
    x + w,      baseY - h * 0.28,
    x,          baseY
  );
  endShape(CLOSE);

  // ---- 内层亮芯 ----
  fill(255, 235, 150, 180);
  beginShape();
  vertex(x, baseY - 2);
  bezierVertex(
    x - w * 0.42, baseY - h * 0.25,
    x - w * 0.22, baseY - h * 0.62,
    x,            baseY - h * 0.78
  );
  bezierVertex(
    x + w * 0.22, baseY - h * 0.62,
    x + w * 0.42, baseY - h * 0.25,
    x,            baseY - 2
  );
  endShape(CLOSE);
}

// ---------- 十六、画辅助层 ----------
// 包括：节点参考线、半波长标尺、文字说明
function drawOverlay(tubeX, tubeY, tubeW, flameBaseY) {
  if (!state.showOverlay) return;

  const mode = Number(modeSlider.value);
  const segW = tubeW / mode;

  // 1. 节点参考线（对于当前简化图样而言的最低点位置）
  stroke(110, 190, 255, 120);
  strokeWeight(1.3);

  for (let i = 0; i < mode; i++) {
    const nodeX = tubeX + segW * (i + 0.5);

    drawingContext.save();
    drawingContext.setLineDash([6, 6]);
    line(nodeX, tubeY - 190, nodeX, flameBaseY + 26);
    drawingContext.restore();

    noStroke();
    fill(150, 220, 255, 210);
    textAlign(CENTER, CENTER);
    textSize(13);
    text("节点", nodeX, tubeY - 205);

    stroke(110, 190, 255, 120);
    strokeWeight(1.3);
  }

  // 2. 画一个“半波长”标尺
  const arrowY = tubeY - 140;
  const arrowX1 = tubeX;
  const arrowX2 = tubeX + segW;

  stroke(255, 220, 120, 180);
  strokeWeight(2);
  line(arrowX1, arrowY, arrowX2, arrowY);

  // 左箭头
  line(arrowX1, arrowY, arrowX1 + 10, arrowY - 6);
  line(arrowX1, arrowY, arrowX1 + 10, arrowY + 6);

  // 右箭头
  line(arrowX2, arrowY, arrowX2 - 10, arrowY - 6);
  line(arrowX2, arrowY, arrowX2 - 10, arrowY + 6);

  noStroke();
  fill(255, 235, 170);
  textAlign(CENTER, CENTER);
  textSize(15);
  text("相邻同类点间距 = λ / 2", (arrowX1 + arrowX2) / 2, arrowY - 16);

  // 3. 说明小字
  fill(180, 205, 240, 200);
  textSize(13);
  text(
    "注：这是课堂展示用可视化模型，重点是把驻波的空间周期分布看清楚。",
    width / 2,
    26
  );
}

// ---------- 十七、主循环 draw ----------
// draw 每一帧都会执行，负责动画
function draw() {
  // 自动扫频
  if (state.autoSweep) {
    const t = millis() * 0.001;
    const minF = Number(freqSlider.min);
    const maxF = Number(freqSlider.max);

    // 用正弦函数来回扫频
    const autoF = map(Math.sin(t * 0.45), -1, 1, minF, maxF);
    freqSlider.value = Math.round(autoF);
    updateHUD();
  }

  updateFlameTargets();
  animateFlames();
  drawBackgroundGlow();

  // ---------- 画布里主要区域参数 ----------
  const tubeW = width * 0.84;
  const tubeH = 54;
  const tubeX = (width - tubeW) / 2;
  const tubeY = height * 0.70;

  const flameBaseY = tubeY + 4;

  // ---------- 先画火焰 ----------
  const startX = tubeX + 24;
  const endX = tubeX + tubeW - 24;
  const timeSec = millis() * 0.001;

  for (let i = 0; i < state.holeCount; i++) {
    const x = map(i, 0, state.holeCount - 1, startX, endX);
    drawFlame(x, flameBaseY, state.flames[i].currentHeight, i, timeSec);
  }

  // ---------- 再画管体和喷孔 ----------
  drawTube(tubeX, tubeY, tubeW, tubeH);
  drawNozzles(tubeX, tubeY, tubeW);

  // ---------- 再画标题说明 ----------
  noStroke();
  fill(220, 235, 255, 220);
  textAlign(CENTER, CENTER);
  textSize(18);
  text("拖动频率，观察驻波图样逐渐出现；点击“一键共振”可快速进入清晰模式", width / 2, height - 26);

  // ---------- 最后画辅助层 ----------
  drawOverlay(tubeX, tubeY, tubeW, flameBaseY);
}