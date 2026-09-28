/**
 * World 1 — A series is not a spreadsheet.
 */

import type { Level } from "../engine/types";
import { fail, win } from "./helpers";

export const WORLD1_LEVELS: Level[] = [
  {
    id: "1.1",
    world: "w1",
    worldTitle: "A series is not a spreadsheet",
    title: "Index, value, frequency",
    concept: {
      title: "A time series is an ordered stream, not a bag of rows",
      body:
        "A series pairs each observation with an ordered time index and a frequency (hourly, daily, monthly…). Shuffle the rows and you destroy the object — the whole predictive signal lives in the order. Before any model, you must know: how long is the series, how often does it tick, and what period might repeat.",
      whatHappens:
        "`load airline` materializes 144 monthly points with a 12-step seasonal period. `show data` prints length, frequency, period, and value range so you confirm the shape of the problem before fitting anything.",
      why:
        "Frequency and period are not decoration. They decide which baselines make sense, how large your context window must be, and which metrics will behave.",
      callout: "If you cannot name the frequency, you cannot choose a period.",
    },
    goal: "Load any series and inspect it with `show data`.",
    hints: ["Try `load airline`.", "Then `show data`."],
    learning: ["time index vs row order", "frequency and seasonal period"],
    seedSeries: "airline",
    steps: [
      {
        id: "load",
        label: "Load a series",
        detail: "Materialize y with a time index.",
        command: "load airline",
        check: (s) => Boolean(s.series),
      },
      {
        id: "inspect",
        label: "Inspect the series",
        detail: "Confirm n, frequency, period.",
        command: "show data",
        check: (s) => s.inspectedData,
      },
    ],
    win: (s) => {
      if (!s.series) return fail("No series yet. `load airline`.");
      if (!s.inspectedData) return fail("Run `show data` and read n, frequency, and period.");
      return win("You can name the stream. Order is the data.");
    },
  },
  {
    id: "1.2",
    world: "w1",
    worldTitle: "A series is not a spreadsheet",
    title: "Trend, seasonality, residual",
    concept: {
      title: "Most series are three stories stacked",
      body:
        "Additive decomposition writes y = trend + seasonal + residual. Trend is the slow direction. Seasonal is a repeating shape tied to the period. Residual is whatever is left — ideally boring noise. Seeing the three pieces separately is how you learn what a model actually has to predict.",
      whatHappens:
        "`decompose` on a seasonal series estimates a moving-average trend, averages the seasonal shape over one period, and subtracts both. The stage draws three strips: trend, seasonal, residual.",
      why:
        "If you skip decomposition you will ask a baseline to chase noise or a model to invent a trend that is already a known cycle.",
      formula: "y_t = trend_t + seasonal_t + residual_t",
    },
    goal: "Load a seasonal series and run `decompose`.",
    hints: ["`load airline` then `decompose`.", "Also try `load energy` — daily + weekly cycles."],
    learning: ["additive decomposition", "trend vs cycle vs noise"],
    seedSeries: "airline",
    steps: [
      {
        id: "load",
        label: "Load a seasonal series",
        detail: "airline / energy / seasonal all work.",
        command: "load airline",
        check: (s) => Boolean(s.series && s.series.period > 1),
      },
      {
        id: "decomp",
        label: "Decompose",
        detail: "Split trend / seasonal / residual.",
        command: "decompose",
        check: (s) => s.inspectedDecomp && Boolean(s.decomposition),
      },
    ],
    win: (s) => {
      if (!s.series) return fail("Load a series with a real period.");
      if (!s.decomposition) return fail("Run `decompose`.");
      return win("Three layers, one series. Now you know what to forecast.");
    },
  },
  {
    id: "1.3",
    world: "w1",
    worldTitle: "A series is not a spreadsheet",
    title: "Noise has nothing to teach",
    concept: {
      title: "Not every series is forecastable",
      body:
        "White noise is mean-zero with no autocorrelation. The best forecast is the mean — or any constant. If a model looks great on noise, it is memorizing, not learning. Contrasting structured series with pure noise is the cheapest way to build taste.",
      whatHappens:
        "`load noise` gives mean-zero chaos. `load airline` gives trend + season. Compare `show chart` on both. Only one of them has a future you can pin down.",
      why:
        "Teams ship models on noise because metrics on the training window look impressive. You just refuse that job.",
      callout: "If the ACF is flat, stop modeling and go fix the data collection.",
    },
    goal: "Load pure noise, chart it, then load a structured series and chart that too.",
    hints: ["`load noise` → `show chart`", "`load trend` or `load airline` → `show chart`"],
    learning: ["white noise vs structure", "forecastability as a property"],
    seedSeries: "noise",
    steps: [
      {
        id: "noise",
        label: "Load pure noise",
        detail: "Mean-zero, no structure.",
        command: "load noise",
        check: (s) => s.series?.name === "noise",
      },
      {
        id: "chart1",
        label: "Chart the noise",
        detail: "Look at the empty structure.",
        command: "show chart",
        check: (s) => s.inspectedChart && s.series?.name === "noise",
      },
      {
        id: "struct",
        label: "Load a structured series",
        detail: "trend / airline / seasonal.",
        check: (s) =>
          Boolean(
            s.series &&
              s.series.name !== "noise" &&
              (s.series.period > 1 || s.series.name === "trend" || s.series.name === "random_walk"),
          ),
      },
      {
        id: "chart2",
        label: "Chart the structure",
        detail: "See the shape you can exploit.",
        check: (s) => s.inspectedChart && Boolean(s.series && s.series.name !== "noise"),
      },
    ],
    win: (s) => {
      if (s.series?.name === "noise") return fail("Noise is loaded. Chart it, then switch to a structured series.");
      return win("You can tell signal from static.");
    },
  },
  {
    id: "1.4",
    world: "w1",
    worldTitle: "A series is not a spreadsheet",
    title: "Stationarity and differencing",
    concept: {
      title: "Models prefer a stable mean",
      body:
        "A stationary series has a mean and autocorrelation structure that do not wander. Trends and random walks are non-stationary. Differencing (y_t − y_{t−1}) often removes the wander and leaves a stabler object. After differencing, the ACF should drop faster — that is the diagnostic.",
      whatHappens:
        "`diff order=1` replaces the series with first differences. `show acf` then shows how much memory remains at each lag. A slow ACF decay on the original series is the non-stationarity signature.",
      why:
        "Classical AR-family models assume (near) stationarity. Foundation models are more flexible, but they still use context — a wildly drifting series is a harder zero-shot job.",
      formula: "Δy_t = y_t − y_{t−1}",
    },
    goal: "Load a non-stationary series, difference it, and inspect the ACF.",
    hints: ["`load random_walk`", "`diff order=1` then `show acf`"],
    learning: ["stationarity intuition", "differencing as a transform", "ACF as a memory map"],
    seedSeries: "random_walk",
    steps: [
      {
        id: "load",
        label: "Load a non-stationary series",
        detail: "random_walk or trend.",
        command: "load random_walk",
        check: (s) => Boolean(s.series && ["random_walk", "trend", "airline", "shift"].includes(s.series.name)),
      },
      {
        id: "diff",
        label: "Difference once",
        detail: "Remove the wandering mean.",
        command: "diff order=1",
        check: (s) => s.differenced,
      },
      {
        id: "acf",
        label: "Inspect ACF",
        detail: "See remaining memory.",
        command: "show acf",
        check: (s) => s.inspectedAcf,
      },
    ],
    win: (s) => {
      if (!s.differenced) return fail("Run `diff order=1` first.");
      if (!s.inspectedAcf) return fail("Now `show acf` — look at the decay.");
      return win("You can stabilize a wandering series and read what is left.");
    },
  },
];
