/**
 * World 3 — Baselines first.
 */

import type { Level } from "../engine/types";
import { fail, win } from "./helpers";

export const WORLD3_LEVELS: Level[] = [
  {
    id: "3.1",
    world: "w3",
    worldTitle: "Baselines first",
    title: "Naive last value",
    concept: {
      title: "The simplest forecast is often the one you must beat",
      body:
        "Naive forecasting repeats the last observation: ŷ_{t+h} = y_t. On a random walk it is close to optimal. On a strong season it is beaten by seasonal naive. You never ship a model that cannot beat the correct simple baseline.",
      whatHappens:
        "`fit naive` freezes the last train value and repeats it across the horizon. The stage draws a flat line. That flat line is the bar.",
      why:
        "Baselines are cheap, interpretable, and expose metric lies. Skip them and you cannot tell skill from noise.",
    },
    goal: "Fit the naive model on a random walk and forecast.",
    hints: ["`load random_walk`", "`split horizon=20`", "`fit naive`", "`forecast`"],
    learning: ["last-value baseline", "when naive is strong"],
    seedSeries: "random_walk",
    steps: [
      {
        id: "load",
        label: "Load a walk",
        detail: "random_walk is ideal.",
        command: "load random_walk",
        check: (s) => Boolean(s.series),
      },
      {
        id: "split",
        label: "Split",
        detail: "Temporal.",
        command: "split horizon=20",
        check: (s) => Boolean(s.split?.temporal),
      },
      {
        id: "fit",
        label: "Fit naive",
        detail: "Repeat last value.",
        command: "fit naive",
        check: (s) => s.model === "naive" && s.fitted,
      },
      {
        id: "fc",
        label: "Forecast",
        detail: "Draw the flat path.",
        command: "forecast",
        check: (s) => s.inspectedForecast,
      },
    ],
    win: (s) => {
      if (s.model !== "naive") return fail("Fit `naive` specifically.");
      if (!s.forecast) return fail("Run `forecast`.");
      return win("The bar is set. Anything you ship must be better than this.");
    },
  },
  {
    id: "3.2",
    world: "w3",
    worldTitle: "Baselines first",
    title: "Seasonal naive",
    concept: {
      title: "Repeat the season, not the last point",
      body:
        "Seasonal naive copies the value from one season ago: ŷ_{t+h} = y_{t+h−m}. On airline-like series it destroys last-value naive. Choosing m from metadata or ACF is the whole skill.",
      whatHappens:
        "`fit snaive` tiles the last period across the horizon. The forecast looks like a pasted season — which is exactly the right idea when seasonality is strong.",
      why:
        "If your fancy model cannot beat seasonal naive on seasonal data, it has not learned the season.",
      formula: "ŷ_{t+h} = y_{t+h−m}",
    },
    goal: "On a seasonal series, fit snaive and beat naive on hold-out MAE (or at least run the comparison).",
    hints: ["`load airline`", "`split horizon=12`", "`fit snaive`", "`forecast`", "`score`", "`compare`"],
    learning: ["seasonal period tiling", "baseline hierarchy"],
    seedSeries: "airline",
    steps: [
      {
        id: "load",
        label: "Load seasonal series",
        detail: "period > 1.",
        check: (s) => Boolean(s.series && s.series.period > 1),
      },
      {
        id: "split",
        label: "Split",
        detail: "horizon ≥ 1 season preferred.",
        check: (s) => Boolean(s.split?.temporal),
      },
      {
        id: "fit",
        label: "Fit snaive",
        detail: "period-aware.",
        command: "fit snaive",
        check: (s) => s.model === "snaive",
      },
      {
        id: "score",
        label: "Score hold-out",
        detail: "Honest metrics.",
        command: "score",
        check: (s) => Boolean(s.metrics) && s.scoredOn === "horizon",
      },
    ],
    win: (s) => {
      if (s.model !== "snaive") return fail("Use `fit snaive`.");
      if (!s.metrics) return fail("Score the hold-out.");
      return win("Seasonal naive is the real boss on periodic data.");
    },
  },
  {
    id: "3.3",
    world: "w3",
    worldTitle: "Baselines first",
    title: "Drift and mean",
    concept: {
      title: "Match the baseline to the physics",
      body:
        "Historical mean assumes a stable level. Drift extends the average slope of a walk. SES adapts the level. Picking the wrong simple model is as bad as overfitting a complex one — you learn nothing about the real structure.",
      whatHappens:
        "`compare` runs naive / snaive / mean / drift / ses / hw / timesfm on the same hold-out and prints MAE, RMSE, MASE. The table is your pre-registration before any heavy model.",
      why:
        "A scoreboard of simple models is the cheapest project insurance in forecasting.",
    },
    goal: "Run `compare` after a temporal split and read the table.",
    hints: ["`load energy`", "`split horizon=24`", "`compare`"],
    learning: ["baseline zoo", "pre-registration of skill"],
    seedSeries: "energy",
    steps: [
      {
        id: "load",
        label: "Load a series",
        detail: "Any with some structure.",
        check: (s) => Boolean(s.series),
      },
      {
        id: "split",
        label: "Split",
        detail: "Temporal.",
        check: (s) => Boolean(s.split?.temporal),
      },
      {
        id: "cmp",
        label: "Compare baselines",
        detail: "Same hold-out for all.",
        command: "compare",
        check: (s) => s.compared,
      },
    ],
    win: (s) => {
      if (!s.compared) return fail("Run `compare`.");
      return win("You have a scoreboard. Now you know who the boss is.");
    },
  },
  {
    id: "3.4",
    world: "w3",
    worldTitle: "Baselines first",
    title: "MASE < 1 or go home",
    concept: {
      title: "Skill means beating seasonal naive in scaled terms",
      body:
        "MASE divides your MAE by the in-sample MAE of seasonal naive. MASE < 1 means you beat that baseline on the same scale. It is unit-free and safe on intermittent series where percentage errors explode.",
      whatHappens:
        "`score` reports MASE alongside MAE/RMSE. `fit timesfm` on a structured series often gets MASE < 1; on pure noise it will not — and should not pretend to.",
      why:
        "A single 'we won' number without a scale-free comparison is marketing, not evaluation.",
      formula: "MASE = MAE(model) / MAE(seasonal naive on train)",
    },
    goal: "Score any model and obtain a numeric MASE (train long enough for a scale).",
    hints: ["`load retail`", "`split horizon=12`", "`fit hw`", "`forecast`", "`score`"],
    learning: ["scale-free error", "interpretation of MASE < 1"],
    seedSeries: "retail",
    steps: [
      {
        id: "load",
        label: "Load a series",
        detail: "Prefer seasonal / retail.",
        check: (s) => Boolean(s.series),
      },
      {
        id: "splitfit",
        label: "Split and fit",
        detail: "Any model.",
        check: (s) => Boolean(s.split && s.fitted && s.forecast),
      },
      {
        id: "score",
        label: "Score with MASE",
        detail: "Must report MASE.",
        command: "score",
        check: (s) => s.metrics?.mase != null,
      },
    ],
    win: (s) => {
      if (s.metrics?.mase == null) return fail("Score so MASE is defined (need a train scale).");
      return win(
        s.metrics.mase < 1
          ? `MASE ${s.metrics.mase.toFixed(3)} < 1 — skill is real.`
          : `MASE ${s.metrics.mase.toFixed(3)} ≥ 1 — seasonal naive is still ahead. Honest read.`,
      );
    },
  },
];
