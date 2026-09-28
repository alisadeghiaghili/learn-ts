/**
 * World 2 — Time only moves forward.
 */

import type { Level } from "../engine/types";
import { fail, win } from "./helpers";

export const WORLD2_LEVELS: Level[] = [
  {
    id: "2.1",
    world: "w2",
    worldTitle: "Time only moves forward",
    title: "Temporal split",
    concept: {
      title: "Never shuffle time",
      body:
        "In tabular ML you shuffle and split at random. In forecasting that is leakage: the model peeks at the future through the training window. The only honest split is temporal — train on the past, test on a contiguous future block that the model never saw.",
      whatHappens:
        "`split horizon=12` cuts the last 12 points as hold-out. Everything before is train/context. The stage paints train and horizon in different colors so the boundary is impossible to miss.",
      why:
        "A random split on a seasonal series lets the model see the same season in train and test. Your metrics become fiction.",
      callout: "If rows can be shuffled, you are not forecasting — you are interpolating.",
    },
    goal: "Load a series and make a temporal split with a positive horizon.",
    hints: ["`load airline`", "`split horizon=12`"],
    learning: ["train / horizon regions", "why random split is leakage"],
    seedSeries: "airline",
    steps: [
      {
        id: "load",
        label: "Load a series",
        detail: "Any series.",
        command: "load airline",
        check: (s) => Boolean(s.series),
      },
      {
        id: "split",
        label: "Temporal split",
        detail: "Hold out a future horizon.",
        command: "split horizon=12",
        check: (s) => Boolean(s.split?.temporal && s.split.horizon > 0 && !s.split.leaked),
      },
    ],
    win: (s) => {
      if (!s.series) return fail("Load a series first.");
      if (!s.split) return fail("Run `split horizon=12`.");
      if (!s.split.temporal || s.split.leaked || s.leakageDetected) {
        return fail("The split must be temporal and leak-free.");
      }
      return win("Train is the past. Horizon is the future. No mixing.");
    },
  },
  {
    id: "2.2",
    world: "w2",
    worldTitle: "Time only moves forward",
    title: "Context vs horizon",
    concept: {
      title: "Context is what the model may read; horizon is what it must write",
      body:
        "The context window is the lookback the forecaster is allowed to use. The horizon is how far ahead you ask for numbers. Too short a context and seasonality is invisible. Too long a context and you pay compute for stale structure. Horizon error almost always grows with h.",
      whatHappens:
        "`split horizon=12 context=64` records both. `forecast` draws the predicted path only in the horizon region — the model never writes into the past.",
      why:
        "Choosing context is a product decision: latency, cost, and whether the period fits inside the window.",
      formula: "context → model → horizon",
    },
    goal: "Split with an explicit context long enough to cover at least one season, then forecast.",
    hints: [
      "`load airline` (period 12)",
      "`split horizon=12 context=64`",
      "`fit snaive` then `forecast`",
    ],
    learning: ["context window", "horizon growth of error"],
    seedSeries: "airline",
    steps: [
      {
        id: "load",
        label: "Load a seasonal series",
        detail: "Period must be visible in context.",
        command: "load airline",
        check: (s) => Boolean(s.series && s.series.period > 1),
      },
      {
        id: "split",
        label: "Split with context",
        detail: "context ≥ period.",
        command: "split horizon=12 context=64",
        check: (s) =>
          Boolean(s.split && s.split.context >= (s.series?.period ?? 1) && s.split.temporal),
      },
      {
        id: "fit",
        label: "Fit any model",
        detail: "snaive or timesfm both fine.",
        check: (s) => s.fitted && Boolean(s.forecast),
      },
      {
        id: "fc",
        label: "Draw the forecast",
        detail: "Horizon only.",
        command: "forecast",
        check: (s) => s.inspectedForecast,
      },
    ],
    win: (s) => {
      if (!s.split) return fail("Split first.");
      if ((s.split.context ?? 0) < (s.series?.period ?? 1)) {
        return fail("Context must be at least one full season.");
      }
      if (!s.forecast) return fail("Fit and forecast on the horizon.");
      return win("Context feeds the model. Horizon is the exam.");
    },
  },
  {
    id: "2.3",
    world: "w2",
    worldTitle: "Time only moves forward",
    title: "Autocorrelation finds the period",
    concept: {
      title: "ACF is the memory map",
      body:
        "The autocorrelation function measures how strongly y_t depends on y_{t−k}. A spike near lag 12 on monthly data is the annual season. A slow decay means trend or non-stationarity. PACF cuts the indirect paths so you can guess an AR order. Read these before you pick a period.",
      whatHappens:
        "`show acf` draws bars for lags 0..24. On `seasonal` (period 24) you should see a clear peak near 24. On `noise` the bars sit near zero after lag 0.",
      why:
        "Seasonal-naive and Holt-Winters need the right period. The ACF is how you discover it when metadata is wrong or missing.",
    },
    goal: "Load a strongly seasonal series and inspect ACF until you can name the period.",
    hints: ["`load seasonal` (period 24)", "`show acf`"],
    learning: ["ACF spikes", "period discovery"],
    seedSeries: "seasonal",
    steps: [
      {
        id: "load",
        label: "Load a seasonal series",
        detail: "seasonal / short_season / airline.",
        command: "load seasonal",
        check: (s) => Boolean(s.series && s.series.period > 1),
      },
      {
        id: "acf",
        label: "Inspect ACF",
        detail: "Find the spike.",
        command: "show acf",
        check: (s) => s.inspectedAcf,
      },
    ],
    win: (s) => {
      if (!s.inspectedAcf) return fail("Run `show acf`.");
      return win(`Period looks like ${s.series?.period ?? "?"}. That number drives seasonal baselines.`);
    },
  },
  {
    id: "2.4",
    world: "w2",
    worldTitle: "Time only moves forward",
    title: "Leakage is silent",
    concept: {
      title: "The future must not enter the training path",
      body:
        "Leakage in forecasting is subtle: fitting on the full series then scoring on the same points, scaling with statistics that include the horizon, or selecting the model with a test-informed search. The sandbox refuses win credit when you score on train as the goal, and flags fit-on-full patterns.",
      whatHappens:
        "Score on train and the stage warns that train scores flatter you. Score on horizon after a temporal split and metrics are honest. The win check requires horizon scoring and a leak-free split.",
      why:
        "Leakage does not throw an error. It returns a beautiful number and a broken product.",
      callout: "Beautiful train metrics are a bug report, not a launch.",
    },
    goal: "Produce hold-out metrics after a temporal split (score on horizon, not train).",
    hints: ["`load level`", "`split horizon=16`", "`fit ses`", "`score`"],
    learning: ["train score flattery", "honest evaluation protocol"],
    seedSeries: "level",
    steps: [
      {
        id: "load",
        label: "Load a series",
        detail: "Any.",
        check: (s) => Boolean(s.series),
      },
      {
        id: "split",
        label: "Temporal split",
        detail: "Leak-free.",
        check: (s) => Boolean(s.split?.temporal && !s.leakageDetected),
      },
      {
        id: "score",
        label: "Score on horizon",
        detail: "Not on train.",
        command: "score",
        check: (s) => s.scoredOn === "horizon" && Boolean(s.metrics),
      },
    ],
    win: (s) => {
      if (s.leakageDetected) return fail("Leakage detected. Reset and keep time ordered.");
      if (s.scoredOn === "train") return fail("That score is flattery. Score the horizon.");
      if (!s.metrics) return fail("Need hold-out metrics.");
      return win("Honest numbers only. The future stayed out of training.");
    },
  },
];
