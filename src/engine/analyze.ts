/**
 * Series analysis: decomposition, differencing, ACF/PACF.
 */

import type { Decomposition } from "./types";

/** Centered moving average trend. */
export function movingAverageTrend(y: readonly number[], window: number): number[] {
  const n = y.length;
  const half = Math.floor(window / 2);
  const out = new Array<number>(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    let s = 0;
    let c = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j < 0 || j >= n) continue;
      s += y[j]!;
      c++;
    }
    out[i] = c ? s / c : NaN;
  }
  // fill edges by nearest valid
  let first = out.findIndex((v) => !Number.isNaN(v));
  let last = -1;
  for (let i = n - 1; i >= 0; i--) {
    if (!Number.isNaN(out[i])) {
      last = i;
      break;
    }
  }
  if (first < 0) return out.map(() => 0);
  for (let i = 0; i < first; i++) out[i] = out[first]!;
  for (let i = last + 1; i < n; i++) out[i] = out[last]!;
  return out;
}

/** Additive classical decomposition. */
export function decompose(y: readonly number[], period: number): Decomposition {
  const n = y.length;
  const p = Math.max(1, Math.min(period, Math.max(1, Math.floor(n / 2))));
  const trend = movingAverageTrend(y, p % 2 === 0 ? p : p);
  const detrended = y.map((v, i) => v - trend[i]!);
  const seasonalRaw = new Array<number>(p).fill(0);
  const counts = new Array<number>(p).fill(0);
  for (let i = 0; i < n; i++) {
    const idx = i % p;
    seasonalRaw[idx] = seasonalRaw[idx]! + detrended[i]!;
    counts[idx] = counts[idx]! + 1;
  }
  const seasonalMean = seasonalRaw.map((s, i) => (counts[i] ? s / counts[i]! : 0));
  const meanAll = seasonalMean.reduce((a, b) => a + b, 0) / p;
  const seasonalIdx = seasonalMean.map((s) => s - meanAll);
  const seasonal = Array.from({ length: n }, (_, i) => seasonalIdx[i % p]!);
  const residual = y.map((v, i) => v - trend[i]! - seasonal[i]!);
  return { trend, seasonal, residual, period: p };
}

export function difference(y: readonly number[], order = 1, lag = 1): number[] {
  let cur = y.slice();
  for (let o = 0; o < order; o++) {
    const next: number[] = [];
    for (let i = lag; i < cur.length; i++) next.push(cur[i]! - cur[i - lag]!);
    cur = next;
  }
  return cur;
}

export function acf(y: readonly number[], maxLag: number): number[] {
  const n = y.length;
  const mean = y.reduce((a, b) => a + b, 0) / n;
  let denom = 0;
  for (let i = 0; i < n; i++) denom += (y[i]! - mean) ** 2;
  if (denom < 1e-12) return Array.from({ length: maxLag + 1 }, (_, k) => (k === 0 ? 1 : 0));
  const out: number[] = [];
  for (let k = 0; k <= maxLag; k++) {
    let s = 0;
    for (let i = 0; i + k < n; i++) s += (y[i]! - mean) * (y[i + k]! - mean);
    out.push(s / denom);
  }
  return out;
}

/** Durbin-Levinson PACF from ACF. */
export function pacfFromAcf(rho: readonly number[], maxLag: number): number[] {
  const out = [1];
  if (rho.length < 2) return out;
  const p = Math.min(maxLag, rho.length - 1);
  let phi: number[] = [1];
  out.push(rho[1]!);
  for (let k = 2; k <= p; k++) {
    const num = rho[k]! - phi.slice(1, k).reduce((acc, v, j) => acc + v * rho[k - 1 - j]!, 0);
    const den = 1 - phi.slice(1, k).reduce((acc, v, j) => acc + v * rho[j + 1]!, 0);
    const phikk = Math.abs(den) < 1e-12 ? 0 : num / den;
    const next = [1, ...phi.slice(1).map((v, j) => v - phikk * phi[k - 1 - j]!), phikk];
    // rebuild length k+1
    const rebuilt = new Array<number>(k + 1).fill(0);
    rebuilt[0] = 1;
    for (let i = 1; i <= k; i++) {
      rebuilt[i] = (phi[i] ?? 0) - phikk * (phi[k - i] ?? 0);
    }
    rebuilt[k] = phikk;
    phi = rebuilt;
    out.push(phikk);
    void next;
  }
  return out;
}

/** Seasonal naive one-step errors on a series (for MASE scale). */
export function seasonalNaiveErrors(y: readonly number[], period: number): number[] {
  const p = Math.max(1, period);
  const errs: number[] = [];
  for (let i = p; i < y.length; i++) errs.push(y[i]! - y[i - p]!);
  return errs;
}
