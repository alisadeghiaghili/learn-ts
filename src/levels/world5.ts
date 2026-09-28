/**
 * World 5 — Smoothers and simple structure.
 */

import type { Level } from "../engine/types";
import { fail, win } from "./helpers";

export const WORLD5_LEVELS: Level[] = [
  {
    id: "5.1",
    world: "w5",
    worldTitle: "Smoothers and simple structure",
    title: "Exponential smoothing",
    concept: {
      title: "SES chases the level with a memory of the past",
      body:
        "Simple exponential smoothing keeps one state: the level. Each step, level ← α y_t + (1−α) level. High α reacts fast; low α stays stable. On a flat series with noise, SES is the right tool — and a moving average with a brain.",
      whatHappens:
        "`fit ses alpha=0.3` estimates the level from the train context and forecasts a flat line at that level. Change alpha and watch sensitivity.",
      why:
        "SES is the gateway to Holt and Holt-Winters: add trend and season and you have the classical trio.",
      formula: "ℓ_t = α y_t + (1−α) ℓ_{t−1}",
    },
    goal: "Fit SES on a level series and forecast.",
    hints: ["`load level`", "`split horizon=12`", "`fit ses alpha=0.3`", "`forecast`"],
    learning: ["level state", "alpha as a reaction dial"],
    seedSeries: "level",
    steps: [
      {
        id: "load",
        label: "Load level series",
        detail: "Flat, noisy.",
        command: "load level",
        check: (s) => s.series?.name === "level",
      },
      {
        id: "fit",
        label: "Fit SES",
        detail: "alpha optional.",
        command: "fit ses",
        check: (s) => s.model === "ses" && s.fitted,
      },
      {
        id: "fc",
        label: "Forecast",
        detail: "Flat at the level.",
        check: (s) => Boolean(s.forecast) || s.inspectedForecast,
      },
    ],
    win: (s) => {
      if (s.model !== "ses") return fail("Use `fit ses`.");
      return win("Level tracking unlocked. Next: trend and season.");
    },
  },
  {
    id: "5.2",
    world: "w5",
    worldTitle: "Smoothers and simple structure",
    title: "Holt and Holt-Winters",
    concept: {
      title: "Add trend, then season",
      body:
        "Holt adds a trend state. Holt-Winters adds a seasonal state on top (additive or multiplicative). On airline-like data, HW is the classical champion. Three states, three smoothing parameters — still tiny compared to a neural net.",
      whatHappens:
        "`fit hw` on airline builds level + trend + 12 seasonal indices and rolls them forward. The forecast looks like a continuing season with slope — the classic shape.",
      why:
        "If HW wins your baseline table, a foundation model must still beat it. Many production problems are still won by HW.",
    },
    goal: "Fit Holt-Winters on a seasonal series and score on the horizon.",
    hints: ["`load airline`", "`split horizon=12`", "`fit hw`", "`forecast`", "`score`"],
    learning: ["Holt-Winters states", "when classical still wins"],
    seedSeries: "airline",
    steps: [
      {
        id: "load",
        label: "Load seasonal series",
        detail: "period > 1.",
        check: (s) => Boolean(s.series && s.series.period > 1),
      },
      {
        id: "fit",
        label: "Fit Holt-Winters",
        detail: "additive season.",
        command: "fit hw",
        check: (s) => s.model === "hw",
      },
      {
        id: "score",
        label: "Score",
        detail: "Hold-out.",
        command: "score",
        check: (s) => Boolean(s.metrics),
      },
    ],
    win: (s) => {
      if (s.model !== "hw") return fail("Fit `hw`.");
      if (!s.metrics) return fail("Score the hold-out.");
      return win("Three-state classical forecasting. Hard to beat without a reason.");
    },
  },
  {
    id: "5.3",
    world: "w5",
    worldTitle: "Smoothers and simple structure",
    title: "AR as memory",
    concept: {
      title: "Autoregression uses the last p values as features",
      body:
        "AR(p) models y_t as a linear combination of the previous p values plus noise. The PACF cuts off after lag p if the data is truly AR(p). It is the simplest 'learning from lags' model — and the ancestor of every sequence model.",
      whatHappens:
        "`fit ar order=3` solves Yule-Walker for the lag coefficients and rolls the forecast. Short memory is enough on a level series; long seasonal memory needs more lags or seasonality.",
      why:
        "Patches in a foundation model are a learned generalization of 'look at recent lags' — AR is the honest starting point.",
    },
    goal: "Fit an AR model on a series with short memory.",
    hints: ["`load level` or `load trend`", "`split horizon=12`", "`fit ar order=3`", "`forecast`"],
    learning: ["lag features", "PACF and order"],
    seedSeries: "trend",
    steps: [
      {
        id: "load",
        label: "Load a short-memory series",
        detail: "trend / level / random_walk.",
        check: (s) => Boolean(s.series),
      },
      {
        id: "fit",
        label: "Fit AR",
        detail: "order=3 default.",
        command: "fit ar",
        check: (s) => s.model === "ar",
      },
      {
        id: "fc",
        label: "Forecast",
        detail: "Roll forward.",
        check: (s) => Boolean(s.forecast),
      },
    ],
    win: (s) => {
      if (s.model !== "ar") return fail("Use `fit ar`.");
      return win("You used lags as features. Sequence modeling starts here.");
    },
  },
  {
    id: "5.4",
    world: "w5",
    worldTitle: "Smoothers and simple structure",
    title: "Residuals should be boring",
    concept: {
      title: "Leftover structure means the model missed something",
      body:
        "After a good fit, residuals look like noise: no trend, no season, no ACF spikes. If residuals still have a period, the model forgot seasonality. If they drift, the trend is wrong. Residual diagnosis is how you debug forecasts without a debugger.",
      whatHappens:
        "`decompose` shows residual alongside trend and seasonal. After a HW fit on airline, the residual strip should be the boring one — if seasonality still sits in residual, your period or form is wrong.",
      why:
        "AIC/loss can look fine while residuals scream. Always plot the remainder.",
      callout: "Residuals are the model's conscience.",
    },
    goal: "Decompose a seasonal series and inspect the residual path (show decomp or metrics).",
    hints: ["`load airline`", "`decompose`", "`show decomp`"],
    learning: ["residual diagnostics", "boring residuals as a goal"],
    seedSeries: "airline",
    steps: [
      {
        id: "load",
        label: "Load seasonal series",
        detail: "airline / energy.",
        check: (s) => Boolean(s.series && s.series.period > 1),
      },
      {
        id: "decomp",
        label: "Decompose",
        detail: "See the remainder.",
        command: "decompose",
        check: (s) => s.inspectedDecomp && Boolean(s.decomposition),
      },
      {
        id: "look",
        label: "Inspect residuals path",
        detail: "show decomp / metrics after a fit.",
        check: (s) => s.inspectedDecomp || s.inspectedMetrics || s.inspectedForecast,
      },
    ],
    win: (s) => {
      if (!s.decomposition) return fail("Run `decompose`.");
      return win("If residuals are boring, the model did its job. If not, you know where to look.");
    },
  },
];
