import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../canvas-transform";

const W = CANVAS_WIDTH;
const H = CANVAS_HEIGHT;
const BORDER = 22;

export type TimeOfDay = "day" | "dawn" | "night";

export function getTimeOfDay(): TimeOfDay {
  // Pacific time (America/Los_Angeles)
  const now = new Date();
  const pacific = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
  );
  const hour = pacific.getHours();
  if (hour >= 8 && hour < 18) return "day";
  if ((hour >= 6 && hour < 8) || (hour >= 18 && hour < 20)) return "dawn";
  return "night";
}

const TIME_TINTS: Record<TimeOfDay, { color: string; opacity: number; skyColors: string[] }> = {
  day: {
    color: "",
    opacity: 0,
    skyColors: ["#88aadd", "#99bbee", "#aaccee"],
  },
  dawn: {
    color: "#ff8844",
    opacity: 0.15,
    skyColors: ["#cc7755", "#dd8866", "#ee9977"],
  },
  night: {
    color: "#112244",
    opacity: 0.35,
    skyColors: ["#1a2244", "#222a4e", "#2a3358"],
  },
};

export const BUILDING_X = BORDER;
export const BUILDING_Y = BORDER + 4;
export const BUILDING_W = W - BORDER * 2;
export const BUILDING_H = H - BORDER * 2 - 4;
export const FLOOR_Y = BUILDING_Y + 26;
export const FLOOR_H = BUILDING_H - 26;

function rect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

let seed = 42;
function srand(): number {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

function drawSky(ctx: CanvasRenderingContext2D, tod: TimeOfDay) {
  const sky = TIME_TINTS[tod].skyColors;
  rect(ctx, 0, 0, W, 8, sky[0]);
  rect(ctx, 0, 8, W, 8, sky[1]);
  rect(ctx, 0, 16, W, 10, sky[2]);

  // Stars at night
  if (tod === "night") {
    seed = 777;
    for (let i = 0; i < 12; i++) {
      px(ctx, Math.floor(srand() * W), Math.floor(srand() * 18), "#ffffff");
    }
  }
}

function drawMountain(
  ctx: CanvasRenderingContext2D,
  cx: number,
  peak: number,
  base: number,
  halfWidth: number,
  bodyColor: string,
  snowColor: string | null
) {
  for (let y = peak; y <= base; y++) {
    const progress = (y - peak) / (base - peak);
    const w2 = Math.floor(halfWidth * progress);
    rect(ctx, cx - w2, y, w2 * 2, 1, bodyColor);
  }
  if (snowColor) {
    const snowHeight = Math.floor((base - peak) * 0.2);
    for (let y = peak; y < peak + snowHeight; y++) {
      const progress = (y - peak) / (base - peak);
      const w2 = Math.floor(halfWidth * progress);
      rect(ctx, cx - w2, y, w2 * 2, 1, snowColor);
    }
  }
}

function drawGrass(ctx: CanvasRenderingContext2D) {
  for (let ty = 20; ty < H; ty += 8) {
    for (let tx = 0; tx < W; tx += 8) {
      rect(ctx, tx, ty, 8, 8, (tx / 8 + ty / 8) % 2 === 0 ? "#4a9050" : "#449048");
    }
  }
  seed = 100;
  for (let i = 0; i < 80; i++) {
    rect(ctx, Math.floor(srand() * W), 20 + Math.floor(srand() * (H - 20)), 1, 2, "#55a858");
  }
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, gy: number, variant: number) {
  const v = variant % 4;
  if (v === 0) {
    rect(ctx, x - 1, gy - 3, 2, 3, "#3a5520");
    rect(ctx, x - 3, gy - 6, 6, 4, "#2a7733");
    rect(ctx, x - 2, gy - 7, 4, 2, "#338844");
    rect(ctx, x - 1, gy - 8, 2, 1, "#44aa55");
  } else if (v === 1) {
    rect(ctx, x - 1, gy - 5, 2, 5, "#553311");
    rect(ctx, x, gy - 4, 1, 4, "#664422");
    rect(ctx, x - 5, gy - 11, 10, 5, "#2a6633");
    rect(ctx, x - 4, gy - 13, 8, 3, "#338844");
    rect(ctx, x - 3, gy - 14, 6, 2, "#44aa55");
    rect(ctx, x - 2, gy - 12, 2, 2, "#55bb66");
  } else if (v === 2) {
    rect(ctx, x - 1, gy - 8, 2, 8, "#553311");
    rect(ctx, x, gy - 6, 1, 6, "#664422");
    rect(ctx, x - 6, gy - 16, 12, 6, "#1a5522");
    rect(ctx, x - 7, gy - 14, 14, 4, "#2a6633");
    rect(ctx, x - 5, gy - 19, 10, 4, "#338844");
    rect(ctx, x - 3, gy - 21, 6, 3, "#44aa55");
    rect(ctx, x - 2, gy - 18, 2, 2, "#55bb66");
  } else {
    rect(ctx, x, gy - 6, 2, 6, "#553311");
    rect(ctx, x - 3, gy - 14, 8, 3, "#2a6633");
    rect(ctx, x - 2, gy - 11, 6, 3, "#2a6633");
    rect(ctx, x - 2, gy - 13, 5, 2, "#338844");
    rect(ctx, x - 1, gy - 16, 4, 3, "#44aa55");
    rect(ctx, x, gy - 17, 2, 2, "#55bb66");
  }
}

function drawFlames(ctx: CanvasRenderingContext2D, fpx: number, fpy: number, frame: number) {
  // 5 distinct flame frames, cycling at ~2Hz (every 8 canvas frames at 30fps)
  // Hearth interior: fpx+5..fpx+19, fpy+7..fpy+22
  // Flames sit small and low above the logs, organic shapes not triangles
  const f = Math.floor(frame / 8) % 5;

  // Logs (static base)
  rect(ctx, fpx + 6, fpy + 19, 12, 2, "#553311");
  rect(ctx, fpx + 7, fpy + 18, 4, 2, "#664422");
  rect(ctx, fpx + 13, fpy + 18, 4, 2, "#664422");

  if (f === 0) {
    // Center blob with left tongue
    rect(ctx, fpx + 8, fpy + 15, 8, 3, "#aa3300");
    rect(ctx, fpx + 9, fpy + 14, 6, 3, "#cc4411");
    rect(ctx, fpx + 7, fpy + 14, 2, 2, "#cc4411"); // left bulge
    rect(ctx, fpx + 10, fpy + 13, 4, 2, "#ee6622");
    rect(ctx, fpx + 11, fpy + 12, 2, 2, "#ffaa33");
    px(ctx, fpx + 8, fpy + 13, "#ee6622"); // left tongue tip
    px(ctx, fpx + 11, fpy + 11, "#ffdd66");
    // Embers
    px(ctx, fpx + 7, fpy + 20, "#ff8833");
    px(ctx, fpx + 14, fpy + 20, "#cc4400");
  } else if (f === 1) {
    // Leans right, wider middle
    rect(ctx, fpx + 8, fpy + 15, 8, 3, "#aa3300");
    rect(ctx, fpx + 10, fpy + 14, 6, 3, "#cc4411");
    rect(ctx, fpx + 15, fpy + 15, 2, 2, "#aa3300"); // right bulge
    rect(ctx, fpx + 11, fpy + 13, 4, 2, "#ee6622");
    rect(ctx, fpx + 12, fpy + 12, 3, 2, "#ffaa33");
    px(ctx, fpx + 13, fpy + 11, "#ffdd66");
    // Embers
    px(ctx, fpx + 15, fpy + 20, "#ffaa44");
    px(ctx, fpx + 11, fpy + 20, "#ff6622");
  } else if (f === 2) {
    // Low wide smolder, two bumps
    rect(ctx, fpx + 7, fpy + 15, 10, 3, "#aa3300");
    rect(ctx, fpx + 8, fpy + 14, 8, 3, "#cc4411");
    rect(ctx, fpx + 9, fpy + 13, 3, 2, "#ee6622"); // left bump
    rect(ctx, fpx + 13, fpy + 13, 2, 2, "#ee6622"); // right bump
    px(ctx, fpx + 10, fpy + 12, "#ffaa33");
    px(ctx, fpx + 13, fpy + 12, "#ffaa33");
    // Embers
    px(ctx, fpx + 7, fpy + 20, "#ff8833");
    px(ctx, fpx + 15, fpy + 20, "#ffaa44");
    px(ctx, fpx + 11, fpy + 20, "#ff6622");
  } else if (f === 3) {
    // Leans left with right tongue
    rect(ctx, fpx + 8, fpy + 15, 8, 3, "#aa3300");
    rect(ctx, fpx + 8, fpy + 14, 6, 3, "#cc4411");
    rect(ctx, fpx + 14, fpy + 14, 2, 2, "#cc4411"); // right tongue
    rect(ctx, fpx + 9, fpy + 13, 4, 2, "#ee6622");
    rect(ctx, fpx + 9, fpy + 12, 2, 2, "#ffaa33");
    px(ctx, fpx + 15, fpy + 13, "#ee6622"); // tongue tip
    px(ctx, fpx + 10, fpy + 11, "#ffdd66");
    // Embers
    px(ctx, fpx + 7, fpy + 20, "#ff8833");
    px(ctx, fpx + 11, fpy + 20, "#cc4400");
  } else {
    // Split flame — two small peaks
    rect(ctx, fpx + 8, fpy + 15, 8, 3, "#aa3300");
    rect(ctx, fpx + 8, fpy + 14, 4, 3, "#cc4411");
    rect(ctx, fpx + 13, fpy + 14, 3, 3, "#cc4411");
    rect(ctx, fpx + 9, fpy + 13, 2, 2, "#ee6622");
    rect(ctx, fpx + 13, fpy + 13, 2, 2, "#ee6622");
    px(ctx, fpx + 9, fpy + 12, "#ffaa33");
    px(ctx, fpx + 14, fpy + 12, "#ffaa33");
    px(ctx, fpx + 10, fpy + 12, "#ffdd66");
    // Embers
    px(ctx, fpx + 15, fpy + 20, "#ffaa44");
    px(ctx, fpx + 7, fpy + 20, "#ff6622");
  }
}

function drawBuilding(ctx: CanvasRenderingContext2D, frame: number) {
  const bx = BUILDING_X;
  const by = BUILDING_Y;
  const bw = BUILDING_W;
  const bh = BUILDING_H;

  rect(ctx, bx, by, bw, bh, "#555068");
  rect(ctx, bx, by, bw, 2, "#444058");
  rect(ctx, bx, by, 3, bh, "#444058");
  rect(ctx, bx + bw - 3, by, 3, bh, "#444058");
  for (let wy = by + 5; wy < by + 24; wy += 5) {
    rect(ctx, bx + 4, wy, bw - 8, 1, "#4a4560");
  }

  // Fireplace
  const fpx = bx + 5;
  const fpy = by + 2;
  rect(ctx, fpx, fpy, 24, 24, "#5a5050");
  rect(ctx, fpx + 1, fpy, 22, 1, "#6a6060");
  rect(ctx, fpx, fpy, 1, 24, "#6a6060");
  rect(ctx, fpx + 23, fpy, 1, 24, "#4a4040");
  for (let sy = 0; sy < 24; sy += 4) {
    for (let sx = 0; sx < 24; sx += 6) {
      const off = (sy / 4) % 2 === 0 ? 0 : 3;
      rect(ctx, fpx + ((sx + off) % 24), fpy + sy, 5, 3, "#5e5454");
      rect(ctx, fpx + ((sx + off) % 24), fpy + sy, 5, 1, "#645a5a");
    }
  }
  rect(ctx, fpx + 4, fpy + 6, 16, 17, "#1a0a0a");
  rect(ctx, fpx + 5, fpy + 7, 14, 15, "#110505");
  drawFlames(ctx, fpx, fpy, frame);
  rect(ctx, fpx - 2, fpy + 2, 28, 3, "#5a4030");
  rect(ctx, fpx - 2, fpy + 2, 28, 1, "#6a5040");
  // Pulsing ambient glow below fireplace
  const glowAlpha = 0.04 + 0.03 * Math.sin(frame * 0.08);
  rect(ctx, fpx - 2, fpy + 24, 28, 6, `rgba(255,120,40,${glowAlpha.toFixed(3)})`);

  // Glass panels
  const glassY = by + 3;
  const glassH = 20;
  const glassStart = fpx + 28;
  const glassEnd = bx + bw - 10;
  const panelCount = 3;
  const glassGap = 4;
  const panelW = Math.floor(
    (glassEnd - glassStart - glassGap * (panelCount - 1)) / panelCount
  );
  for (let p = 0; p < panelCount; p++) {
    const gpx = glassStart + p * (panelW + glassGap);
    rect(ctx, gpx, glassY, panelW, glassH, "#3a3555");
    rect(ctx, gpx + 1, glassY + 1, panelW - 2, glassH - 2, "#3a7a40");
    for (let gy = 0; gy < glassH - 2; gy += 3) {
      for (let gx = 0; gx < panelW - 2; gx += 3) {
        rect(
          ctx,
          gpx + 1 + gx,
          glassY + 1 + gy,
          3,
          3,
          (gx / 3 + gy / 3) % 2 === 0 ? "#3d7d44" : "#3a7840"
        );
      }
    }
    const treeClusters = [
      { dx: Math.floor(panelW * 0.25), dy: Math.floor(glassH * 0.35), r: 3 },
      { dx: Math.floor(panelW * 0.65), dy: Math.floor(glassH * 0.55), r: 2 },
      { dx: Math.floor(panelW * 0.45), dy: Math.floor(glassH * 0.7), r: 2 },
    ];
    for (const t of treeClusters) {
      const cx = Math.max(gpx + 2 + t.r, Math.min(gpx + panelW - 2 - t.r, gpx + t.dx));
      const cy = Math.max(glassY + 2 + t.r, Math.min(glassY + glassH - 2 - t.r, glassY + t.dy));
      rect(ctx, cx - t.r, cy - t.r + 1, t.r * 2, t.r * 2, "#2a5a2a");
      rect(ctx, cx - t.r + 1, cy - t.r, t.r * 2 - 2, t.r * 2 - 1, "#338844");
      px(ctx, cx - 1, cy - t.r + 1, "#44aa55");
    }
    rect(ctx, gpx + 1, glassY + 1, panelW - 2, glassH - 2, "rgba(100,120,160,0.08)");
    rect(ctx, gpx + 2, glassY + 2, Math.floor(panelW * 0.3), 1, "rgba(255,255,255,0.15)");
    rect(ctx, gpx + Math.floor(panelW / 2), glassY + 1, 1, glassH - 2, "rgba(60,55,80,0.3)");
  }

  // Carpet/floor
  const fy = FLOOR_Y;
  const fh = FLOOR_H;
  rect(ctx, bx + 3, fy, bw - 6, fh, "#464155");
  for (let row = 0; row < fh; row += 4) {
    for (let col = 0; col < bw - 6; col += 4) {
      rect(ctx, bx + 3 + col, fy + row, 4, 4, (col / 4 + row / 4) % 2 === 0 ? "#484358" : "#444050");
    }
  }
  rect(ctx, bx + 3, fy, bw - 6, 2, "#3a3550");
  rect(ctx, bx + 3, fy, bw - 6, 1, "#333048");

  // Guitar
  const guitarX = bx + bw - 18;
  const guitarY = by + 3;
  rect(ctx, guitarX + 2, guitarY, 3, 2, "#555");
  rect(ctx, guitarX + 1, guitarY + 1, 5, 3, "#111");
  rect(ctx, guitarX + 1, guitarY + 1, 5, 1, "#222");
  px(ctx, guitarX, guitarY + 2, "#888");
  px(ctx, guitarX + 6, guitarY + 2, "#888");
  rect(ctx, guitarX + 3, guitarY + 4, 1, 12, "#664422");
  for (let f = 0; f < 5; f++) {
    px(ctx, guitarX + 3, guitarY + 5 + f * 2, "#887766");
  }
  rect(ctx, guitarX + 1, guitarY + 16, 5, 8, "#ddee00");
  rect(ctx, guitarX, guitarY + 17, 7, 6, "#ddee00");
  rect(ctx, guitarX + 1, guitarY + 17, 4, 4, "#eeff33");
  rect(ctx, guitarX + 5, guitarY + 15, 2, 2, "#ccdd00");
  rect(ctx, guitarX + 1, guitarY + 19, 4, 1, "#fff");
  rect(ctx, guitarX + 1, guitarY + 21, 4, 1, "#fff");
  rect(ctx, guitarX - 1, guitarY + 14, 9, 12, "rgba(220,238,0,0.04)");

  // Amp
  const ampX = guitarX - 5;
  const ampY = fy + 2;
  rect(ctx, ampX, ampY, 18, 14, "#1a1a1a");
  rect(ctx, ampX + 1, ampY + 1, 16, 12, "#222");
  rect(ctx, ampX + 1, ampY + 1, 16, 3, "#999");
  rect(ctx, ampX + 1, ampY + 1, 16, 1, "#bbb");
  rect(ctx, ampX + 4, ampY + 2, 10, 1, "#ddd");
  for (let k = 0; k < 5; k++) {
    px(ctx, ampX + 3 + k * 2, ampY + 3, "#555");
  }
  rect(ctx, ampX + 2, ampY + 5, 14, 7, "#2a2a2a");
  for (let sy = 0; sy < 7; sy += 2) {
    for (let sx = 0; sx < 14; sx += 2) {
      px(ctx, ampX + 2 + sx, ampY + 5 + sy, "#333");
    }
  }
  rect(ctx, ampX + 3, ampY + 6, 5, 5, "#181818");
  rect(ctx, ampX + 10, ampY + 6, 5, 5, "#181818");
  px(ctx, ampX + 5, ampY + 8, "#252525");
  px(ctx, ampX + 12, ampY + 8, "#252525");
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(guitarX + 3, guitarY + 24);
  ctx.lineTo(guitarX + 3, fy);
  ctx.lineTo(ampX + 9, ampY);
  ctx.stroke();

  // Bookshelf
  const shX = bx + 4;
  const shY = fy + 2;
  rect(ctx, shX, shY, 10, 22, "#774422");
  rect(ctx, shX, shY, 10, 1, "#886633");
  rect(ctx, shX, shY + 7, 10, 1, "#886633");
  rect(ctx, shX, shY + 14, 10, 1, "#886633");
  const bookColors = ["#3366aa", "#aa3344", "#44aa55", "#aa8833", "#7733aa", "#33aaaa"];
  for (let sh = 0; sh < 3; sh++) {
    let bkX = shX + 1;
    for (let b = 0; b < 2; b++) {
      rect(ctx, bkX, shY + 1 + sh * 7, 3, 5, bookColors[sh * 2 + b]);
      rect(ctx, bkX, shY + 1 + sh * 7, 3, 1, "rgba(255,255,255,0.15)");
      bkX += 4;
    }
  }

  // Wall clock
  rect(ctx, bx + 6, by + 5, 6, 6, "#444");
  rect(ctx, bx + 7, by + 6, 4, 4, "#fff");
  px(ctx, bx + 9, by + 7, "#111");
  px(ctx, bx + 9, by + 8, "#111");
  px(ctx, bx + 10, by + 8, "#cc3333");

  // Plant
  const plx = bx + 6;
  const ply = fy + fh - 6;
  rect(ctx, plx, ply, 5, 4, "#885533");
  rect(ctx, plx + 1, ply, 3, 1, "#996644");
  rect(ctx, plx + 1, ply - 7, 3, 8, "#338844");
  rect(ctx, plx - 1, ply - 5, 2, 4, "#44aa55");
  rect(ctx, plx + 4, ply - 4, 2, 3, "#44aa55");
}

function drawTrees(ctx: CanvasRenderingContext2D) {
  seed = 500;
  for (let i = 0; i < 16; i++) {
    drawTree(
      ctx,
      8 + i * 20 + Math.floor(srand() * 6),
      28 + Math.floor(srand() * 4),
      Math.floor(srand() * 4)
    );
  }
}

function drawSideTrees(ctx: CanvasRenderingContext2D) {
  const leftTrees = [
    { x: 10, y: 42, v: 2 }, { x: 18, y: 68, v: 1 }, { x: 6, y: 88, v: 3 },
    { x: 16, y: 110, v: 0 }, { x: 8, y: 130, v: 1 }, { x: 14, y: 155, v: 2 },
    { x: 6, y: 175, v: 0 }, { x: 18, y: 195, v: 3 },
  ];
  for (const t of leftTrees) drawTree(ctx, t.x, t.y, t.v);

  const rightTrees = [
    { x: 306, y: 44, v: 2 }, { x: 312, y: 70, v: 3 }, { x: 302, y: 92, v: 1 },
    { x: 310, y: 115, v: 0 }, { x: 304, y: 138, v: 2 }, { x: 314, y: 160, v: 1 },
    { x: 300, y: 180, v: 3 }, { x: 308, y: 198, v: 0 },
  ];
  for (const t of rightTrees) drawTree(ctx, t.x, t.y, t.v);

  const frontTrees = [
    { x: 40, y: 198, v: 0 }, { x: 80, y: 196, v: 1 }, { x: 130, y: 198, v: 0 },
    { x: 180, y: 195, v: 3 }, { x: 220, y: 198, v: 0 }, { x: 260, y: 196, v: 1 },
  ];
  for (const t of frontTrees) drawTree(ctx, t.x, t.y, t.v);
}

function drawDesk(
  ctx: CanvasRenderingContext2D,
  dx: number,
  dy: number,
  hasLaptop: boolean
) {
  rect(ctx, dx - 3, dy - 1, 6, 3, "#2a2838");
  rect(ctx, dx - 3, dy + 2, 6, 4, "#302e3e");
  rect(ctx, dx - 2, dy + 3, 4, 2, "#363448");
  rect(ctx, dx - 10, dy + 6, 20, 2, "#2a2220");
  rect(ctx, dx - 10, dy + 6, 20, 1, "#3a3230");
  rect(ctx, dx - 10, dy + 7, 20, 1, "#1a1210");
  rect(ctx, dx - 9, dy + 8, 2, 3, "#1a1210");
  rect(ctx, dx + 7, dy + 8, 2, 3, "#1a1210");
  if (hasLaptop) {
    rect(ctx, dx + 0, dy + 0, 9, 6, "#bbbbc4");
    rect(ctx, dx + 1, dy + 0, 7, 1, "#ccccd4");
    rect(ctx, dx + 0, dy + 5, 9, 1, "#aaaab4");
    rect(ctx, dx + 3, dy + 2, 2, 2, "#dddde8");
    px(ctx, dx + 3, dy + 2, "#e8e8f0");
    rect(ctx, dx + 1, dy + 6, 7, 1, "rgba(150,170,200,0.12)");
  }
}

export function drawEnvironment(
  ctx: CanvasRenderingContext2D,
  deskPositions: Array<{ x: number; y: number }>,
  occupiedDeskIndices: Set<number>,
  frame: number = 0,
  timeOverride?: TimeOfDay
) {
  const tod = timeOverride ?? getTimeOfDay();

  drawSky(ctx, tod);
  drawMountain(ctx, 70, 4, 26, 45, "#667788", "#ccddee");
  drawMountain(ctx, 170, 0, 26, 60, "#778899", "#ccddee");
  drawMountain(ctx, 270, 6, 26, 40, "#667788", "#ccddee");
  drawGrass(ctx);
  drawTrees(ctx);
  drawBuilding(ctx, frame);

  for (let i = 0; i < deskPositions.length; i++) {
    drawDesk(ctx, deskPositions[i].x, deskPositions[i].y, occupiedDeskIndices.has(i));
  }

  drawSideTrees(ctx);

  // Time-of-day tint overlay
  const tint = TIME_TINTS[tod];
  if (tint.opacity > 0) {
    ctx.globalAlpha = tint.opacity;
    rect(ctx, 0, 0, W, H, tint.color);
    ctx.globalAlpha = 1;
  }
}
