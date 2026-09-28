/**
 * Forecast accuracy metrics. Scale-free MASE uses seasonal-naive in-sample MAE.
 */

import type { Metrics } from "./types";

export function mae(yTrue: readonly number[], yPred: readonly number[]): number {
  const n = Math.min(yTrue.length, yPred.length);
  if (n === 0) return NaN;
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.abs(yTrue[i]! - yPred[i]!);
  return s / n;
}

export function rmse(yTrue: readonly number[], yPred: readonly number[]): number {
  const n = Math.min(yTrue.length, yPred.length);
  if (n === 0) return NaN;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = yTrue[i]! - yPred[i]!;
    s += d * d;
  }
  return Math.sqrt(s / n);
}

/** Mean absolute percentage error; null when any |y| is ~0. */
export function mape(yTrue: readonly number[], yPred: readonly number[]): number | null {
  const n = Math.min(yTrue.length, yPred.length);
  if (n === 0) return null;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const y = yTrue[i]!;
    if (Math.abs(y) < 1e-8) return null;
    s += Math.abs((y - yPred[i]!) / y);
  }
  return (100 * s) / n;
}

export function smape(yTrue: readonly number[], yPred: readonly number[]): number {
  const n = Math.min(yTrue.length, yPred.length);
  if (n === 0) return NaN;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(yTrue[i]!);
    const b = Math.abs(yPred[i]!);
    const denom = a + b;
    if (denom < 1e-8) continue;
    s += (2 * Math.abs(yTrue[i]! - yPred[i]!)) / denom;
  }
  return (100 * s) / n;
}

/**
 * Mean absolute scaled error vs seasonal naive on the training series.
 * scale = MAE of seasonal-naive one-step errors on train.
 */
export function mase(
  yTrue: readonly number[],
  yPred: readonly number[],
  train: readonly number[],
  period: number,
): number | null {
  const m = Math.max(1, period);
  if (train.length <= m) return null;
  let scale = 0;
  let count = 0;
  for (let i = m; i < train.length; i++) {
    scale += Math.abs(train[i]! - train[i - m]!);
    count++;
  }
  if (count === 0) return null;
  scale /= count;
  if (scale < 1e-12) return null;
  return mae(yTrue, yPred) / scale;
}

export function perHorizonAbs(
  yTrue: readonly number[],
  yPred: readonly number[],
): number[] {
  const n = Math.min(yTrue.length, yPred.length);
  return Array.from({ length: n }, (_, i) => Math.abs(yTrue[i]! - yPred[i]!));
}

export function computeMetrics(
  yTrue: readonly number[],
  yPred: readonly number[],
  train: readonly number[],
  period: number,
): Metrics {
  return {
    mae: mae(yTrue, yPred),
    rmse: rmse(yTrue, yPred),
    mape: mape(yTrue, yPred),
    smape: smape(yTrue, yPred),
    mase: mase(yTrue, yPred, train, period),
    n: Math.min(yTrue.length, yPred.length),
    perHorizon: perHorizonAbs(yTrue, yPred),
  };
}

export function formatMetrics(m: Metrics): string {
  const f = (v: number | null, d = 3): string => (v === null || Number.isNaN(v) ? "n/a" : v.toFixed(d));
  return [
    `  n=${m.n}`,
    `  MAE    ${f(m.mae)}`,
    `  RMSE   ${f(m.rmse)}`,
    `  MAPE   ${m.mape === null ? "n/a (zero y)" : f(m.mape, 2) + "%"}`,
    `  sMAPE  ${f(m.smape, 2)}%`,
    `  MASE   ${f(m.mase)}`,
  ].join("\n");
}
