/**
 * Deterministic synthetic series generators for the sandbox.
 * Seeded PRNG so every learner sees the same series.
 */

import type { Freq, Series, SeriesName } from "./types";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function build(
  name: SeriesName,
  label: string,
  freq: Freq,
  freqLabel: string,
  period: number,
  y: number[],
  description: string,
  known?: number[],
): Series {
  return {
    name,
    label,
    freq,
    freqLabel,
    period,
    y,
    description,
    ...(known ? { known } : {}),
  };
}

export function makeSeries(name: SeriesName): Series {
  switch (name) {
    case "trend": {
      const n = 120;
      const y = Array.from({ length: n }, (_, i) => 10 + 0.08 * i + (mulberry32(11)() * 2 - 1) * 0.6);
      // regenerate with shared rng for continuity
      const rng = mulberry32(11);
      for (let i = 0; i < n; i++) y[i] = 10 + 0.08 * i + (rng() * 2 - 1) * 0.6;
      return build("trend", "Slow trend", "D", "daily", 1, y, "A slow upward drift with small measurement noise.");
    }
    case "seasonal": {
      const n = 168;
      const rng = mulberry32(22);
      const y = Array.from({ length: n }, (_, i) => 40 + 12 * Math.sin((2 * Math.PI * i) / 24) + (rng() * 2 - 1) * 1.5);
      return build("seasonal", "Daily seasonality", "H", "hourly", 24, y, "Strong daily cycle with mild noise.");
    }
    case "airline": {
      const n = 144;
      const rng = mulberry32(33);
      const seasonal = [ -20, -12, -4, 2, 8, 14, 18, 16, 8, 0, -10, -18 ];
      const y = Array.from({ length: n }, (_, i) => {
        const t = 100 + 0.6 * i;
        const s = seasonal[i % 12];
        return t + s + (rng() * 2 - 1) * 4;
      });
      return build("airline", "Airline passengers", "M", "monthly", 12, y, "Classic upward trend plus 12-month seasonality.");
    }
    case "retail": {
      const n = 104;
      const rng = mulberry32(44);
      const y = Array.from({ length: n }, (_, i) => {
        const base = 200 + 1.2 * i;
        const weekly = 35 * Math.sin((2 * Math.PI * i) / 7);
        const promo = i % 13 === 0 ? 80 : 0;
        return base + weekly + promo + (rng() * 2 - 1) * 12;
      });
      return build("retail", "Retail sales", "W", "weekly", 7, y, "Weekly seasonality with occasional promo spikes.");
    }
    case "energy": {
      const n = 192;
      const rng = mulberry32(55);
      const y = Array.from({ length: n }, (_, i) => {
        const daily = 25 * Math.sin((2 * Math.PI * i) / 24);
        const weekly = 10 * Math.sin((2 * Math.PI * i) / (24 * 7));
        return 120 + daily + weekly + (rng() * 2 - 1) * 6;
      });
      return build("energy", "Energy load", "H", "hourly", 24, y, "Daily and weekly cycles on a stable level.");
    }
    case "random_walk": {
      const n = 150;
      const rng = mulberry32(66);
      const y: number[] = [50];
      for (let i = 1; i < n; i++) y.push(y[i - 1]! + (rng() * 2 - 1) * 1.8);
      return build("random_walk", "Random walk", "D", "daily", 1, y, "No stable mean — each step inherits the last level.");
    }
    case "noise": {
      const n = 140;
      const rng = mulberry32(77);
      const y = Array.from({ length: n }, () => (rng() * 2 - 1) * 5);
      return build("noise", "Pure noise", "D", "daily", 1, y, "Mean-zero white noise. Nothing to forecast.");
    }
    case "intermittent": {
      const n = 120;
      const rng = mulberry32(88);
      const y = Array.from({ length: n }, () => (rng() < 0.25 ? 1 + Math.floor(rng() * 4) : 0));
      return build("intermittent", "Intermittent demand", "W", "weekly", 1, y, "Many zeros, rare small counts. MAPE will mislead you.");
    }
    case "outlier": {
      const n = 120;
      const rng = mulberry32(99);
      const y = Array.from({ length: n }, (_, i) => {
        const base = 30 + 0.05 * i + 5 * Math.sin((2 * Math.PI * i) / 12);
        return i === 80 ? base + 90 : base + (rng() * 2 - 1) * 1.2;
      });
      return build("outlier", "Outlier shock", "M", "monthly", 12, y, "Stable structure plus one extreme spike.");
    }
    case "level": {
      const n = 130;
      const rng = mulberry32(111);
      const y = Array.from({ length: n }, () => 50 + (rng() * 2 - 1) * 1.2);
      return build("level", "Constant level", "D", "daily", 1, y, "A flat level around 50 — SES territory.");
    }
    case "shift": {
      const n = 140;
      const rng = mulberry32(122);
      const y = Array.from({ length: n }, (_, i) => {
        const level = i < 70 ? 40 : 62;
        return level + (rng() * 2 - 1) * 1.5;
      });
      return build("shift", "Level shift", "D", "daily", 1, y, "Mean jumps mid-series. Zero-shot models can be surprised.");
    }
    case "short_season": {
      const n = 90;
      const rng = mulberry32(133);
      const y = Array.from({ length: n }, (_, i) => 15 + 6 * Math.sin((2 * Math.PI * i) / 6) + (rng() * 2 - 1) * 0.8);
      return build("short_season", "Short season", "H", "hourly", 6, y, "Period 6 — easy to miss if context is too short.");
    }
  }
}

export const SERIES_CATALOG: readonly SeriesName[] = [
  "trend",
  "seasonal",
  "airline",
  "retail",
  "energy",
  "random_walk",
  "noise",
  "intermittent",
  "outlier",
  "level",
  "shift",
  "short_season",
];

export function seriesMeta(name: SeriesName): { label: string; period: number; description: string } {
  const s = makeSeries(name);
  return { label: s.label, period: s.period, description: s.description };
}
