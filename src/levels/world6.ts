/**
 * World 6 — Foundation models (TimesFM path).
 */

import type { Level } from "../engine/types";
import { fail, win } from "./helpers";

export const WORLD6_LEVELS: Level[] = [
  {
    id: "6.1",
    world: "w6",
    worldTitle: "Foundation models",
    title: "Pretrain on many series",
    concept: {
      title: "One model, many worlds",
      body:
        "A time-series foundation model is pretrained on huge corpora of series (real + synthetic) so it can forecast a new series with no task-specific training. That is zero-shot forecasting. The bet: patterns of level, trend, season, and shock recur across domains.",
      whatHappens:
        "You will use the `timesfm` path as a zero-shot forecaster — no `fit` gradient steps on your series. It still needs context: the past window is the prompt.",
      why:
        "Fine-tuning is expensive and needs data. Zero-shot is the default you try first; fine-tune only when evaluation proves you must.",
    },
    goal: "Load a series, split, and fit the timesfm-style zero-shot model.",
    hints: ["`load energy`", "`split horizon=24`", "`fit timesfm`"],
    learning: ["pretraining on many series", "zero-shot as the default"],
    seedSeries: "energy",
    steps: [
      {
        id: "load",
        label: "Load a real-looking series",
        detail: "energy / airline / retail.",
        check: (s) => Boolean(s.series),
      },
      {
        id: "split",
        label: "Temporal split",
        detail: "Honest eval.",
        check: (s) => Boolean(s.split?.temporal),
      },
      {
        id: "fit",
        label: "Fit timesfm (zero-shot)",
        detail: "No task gradient steps.",
        command: "fit timesfm",
        check: (s) => s.model === "timesfm" && s.fitted,
      },
    ],
    win: (s) => {
      if (s.model !== "timesfm") return fail("Use `fit timesfm`.");
      return win("Zero-shot path armed. Context is the prompt.");
    },
  },
  {
    id: "6.2",
    world: "w6",
    worldTitle: "Foundation models",
    title: "Patches and context",
    concept: {
      title: "Sequence models read patches, not single points",
      body:
        "Modern forecasters chop the context into fixed-length patches (e.g. 32 points). Each patch becomes a token. The decoder rolls out future patches. Context length is capped — too short and season vanishes; too long and you pay compute.",
      whatHappens:
        "`fit timesfm patch_length=32 context=128` records those knobs. The engine reports how many patches were used. On short_season (period 6) a tiny context can still work; on airline a tiny context fails.",
      why:
        "When zero-shot looks bad, ask: was the period inside the context window? Was the patch length a terrible match?",
    },
    goal: "Fit timesfm with an explicit patch_length and context, then forecast.",
    hints: [
      "`load airline`",
      "`split horizon=12 context=96`",
      "`fit timesfm patch_length=32 context=96`",
      "`forecast`",
    ],
    learning: ["patch tokenization", "context window tradeoffs"],
    seedSeries: "airline",
    steps: [
      {
        id: "load",
        label: "Load a seasonal series",
        detail: "Need a real period.",
        check: (s) => Boolean(s.series && s.series.period > 1),
      },
      {
        id: "fit",
        label: "Fit timesfm with patch/context",
        detail: "params optional but try them.",
        command: "fit timesfm patch_length=32 context=96",
        check: (s) => s.model === "timesfm",
      },
      {
        id: "fc",
        label: "Forecast",
        detail: "Roll out patches.",
        check: (s) => Boolean(s.forecast),
      },
    ],
    win: (s) => {
      if (s.model !== "timesfm") return fail("Use `fit timesfm`.");
      if (!s.forecast) return fail("Run `forecast`.");
      return win("Patches in, patches out. Context is a real hyperparameter.");
    },
  },
  {
    id: "6.3",
    world: "w6",
    worldTitle: "Foundation models",
    title: "Zero-shot forecast",
    concept: {
      title: "No training loss — just a forecast",
      body:
        "Zero-shot means you call the pretrained model on context and get a horizon back. There is no local epoch loop. Your job shifts from training to evaluation: does it beat snaive? where does it break?",
      whatHappens:
        "`fit timesfm` → `forecast` → `score`. The scoreboard is the product. If MASE < 1 versus snaive, zero-shot earned its keep on this series.",
      why:
        "The failure mode of zero-shot is confident nonsense on distribution shift (level breaks, new regimes). You only see that with a temporal hold-out.",
    },
    goal: "Zero-shot forecast and score on the horizon with MASE defined.",
    hints: ["`load retail`", "`split horizon=12`", "`fit timesfm`", "`forecast`", "`score`"],
    learning: ["zero-shot evaluation protocol", "beating snaive"],
    seedSeries: "retail",
    steps: [
      {
        id: "load",
        label: "Load a series",
        detail: "Any.",
        check: (s) => Boolean(s.series),
      },
      {
        id: "fit",
        label: "Zero-shot timesfm",
        detail: "fit timesfm.",
        command: "fit timesfm",
        check: (s) => s.model === "timesfm",
      },
      {
        id: "score",
        label: "Score horizon",
        detail: "MASE defined.",
        command: "score",
        check: (s) => Boolean(s.metrics?.mase != null),
      },
    ],
    win: (s) => {
      if (s.model !== "timesfm") return fail("Use `fit timesfm`.");
      if (s.metrics?.mase == null) return fail("Score so MASE is defined.");
      return win("Zero-shot evaluated. Skill is a measurement, not a vibe.");
    },
  },
  {
    id: "6.4",
    world: "w6",
    worldTitle: "Foundation models",
    title: "Quantile forecasts",
    concept: {
      title: "A point forecast is half a story",
      body:
        "Predictive intervals (quantiles) say how sure the model is. 0.1–0.9 should cover most outcomes and widen with horizon. Decision systems (inventory, capacity) use the quantile that matches the cost of over vs under.",
      whatHappens:
        "`quantiles` draws a fan on the stage. The TimesFM-style path emits q0.1/q0.5/q0.9 that grow with √h. If the fan does not widen, something is wrong.",
      why:
        "Point-forecast-only dashboards push hidden risk into operations. Quantiles make uncertainty a first-class citizen.",
    },
    goal: "Forecast with timesfm and view the quantile fan.",
    hints: ["`load energy`", "`split horizon=24`", "`fit timesfm`", "`forecast`", "`quantiles`"],
    learning: ["quantile fan", "horizon-dependent uncertainty"],
    seedSeries: "energy",
    steps: [
      {
        id: "fit",
        label: "Fit timesfm",
        detail: "Quantile-capable path.",
        command: "fit timesfm",
        check: (s) => s.model === "timesfm",
      },
      {
        id: "fc",
        label: "Forecast",
        detail: "Point path.",
        check: (s) => Boolean(s.forecast),
      },
      {
        id: "q",
        label: "Show quantiles",
        detail: "Fan on stage.",
        command: "quantiles",
        check: (s) => s.inspectedQuantiles && Boolean(s.forecast?.quantiles),
      },
    ],
    win: (s) => {
      if (!s.forecast?.quantiles) return fail("Need a timesfm forecast with quantiles.");
      return win("Uncertainty is visible. Ship the quantile the business needs.");
    },
  },
  {
    id: "6.5",
    world: "w6",
    worldTitle: "Foundation models",
    title: "Zero-shot vs fine-tune",
    concept: {
      title: "Fine-tune only when the hold-out demands it",
      body:
        "Fine-tuning (full or LoRA) adapts weights to your domain. It helps under shift: new units, new regimes, unusual intermittency. It also costs data, time, and overfit risk. The protocol is always: measure zero-shot first, then prove fine-tuning wins on a temporal hold-out.",
      whatHappens:
        "In this sandbox, compare `fit timesfm` (zero-shot) with `fit hw` or `fit ar` (task-fit simple models). If a simple task model wins, do not assume fine-tuning a giant model is free lunch.",
      why:
        "Foundation ≠ automatic victory. Evaluation decides. Your reputation is the scoreboard.",
      callout: "Zero-shot is the baseline for fine-tuning, not a formality.",
    },
    goal: "Compare zero-shot timesfm against at least one fitted classical model on the same hold-out.",
    hints: [
      "`load shift` or `load airline`",
      "`split horizon=12`",
      "`fit timesfm` → `score`",
      "`fit hw` → `score`",
      "`compare`",
    ],
    learning: ["when to fine-tune", "comparison protocol"],
    seedSeries: "shift",
    steps: [
      {
        id: "load",
        label: "Load a series (shift is spicy)",
        detail: "Distribution shift.",
        check: (s) => Boolean(s.series),
      },
      {
        id: "split",
        label: "Temporal split",
        detail: "Shared hold-out.",
        check: (s) => Boolean(s.split?.temporal),
      },
      {
        id: "cmp",
        label: "Compare models",
        detail: "timesfm vs classical.",
        check: (s) => s.compared || (s.model === "timesfm" && s.metrics != null),
      },
    ],
    win: (s) => {
      if (!s.split) return fail("Split first.");
      if (!(s.compared || (s.model === "timesfm" && s.metrics))) {
        return fail("Score timesfm and compare with a classical model.");
      }
      return win("You treated fine-tuning as an experiment, not a religion.");
    },
  },
  {
    id: "6.6",
    world: "w6",
    worldTitle: "Foundation models",
    title: "Covariates past / future",
    concept: {
      title: "Some features are known ahead; some are not",
      body:
        "Past-only covariates (sensor readings you have already seen) are different from past-and-future covariates (calendar, planned promotions). Mixing them up creates leakage: you cannot feed a 'future actual' into the model as if you knew it.",
      whatHappens:
        "The retail series carries a known calendar-like channel. TimesFM-class APIs take `past_only_covariates` and `past_future_covariates` as separate arguments — the API itself teaches the boundary.",
      why:
        "This is the most common production leak in demand forecasting: 'we used the actual price in the feature store' — but the price was only known after the fact.",
    },
    goal: "Load a series with a known channel (retail), split, and fit timesfm.",
    hints: ["`load retail`", "`split horizon=8`", "`fit timesfm`"],
    learning: ["past-only vs known-future", "covariate leakage"],
    seedSeries: "retail",
    steps: [
      {
        id: "load",
        label: "Load retail (has known channel)",
        detail: "promo-like known signal.",
        command: "load retail",
        check: (s) => s.series?.name === "retail",
      },
      {
        id: "split",
        label: "Temporal split",
        detail: "Keep future unknowns out.",
        check: (s) => Boolean(s.split?.temporal && !s.leakageDetected),
      },
      {
        id: "fit",
        label: "Fit timesfm",
        detail: "Covariate-aware path.",
        command: "fit timesfm",
        check: (s) => s.model === "timesfm",
      },
    ],
    win: (s) => {
      if (s.leakageDetected) return fail("Covariate leakage. Keep future actuals out of features.");
      if (s.model !== "timesfm") return fail("Fit timesfm on retail.");
      return win("You know which features the future actually knows.");
    },
  },
  {
    id: "6.7",
    world: "w6",
    worldTitle: "Foundation models",
    title: "Multivariate channels",
    concept: {
      title: "Several series can be one model's problem",
      body:
        "Multivariate forecasting predicts multiple channels together so the model can use cross-series structure (temperature → load). Modern foundation models accept a stack of variates and optional covariates. Independent univariate is simpler but blind to friends.",
      whatHappens:
        "The energy series is effectively one channel; a real multivariate setup stacks more. The Python sketch shows the 2D target shape `(num_variates, context_len)` and optional past-future covariates spanning context+horizon.",
      why:
        "Do not jump to multivariate for elegance. Jump when the cross-channel signal wins on a temporal hold-out.",
    },
    goal: "Score a timesfm forecast and inspect the Python multivariate sketch (`show code`).",
    hints: ["`load energy`", "`split horizon=24`", "`fit timesfm`", "`score`", "`show code`"],
    learning: ["joint vs independent channels", "covariate channel layout"],
    seedSeries: "energy",
    steps: [
      {
        id: "load",
        label: "Load energy",
        detail: "Multi-cycle load.",
        command: "load energy",
        check: (s) => s.series?.name === "energy",
      },
      {
        id: "fit",
        label: "Fit timesfm",
        detail: "Univariate path first.",
        command: "fit timesfm",
        check: (s) => s.model === "timesfm",
      },
      {
        id: "score",
        label: "Score",
        detail: "Honest hold-out.",
        command: "score",
        check: (s) => Boolean(s.metrics),
      },
    ],
    win: (s) => {
      if (!s.metrics) return fail("Score after fit timesfm on energy.");
      return win("You have the mental model for joint channels. Ship univariate until the data argues otherwise.");
    },
  },
];
