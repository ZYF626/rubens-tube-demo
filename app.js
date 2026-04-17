// ===============================
// 鲁本斯管比赛版仿真 - app.js
// PPT 内嵌优化版：点击“进入仿真”后再真正启动
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

// 进入仿真封面层
const enterSimBtn = document.getElementById("enterSimBtn");
const entryScreen = document.getElementById("entry-screen");

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

// ---------- 三、启动控制 ----------
let hasStarted = false;   // 是否已经点击“进入仿真”
let canvasReady = false;  // 是否已经真正创建 canvas

// ---------- 四、常用工具函数 ----------
function resonanceFrequency(n) {
  return n * state.soundSpeed / (2 * state.tubeLength);
}

function halfLambda(n) {
  return state.tubeLength / n;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothApproach(current, target, speed) {
  return current + (target - current) * speed;
}

// ---------- 五、初始化火焰数组 ----------
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

// ---------- 六、更新 HUD ----------
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

// ---------- 七、按钮事件 ----------
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

// ---------- 八、p5.js 初始化 ----------
// 一开始不创建画布，不启动循环
function setup() {
  noCanvas();
  noLoop();
  updateHUD();
}

// ---------- 九、点击后真正启动仿真 ----------
function startRubensSimulation() {
  if (hasStarted) return;

  hasStarted = true;

  const holder = document.getElementById("canvas-holder");
  const rect = holder.getBoundingClientRect();

  state.canvasW = rect.width;
  state.canvasH = rect.height;

  const canvas = createCanvas(state.canvasW, state.canvasH);
  canvas.parent("canvas-holder");

  initFlames();
  updateHUD();

  canvasReady = true;
  loop();
}

// ---------- 十、按钮绑定 ----------
document.addEventListener("DOMContentLoaded", () => {
  updateHUD();

  if (enterSimBtn) {
    enterSimBtn.addEventListener("click", () => {
      enterSimBtn.disabled = true;
      enterSimBtn.textContent = "正在进入...";

      requestAnimationFrame(() => {
        startRubensSimulation();

        setTimeout(() => {
          if (entryScreen) {
            entryScreen.classList.add("hide");
          }
        }, 120);
      });
    });
  }
});

// ---------- 十一、窗口尺寸变化 ----------
function windowResized() {
  if (!canvasReady) return;

  const holder = document.getElementById("canvas-holder");
  const rect = holder.getBoundingClientRect();

  state.canvasW = rect.width;
  state.canvasH = rect.height;

  resizeCanvas(state.canvasW, state.canvasH);
}

// ---------- 十二、计算图样强度 ----------
function computePatternStrength(xNorm, mode, clarity) {
  let basePattern = Math.abs(Math.cos(mode * Math.PI * xNorm));

  if (state.invertPattern) {
    basePattern = 1 - basePattern;
  }

  const flattened = 0.55;
  return flattened + (basePattern - flattened) * clarity;
}

// ---------- 十三、更新火焰目标高度 ----------
function updateFlameTargets() {
  const f = Number(freqSlider.value);
  const mode = Number(modeSlider.value);
  const ampLevel = Number(ampSlider.value);

  const fn = resonanceFrequency(mode);
  const detune = Math.abs(f - fn);
  const width = 25 + mode * 5;
  const clarity = Math.exp(-Math.pow(detune / width, 2));

  const baseHeight = 38;
  const ampPixels = map(ampLevel, 20, 100, 40, 170);

  for (let i = 0; i < state.holeCount; i++) {
    const xNorm = i / (state.holeCount - 1);
    const strength = computePatternStrength(xNorm, mode, clarity);

    const target = baseHeight + ampPixels * strength;
    state.flames[i].targetHeight = target;
  }
}

// ---------- 十四、平滑动画 ----------
function animateFlames() {
  for (const flame of state.flames) {
    flame.currentHeight = smoothApproach(flame.currentHeight, flame.targetHeight, 0.09);
  }
}

// ---------- 十五、画背景 ----------
function drawBackgroundGlow() {
  background(3, 7, 13);

  noStroke();

  fill(20, 60, 110, 30);
  ellipse(width * 0.5, height * 0.12, width * 0.9, height * 0.35);

  fill(35, 70, 120, 16);
  ellipse(width * 0.5, height * 0.58, width * 0.8, height * 0.7);
}

// ---------- 十六、画金属管 ----------
function drawTube(tubeX, tubeY, tubeW, tubeH) {
  const ctx = drawingContext;

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

  stroke(255, 255, 255, 55);
  strokeWeight(2);
  line(tubeX + 20, tubeY + 12, tubeX + tubeW - 20, tubeY + 12);

  stroke(0, 0, 0, 70);
  strokeWeight(2);
  line(tubeX + 16, tubeY + tubeH - 10, tubeX + tubeW - 16, tubeY + tubeH - 10);

  noStroke();
}

// ---------- 十七、画喷孔 ----------
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

// ---------- 十八、画单根火焰 ----------
function drawFlame(x, baseY, flameHeight, idx, timeSec) {
  const flicker =
    Math.sin(timeSec * 8 + idx * 0.35 + state.flames[idx].phase) * 2.8 +
    noise(idx * 0.14, timeSec * 1.8) * 4.0;

  const h = Math.max(12, flameHeight + flicker);
  const w = map(h, 20, 220, 6, 14);

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
    x, baseY - h
  );
  bezierVertex(
    x + w * 1.0, baseY - h * 0.82,
    x + w * 1.4, baseY - h * 0.30,
    x, baseY
  );
  endShape(CLOSE);

  drawingContext.restore();

  fill(255, 138, 28, 170);
  beginShape();
  vertex(x, baseY);
  bezierVertex(
    x - w, baseY - h * 0.28,
    x - w * 0.75, baseY - h * 0.78,
    x, baseY - h * 0.96
  );
  bezierVertex(
    x + w * 0.75, baseY - h * 0.78,
    x + w, baseY - h * 0.28,
    x, baseY
  );
  endShape(CLOSE);

  fill(255, 235, 150, 180);
  beginShape();
  vertex(x, baseY - 2);
  bezierVertex(
    x - w * 0.42, baseY - h * 0.25,
    x - w * 0.22, baseY - h * 0.62,
    x, baseY - h * 0.78
  );
  bezierVertex(
    x + w * 0.22, baseY - h * 0.62,
    x + w * 0.42, baseY - h * 0.25,
    x, baseY - 2
  );
  endShape(CLOSE);
}

// ---------- 十九、画辅助层 ----------
function drawOverlay(tubeX, tubeY, tubeW, flameBaseY) {
  if (!state.showOverlay) return;

  const mode = Number(modeSlider.value);
  const segW = tubeW / mode;

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

  const arrowY = tubeY - 140;
  const arrowX1 = tubeX;
  const arrowX2 = tubeX + segW;

  stroke(255, 220, 120, 180);
  strokeWeight(2);
  line(arrowX1, arrowY, arrowX2, arrowY);

  line(arrowX1, arrowY, arrowX1 + 10, arrowY - 6);
  line(arrowX1, arrowY, arrowX1 + 10, arrowY + 6);

  line(arrowX2, arrowY, arrowX2 - 10, arrowY - 6);
  line(arrowX2, arrowY, arrowX2 - 10, arrowY + 6);

  noStroke();
  fill(255, 235, 170);
  textAlign(CENTER, CENTER);
  textSize(15);
  text("相邻同类点间距 = λ / 2", (arrowX1 + arrowX2) / 2, arrowY - 16);

  fill(180, 205, 240, 200);
  textSize(13);
  text(
    "注：这是课堂展示用可视化模型，重点是把驻波的空间周期分布看清楚。",
    width / 2,
    26
  );
}

// ---------- 二十、主循环 draw ----------
function draw() {
  if (!hasStarted || !canvasReady) return;

  if (state.autoSweep) {
    const t = millis() * 0.001;
    const minF = Number(freqSlider.min);
    const maxF = Number(freqSlider.max);

    const autoF = map(Math.sin(t * 0.45), -1, 1, minF, maxF);
    freqSlider.value = Math.round(autoF);
    updateHUD();
  }

  updateFlameTargets();
  animateFlames();
  drawBackgroundGlow();

  const tubeW = width * 0.84;
  const tubeH = 54;
  const tubeX = (width - tubeW) / 2;
  const tubeY = height * 0.70;
  const flameBaseY = tubeY + 4;

  const startX = tubeX + 24;
  const endX = tubeX + tubeW - 24;
  const timeSec = millis() * 0.001;

  for (let i = 0; i < state.holeCount; i++) {
    const x = map(i, 0, state.holeCount - 1, startX, endX);
    drawFlame(x, flameBaseY, state.flames[i].currentHeight, i, timeSec);
  }

  drawTube(tubeX, tubeY, tubeW, tubeH);
  drawNozzles(tubeX, tubeY, tubeW);

  noStroke();
  fill(220, 235, 255, 220);
  textAlign(CENTER, CENTER);
  textSize(18);
  text("拖动频率，观察驻波图样逐渐出现；点击“一键共振”可快速进入清晰模式", width / 2, height - 26);

  drawOverlay(tubeX, tubeY, tubeW, flameBaseY);
}