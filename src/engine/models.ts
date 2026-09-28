/**
 * Forecasting models: baselines, smoothers, simple AR, and a patch-style
 * zero-shot forecaster used to teach the TimesFM mental model.
 *
 * The `timesfm` path is a pedagogical simulator: it encodes the *ideas*
 * (context window, patch continuation, zero-shot, quantile fan widening)
 * without shipping pretrained weights.
 */

import type { ForecastResult, ModelName } from "./types";

function last(y: readonly number[]): number {
  return y[y.length - 1] ?? 0;
}

export function forecastNaive(context: readonly number[], horizon: number): ForecastResult {
  const level = last(context);
  return {
    model: "naive",
    yhat: Array.from({ length: horizon }, () => level),
    horizon,
    params: {},
  };
}

export function forecastSNaive(
  context: readonly number[],
  horizon: number,
  period: number,
): ForecastResult {
  const p = Math.max(1, period);
  const yhat = Array.from({ length: horizon }, (_, h) => {
    const idx = context.length - p + (h % p);
    return idx >= 0 && idx < context.length ? context[idx]! : last(context);
  });
  return { model: "snaive", yhat, horizon, params: { period: p } };
}

export function forecastMean(context: readonly number[], horizon: number): ForecastResult {
  const m = context.length ? context.reduce((a, b) => a + b, 0) / context.length : 0;
  return { model: "mean", yhat: Array.from({ length: horizon }, () => m), horizon, params: {} };
}

export function forecastDrift(context: readonly number[], horizon: number): ForecastResult {
  if (context.length < 2) return forecastNaive(context, horizon);
  const slope = (last(context) - context[0]!) / (context.length - 1);
  const level = last(context);
  return {
    model: "drift",
    yhat: Array.from({ length: horizon }, (_, h) => level + slope * (h + 1)),
    horizon,
    params: { slope },
  };
}

/** Simple exponential smoothing (level only). */
export function forecastSes(
  context: readonly number[],
  horizon: number,
  alpha = 0.3,
): ForecastResult {
  if (context.length === 0) return forecastMean(context, horizon);
  let level = context[0]!;
  for (let i = 1; i < context.length; i++) {
    level = alpha * context[i]! + (1 - alpha) * level;
  }
  return {
    model: "ses",
    yhat: Array.from({ length: horizon }, () => level),
    horizon,
    params: { alpha },
  };
}

/** Holt linear trend. */
export function forecastHolt(
  context: readonly number[],
  horizon: number,
  alpha = 0.4,
  beta = 0.2,
): ForecastResult {
  if (context.length < 2) return forecastSes(context, horizon, alpha);
  let level = context[0]!;
  let trend = context[1]! - context[0]!;
  for (let i = 1; i < context.length; i++) {
    const prev = level;
    level = alpha * context[i]! + (1 - alpha) * (level + trend);
    trend = beta * (level - prev) + (1 - beta) * trend;
  }
  return {
    model: "holt",
    yhat: Array.from({ length: horizon }, (_, h) => level + trend * (h + 1)),
    horizon,
    params: { alpha, beta },
  };
}

/** Holt-Winters additive. */
export function forecastHw(
  context: readonly number[],
  horizon: number,
  period: number,
  alpha = 0.3,
  beta = 0.1,
  gamma = 0.2,
): ForecastResult {
  const p = Math.max(1, Math.min(period, context.length - 1));
  if (context.length < p * 2 + 2) {
    return forecastSNaive(context, horizon, p);
  }
  const season = new Array<number>(p).fill(0);
  for (let i = 0; i < p; i++) season[i] = context[i + p]! - context[i]!;
  const meanSeason = season.reduce((a, b) => a + b, 0) / p;
  for (let i = 0; i < p; i++) season[i] = season[i]! - meanSeason;

  let level = context[p]!;
  let trend = (context[p]! - context[0]!) / p;
  const ses = season.slice();
  for (let i = p; i < context.length; i++) {
    const s = i % p;
    const prev = level;
    const y = context[i]!;
    level = alpha * (y - ses[s]!) + (1 - alpha) * (level + trend);
    trend = beta * (level - prev) + (1 - beta) * trend;
    ses[s] = gamma * (y - level) + (1 - gamma) * ses[s]!;
  }
  const yhat = Array.from({ length: horizon }, (_, h) => {
    const s = (context.length + h) % p;
    return level + trend * (h + 1) + ses[s]!;
  });
  return {
    model: "hw",
    yhat,
    horizon,
    params: { alpha, beta, gamma, period: p },
  };
}

/** Burg-style AR(p) via Yule-Walker (small p). */
export function forecastAr(
  context: readonly number[],
  horizon: number,
  order = 3,
): ForecastResult {
  const p = Math.max(1, Math.min(order, Math.floor(context.length / 4)));
  const n = context.length;
  if (n < p + 2) return forecastMean(context, horizon);
  const mean = context.reduce((a, b) => a + b, 0) / n;
  const z = context.map((v) => v - mean);
  // autocovariance
  const ac: number[] = [];
  for (let k = 0; k <= p; k++) {
    let s = 0;
    for (let i = 0; i + k < n; i++) s += z[i]! * z[i + k]!;
    ac.push(s / n);
  }
  // solve Toeplitz with simple Levinson
  const phi = new Array<number>(p + 1).fill(0);
  let e = ac[0]!;
  phi[0] = 1;
  if (e > 1e-12) {
    for (let k = 1; k <= p; k++) {
      let acc = ac[k]!;
      for (let j = 1; j < k; j++) acc -= phi[j]! * ac[k - j]!;
      const kk = acc / e;
      const next = phi.slice();
      for (let j = 1; j < k; j++) {
        next[j] = phi[j]! - kk * phi[k - j]!;
      }
      next[k] = kk;
      for (let j = 0; j <= k; j++) phi[j] = next[j]!;
      e *= 1 - kk * kk;
      if (e < 1e-12) break;
    }
  }
  const hist = z.slice();
  const yhat: number[] = [];
  for (let h = 0; h < horizon; h++) {
    let acc = 0;
    for (let j = 1; j <= p; j++) {
      const v = hist[hist.length - j] ?? 0;
      acc += phi[j]! * v;
    }
    hist.push(acc);
    yhat.push(acc + mean);
  }
  return {
    model: "ar",
    yhat,
    horizon,
    params: { order: p },
  };
}

export interface TimesFmOptions {
  /** Soft season period hint (0 = auto from context). */
  period?: number;
  /** Quantile levels to emit. */
  qs?: readonly number[];
  /** Context points consumed (window). */
  contextWindow?: number;
  /** Simulated patch length (conceptual). */
  patchLength?: number;
}

/**
 * Patch-style zero-shot forecaster.
 *
 * Mental model of a time-series foundation model:
 * 1. Slice context into patches (fixed length).
 * 2. Infer local level / trend / season from patch statistics (no task training).
 * 3. Continue with a decoder-like rollout, slightly damped trend.
 * 4. Widen quantile bands with horizon (aleatoric growth).
 */
export function forecastTimesFm(
  context: readonly number[],
  horizon: number,
  opts: TimesFmOptions = {},
): ForecastResult {
  const patchLength = Math.max(8, opts.patchLength ?? 32);
  const ctxWindow = Math.max(patchLength * 2, Math.min(opts.contextWindow ?? 256, context.length || patchLength * 2));
  const ctx = context.length > ctxWindow ? context.slice(context.length - ctxWindow) : context;
  const n = ctx.length;
  if (n < 4) return forecastMean(context, horizon);

  const qs = opts.qs ?? [0.1, 0.5, 0.9];

  // Patch statistics
  const nPatches = Math.max(1, Math.floor(n / patchLength));
  const patchLevels: number[] = [];
  for (let p = 0; p < nPatches; p++) {
    const start = p * patchLength;
    const slice = ctx.slice(start, start + patchLength);
    patchLevels.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  const level = last(ctx);
  let trend = 0;
  if (patchLevels.length >= 2) {
    const first = patchLevels[0]!;
    const lastL = patchLevels[patchLevels.length - 1]!;
    trend = ((lastL - first) / Math.max(1, (patchLevels.length - 1) * patchLength)) * 0.75;
  } else if (n >= 2) {
    trend = ((last(ctx) - ctx[0]!) / (n - 1)) * 0.75;
  }

  // Seasonal residual pattern (detrended)
  let period = opts.period && opts.period > 1 ? opts.period : 0;
  if (!period) {
    period = estimatePeriod(ctx);
  }
  const p = Math.max(1, Math.min(period, Math.max(1, Math.floor(n / 2))));
  const seasonal = new Array<number>(p).fill(0);
  if (p > 1 && n >= p * 2) {
    const counts = new Array<number>(p).fill(0);
    for (let i = 0; i < n; i++) {
      const localTrend = ctx[0]! + ((ctx[n - 1]! - ctx[0]!) * i) / Math.max(1, n - 1);
      seasonal[i % p] = seasonal[i % p]! + (ctx[i]! - localTrend);
      counts[i % p] = counts[i % p]! + 1;
    }
    for (let i = 0; i < p; i++) {
      seasonal[i] = counts[i] ? seasonal[i]! / counts[i]! : 0;
    }
  }

  // Residual scale for quantiles
  const resid: number[] = [];
  for (let i = 0; i < n; i++) {
    const localTrend = ctx[0]! + ((ctx[n - 1]! - ctx[0]!) * i) / Math.max(1, n - 1);
    resid.push(ctx[i]! - localTrend - (p > 1 ? seasonal[i % p]! : 0));
  }
  const sigma =
    Math.sqrt(resid.reduce((a, b) => a + b * b, 0) / Math.max(1, resid.length)) || 1;

  const yhat: number[] = [];
  for (let h = 0; h < horizon; h++) {
    const seasonTerm = p > 1 ? seasonal[(n + h) % p]! : 0;
    yhat.push(level + trend * (h + 1) + seasonTerm);
  }

  // Quantile fan: grows with sqrt(h)
  const zFor: Record<string, number> = { "0.05": -1.645, "0.1": -1.282, "0.25": -0.674, "0.5": 0, "0.75": 0.674, "0.9": 1.282, "0.95": 1.645 };
  const quantiles: Record<string, number[]> = {};
  for (const q of qs) {
    const key = String(q);
    const z = zFor[key] ?? qnorm(q);
    quantiles[key] = yhat.map((_, h) => yhat[h]! + z * sigma * Math.sqrt(1 + h * 0.15));
  }

  return {
    model: "timesfm",
    yhat,
    horizon,
    quantiles,
    params: {
      context: n,
      patch_length: patchLength,
      period: p,
      patches: nPatches,
    },
  };
}

function qnorm(q: number): number {
  // Beasley-Springer-Moro-ish approximation
  if (q <= 0 || q >= 1) return 0;
  const a = [2.50662823884, -18.61500062529, 41.39119773534, -25.44106049637];
  const b = [-8.47351093090, 23.08336743743, -21.06224101826, 3.13082909833];
  const c = [
    0.3374754822726147, 0.9761690190917186, 0.1607979323686187, 0.0276438810333863,
    0.0038405729373609, 0.0003951896511919, 0.0000321767881768, 0.0000002888167364,
    0.0000003960315187,
  ];
  const u = q - 0.5;
  if (Math.abs(u) < 0.42) {
    const r = u * u;
    const num = (((a[3]! * r + a[2]!) * r + a[1]!) * r + a[0]!) * u;
    const den = ((((b[3]! * r + b[2]!) * r + b[1]!) * r + b[0]!) * r + 1);
    return num / den;
  }
  let r = q < 0.5 ? q : 1 - q;
  r = Math.log(-Math.log(r));
  let x = c[0]!;
  for (let i = 1; i < 9; i++) x += c[i]! * r ** i;
  return q < 0.5 ? -x : x;
}

/** Period estimate from first strong ACF local peak (lag ≥ 3). */
export function estimatePeriod(y: readonly number[], maxLag = 48): number {
  const n = y.length;
  if (n < 16) return 0;
  const mean = y.reduce((a, b) => a + b, 0) / n;
  let denom = 0;
  for (let i = 0; i < n; i++) denom += (y[i]! - mean) ** 2;
  if (denom < 1e-12) return 0;
  const rho: number[] = [];
  const limit = Math.min(maxLag, n - 2);
  for (let k = 0; k <= limit; k++) {
    let s = 0;
    for (let i = 0; i + k < n; i++) s += (y[i]! - mean) * (y[i + k]! - mean);
    rho.push(s / denom);
  }
  let best = 0;
  let bestV = 0;
  for (let k = 3; k < limit; k++) {
    const v = rho[k]!;
    if (v > 0.2 && v >= (rho[k - 1] ?? 0) && v >= (rho[k + 1] ?? 0) && v > bestV) {
      bestV = v;
      best = k;
    }
  }
  return best;
}

export function forecastWith(
  model: ModelName,
  context: readonly number[],
  horizon: number,
  period: number,
  params: Record<string, number | string> = {},
): ForecastResult {
  const num = (k: string, d: number): number => {
    const v = params[k];
    return typeof v === "number" ? v : typeof v === "string" ? Number(v) || d : d;
  };
  switch (model) {
    case "naive":
      return forecastNaive(context, horizon);
    case "snaive":
      return forecastSNaive(context, horizon, num("period", period));
    case "mean":
      return forecastMean(context, horizon);
    case "drift":
      return forecastDrift(context, horizon);
    case "ses":
      return forecastSes(context, horizon, num("alpha", 0.3));
    case "holt":
      return forecastHolt(context, horizon, num("alpha", 0.4), num("beta", 0.2));
    case "hw":
      return forecastHw(
        context,
        horizon,
        num("period", period),
        num("alpha", 0.3),
        num("beta", 0.1),
        num("gamma", 0.2),
      );
    case "ar":
      return forecastAr(context, horizon, num("order", 3));
    case "timesfm":
      return forecastTimesFm(context, horizon, {
        period: num("period", period),
        patchLength: num("patch_length", 32),
        contextWindow: num("context", 256),
      });
  }
}

export const MODEL_LABELS: Record<ModelName, string> = {
  naive: "Naive (last value)",
  snaive: "Seasonal naive",
  mean: "Historical mean",
  drift: "Random walk with drift",
  ses: "Simple exponential smoothing",
  holt: "Holt linear trend",
  hw: "Holt-Winters additive",
  ar: "Autoregression",
  timesfm: "TimesFM-style zero-shot",
};

export const MODEL_PYTHON: Record<ModelName, (h: number, p: number) => string> = {
  naive: (h) => `forecast = np.full(${h}, context[-1])  # naive`,
  snaive: (_h, p) => `forecast = context[-${p}:].repeat(...)\n# seasonal naive, period=${p}`,
  mean: (h) => `forecast = np.full(${h}, context.mean())  # mean baseline`,
  drift: (h) => `forecast = context[-1] + drift * np.arange(1, ${h + 1})`,
  ses: () => `from statsmodels.tsa.holtwinters import SimpleExpSmoothing\nmodel = SimpleExpSmoothing(context).fit(smoothing_level=0.3)\nforecast = model.forecast(horizon)`,
  holt: () => `from statsmodels.tsa.holtwinters import Holt\nmodel = Holt(context).fit()\nforecast = model.forecast(horizon)`,
  hw: (_h, p) => `from statsmodels.tsa.holtwinters import ExponentialSmoothing\nmodel = ExponentialSmoothing(context, seasonal_periods=${p}, trend="add", seasonal="add").fit()\nforecast = model.forecast(horizon)`,
  ar: () => `from statsmodels.tsa.ar_model import AutoReg\nmodel = AutoReg(context, lags=3).fit()\nforecast = model.predict(len(context), len(context) + horizon - 1)`,
  timesfm: () => `from timesfm import TimesFM\nforecaster = TimesFM.from_pretrained("google/timesfm-2.5-200m-pytorch")\n# zero-shot: no task-specific fit\nfc = forecaster.forecast(context, horizon=horizon)  # + quantiles`,
};
