/**
 * Canvas chart for series / forecast / decompose / ACF.
 */

import type { Decomposition, ForecastResult, Series, TemporalSplit } from "../engine/types";

const COLORS = {
  series: "#5b8def",
  forecast: "#9b7ede",
  band: "#2a9d8f",
  signal: "#f0b429",
  alarm: "#e23d51",
  chalk: "#c5ced6",
  chalkDim: "#7d8b96",
  grid: "#1a2c3a",
  void: "#0c141d",
  trend: "#f0b429",
  residual: "#7d8b96",
};

export type ChartKind = "series" | "forecast" | "decomp" | "acf";

export interface DrawState {
  series: Series | null;
  split: TemporalSplit | null;
  forecast: ForecastResult | null;
  decomposition: Decomposition | null;
  acf: number[] | null;
  kind: ChartKind;
  fitProgress: number;
}

function resizeCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(320, Math.floor(rect.width));
  const h = Math.max(180, Math.floor(rect.height));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

function boundsOf(arrays: number[][]): { xMin: number; xMax: number; yMin: number; yMax: number } {
  let yMin = Infinity;
  let yMax = -Infinity;
  let xMax = 1;
  for (const arr of arrays) {
    for (const v of arr) {
      if (!Number.isFinite(v)) continue;
      yMin = Math.min(yMin, v);
      yMax = Math.max(yMax, v);
    }
    xMax = Math.max(xMax, arr.length);
  }
  if (!Number.isFinite(yMin)) {
    yMin = 0;
    yMax = 1;
  }
  const pad = (yMax - yMin) * 0.12 || 1;
  return { xMin: 0, xMax: xMax - 1, yMin: yMin - pad, yMax: yMax + pad };
}

function project(
  x: number,
  y: number,
  b: { xMin: number; xMax: number; yMin: number; yMax: number },
  w: number,
  h: number,
  m: number,
): [number, number] {
  const px = m + ((x - b.xMin) / Math.max(1e-9, b.xMax - b.xMin)) * (w - 2 * m);
  const py = h - m - ((y - b.yMin) / Math.max(1e-9, b.yMax - b.yMin)) * (h - 2 * m);
  return [px, py];
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  m: number,
): void {
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = m + ((h - 2 * m) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(m, y);
    ctx.lineTo(w - m, y);
    ctx.stroke();
  }
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  ys: readonly number[],
  x0: number,
  b: { xMin: number; xMax: number; yMin: number; yMax: number },
  w: number,
  h: number,
  m: number,
  color: string,
  width = 2,
  progress = 1,
): void {
  const n = ys.length;
  if (n === 0) return;
  const count = Math.max(1, Math.floor(n * Math.min(1, Math.max(0, progress))));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const [px, py] = project(x0 + i, ys[i]!, b, w, h, m);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

export function drawChart(canvas: HTMLCanvasElement, state: DrawState): void {
  const ctx = resizeCanvas(canvas);
  if (!ctx) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const m = 28;
  drawGrid(ctx, w, h, m);

  const label = (text: string, x: number, y: number, color = COLORS.chalkDim): void => {
    ctx.fillStyle = color;
    ctx.font = "11px IBM Plex Mono, monospace";
    ctx.fillText(text, x, y);
  };

  if (state.kind === "acf" && state.acf) {
    const b = { xMin: 0, xMax: state.acf.length - 1, yMin: -1, yMax: 1 };
    const mid = project(0, 0, b, w, h, m)[1];
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(m, mid);
    ctx.lineTo(w - m, mid);
    ctx.stroke();
    state.acf.forEach((v, i) => {
      const [px, py] = project(i, v, b, w, h, m);
      ctx.fillStyle = i === 0 ? COLORS.signal : COLORS.series;
      ctx.fillRect(px - 3, Math.min(py, mid), 6, Math.abs(py - mid) || 1);
    });
    // period marker
    const period = state.series?.period ?? 0;
    if (period > 1 && period < state.acf.length) {
      const [px] = project(period, 0, b, w, h, m);
      ctx.strokeStyle = COLORS.signal;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(px, m);
      ctx.lineTo(px, h - m);
      ctx.stroke();
      ctx.setLineDash([]);
      label(`period ${period}`, px + 6, m + 12, COLORS.signal);
    }
    label("ACF", m, 14, COLORS.chalk);
    return;
  }

  if (state.kind === "decomp" && state.decomposition && state.series) {
    const d = state.decomposition;
    const panels: { name: string; ys: readonly number[]; color: string }[] = [
      { name: "observed", ys: state.series.y, color: COLORS.series },
      { name: "trend", ys: d.trend, color: COLORS.trend },
      { name: "seasonal", ys: d.seasonal, color: COLORS.forecast },
      { name: "residual", ys: d.residual, color: COLORS.residual },
    ];
    const ph = (h - 2 * m) / panels.length;
    panels.forEach((p, i) => {
      const b = boundsOf([p.ys as number[]]);
      const top = m + i * ph;
      const saveM = m;
      // local draw with shifted bounds
      const ys = p.ys;
      const n = ys.length;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const px = saveM + (k / Math.max(1, n - 1)) * (w - 2 * saveM);
        const py = top + ph * 0.75 - ((ys[k]! - b.yMin) / Math.max(1e-9, b.yMax - b.yMin)) * ph * 0.55;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      label(p.name, 8, top + 12, p.color);
    });
    return;
  }

  // series / forecast
  const yAll = state.series ? [...state.series.y] : [];
  const b = boundsOf([yAll, state.forecast ? [...state.forecast.yhat] : []]);
  drawLine(ctx, yAll, 0, b, w, h, m, COLORS.series, 2, 1);

  // train / horizon split paint
  if (state.split && state.series) {
    const n = state.series.y.length;
    const [xSplit] = project(state.split.trainEnd - 1, b.yMin, b, w, h, m);
    ctx.fillStyle = "rgba(226, 61, 81, 0.08)";
    ctx.fillRect(xSplit, m, w - m - xSplit, h - 2 * m);
    ctx.strokeStyle = COLORS.alarm;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(xSplit, m);
    ctx.lineTo(xSplit, h - m);
    ctx.stroke();
    ctx.setLineDash([]);
    label("horizon", xSplit + 8, m + 12, COLORS.alarm);
    label("train", m, 14, COLORS.chalk);
    void n;
  }

  if (state.forecast) {
    const x0 = state.split ? state.split.trainEnd : yAll.length;
    // quantile band
    const q = state.forecast.quantiles;
    if (q) {
      const keys = Object.keys(q).sort((a, c) => Number(a) - Number(c));
      if (keys.length >= 2) {
        const lo = q[keys[0]!]!;
        const hi = q[keys[keys.length - 1]!]!;
        ctx.fillStyle = "rgba(42, 157, 143, 0.18)";
        for (let i = 0; i < lo.length; i++) {
          const [x1, y1] = project(x0 + i, hi[i]!, b, w, h, m);
          const [, y2] = project(x0 + i, lo[i]!, b, w, h, m);
          ctx.fillRect(x1 - 2, Math.min(y1, y2), 4, Math.abs(y2 - y1));
        }
      }
    }
    drawLine(
      ctx,
      state.forecast.yhat,
      x0,
      b,
      w,
      h,
      m,
      COLORS.forecast,
      2.5,
      state.fitProgress,
    );
    label(state.forecast.model, w - m - 70, 14, COLORS.forecast);
  }

  if (state.kind === "forecast" && !state.forecast) {
    label("run fit + forecast", m + 8, h / 2, COLORS.chalkDim);
  }
}
