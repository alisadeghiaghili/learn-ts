/**
 * World 4 — Metrics lie.
 */

import type { Level } from "../engine/types";
import { fail, win } from "./helpers";

export const WORLD4_LEVELS: Level[] = [
  {
    id: "4.1",
    world: "w4",
    worldTitle: "Metrics lie",
    title: "MAE vs RMSE",
    concept: {
      title: "RMSE punishes spikes; MAE stays democratic",
      body:
        "MAE averages absolute error. RMSE squares errors first, so one ugly miss dominates. On a series with an outlier shock, RMSE will jump while MAE stays calm. Pick the loss that matches the business cost of a miss.",
      whatHappens:
        "`load outlier` has one extreme spike. Fit naive or ses, then `score`. Watch RMSE ≫ MAE. That gap is the outlier tax.",
      why:
        "If you optimize RMSE you are buying insurance against spikes. If the business cares about median performance, MAE is closer to the truth.",
      formula: "RMSE = sqrt(mean (y − ŷ)²)  ·  MAE = mean |y − ŷ|",
    },
    goal: "On the outlier series, score and observe both MAE and RMSE.",
    hints: ["`load outlier`", "`split horizon=12`", "`fit ses`", "`score`"],
    learning: ["absolute vs squared loss", "outlier sensitivity"],
    seedSeries: "outlier",
    steps: [
      {
        id: "load",
        label: "Load outlier series",
        detail: "One big spike.",
        command: "load outlier",
        check: (s) => s.series?.name === "outlier",
      },
      {
        id: "score",
        label: "Score hold-out",
        detail: "Read MAE and RMSE together.",
        check: (s) => Boolean(s.metrics) && s.scoredOn === "horizon",
      },
    ],
    win: (s) => {
      if (!s.metrics) return fail("Score after a fit on the outlier series.");
      return win(`MAE ${s.metrics.mae.toFixed(2)} vs RMSE ${s.metrics.rmse.toFixed(2)} — the gap is the spike.`);
    },
  },
  {
    id: "4.2",
    world: "w4",
    worldTitle: "Metrics lie",
    title: "MAPE traps on intermittent demand",
    concept: {
      title: "Percentage errors explode on zeros and low volumes",
      body:
        "MAPE divides by the actual. When y is 0 or tiny, the error becomes infinite or absurd. Intmittent demand (many zeros) is exactly where MAPE misleads stakeholders. Prefer sMAPE, MASE, or weighted absolute error.",
      whatHappens:
        "`load intermittent` produces sparse counts. MAPE is undefined or huge. MASE still behaves because its scale comes from train naive errors, not from y itself.",
      why:
        "Retail and spare-parts forecasting live here. A dashboard of MAPE alone will punish the right forecast on the wrong scale.",
      callout: "If y can be zero, throw MAPE out of the report.",
    },
    goal: "Score on intermittent demand and see MAPE fail while MASE remains defined.",
    hints: ["`load intermittent`", "`split horizon=10`", "`fit naive`", "`score`"],
    learning: ["MAPE zeros", "MASE as a safer scale-free metric"],
    seedSeries: "intermittent",
    steps: [
      {
        id: "load",
        label: "Load intermittent series",
        detail: "Many zeros.",
        command: "load intermittent",
        check: (s) => s.series?.name === "intermittent",
      },
      {
        id: "score",
        label: "Score",
        detail: "Compare MAPE vs MASE.",
        check: (s) => Boolean(s.metrics),
      },
    ],
    win: (s) => {
      if (!s.metrics) return fail("Score on intermittent demand.");
      const mapeBad = s.metrics.mape === null || s.metrics.mape > 20;
      return win(
        mapeBad
          ? "MAPE collapsed. MASE is the adult in the room."
          : "MAPE looks survivable here — still prefer MASE on sparse demand.",
      );
    },
  },
  {
    id: "4.3",
    world: "w4",
    worldTitle: "Metrics lie",
    title: "Error grows with horizon",
    concept: {
      title: "A single average hides the h-curve",
      body:
        "Forecast error almost always increases with step h. A flat mean-MAE for h=1..36 can be excellent at 1 and terrible at 36. Per-horizon error is how you decide where the model is useful and where you need a shorter planning loop.",
      whatHappens:
        "`score` fills `perHorizon` absolute errors. The stage can plot that ramp. TimesFM-style models widen their quantile fan for the same reason.",
      why:
        "Product SLOs are horizon-specific: 'good enough for next week' is not 'good enough for next quarter'.",
    },
    goal: "Score a multi-step forecast and inspect metrics (which include the horizon ramp).",
    hints: ["`load energy`", "`split horizon=24`", "`fit timesfm`", "`forecast`", "`score`", "`show metrics`"],
    learning: ["horizon-dependent skill", "where to stop trusting a model"],
    seedSeries: "energy",
    steps: [
      {
        id: "load",
        label: "Load a series",
        detail: "energy / airline.",
        check: (s) => Boolean(s.series),
      },
      {
        id: "split",
        label: "Long-ish horizon",
        detail: "horizon ≥ 12.",
        check: (s) => Boolean(s.split && s.split.horizon >= 12),
      },
      {
        id: "score",
        label: "Score",
        detail: "perHorizon gets filled.",
        check: (s) => Boolean(s.metrics && s.metrics.perHorizon.length >= 12),
      },
    ],
    win: (s) => {
      if (!s.metrics || s.metrics.perHorizon.length < 12) return fail("Need a horizon ≥ 12 and a score.");
      return win("You can see the ramp. Publish metrics per horizon, not one blob.");
    },
  },
  {
    id: "4.4",
    world: "w4",
    worldTitle: "Metrics lie",
    title: "Report point and scale-free together",
    concept: {
      title: "No single metric is enough",
      body:
        "MAE is in units of y. MASE is comparable across series. RMSE stresses spikes. Publishing only one invites the metric that flatters the project. The honest report is a small set: MAE, RMSE, MASE — and a baseline row.",
      whatHappens:
        "`compare` + `score` together give you the unit error and the scaled error next to seasonal naive. That is the minimum bar for a review meeting.",
      why:
        "Cross-series comparison (SKU A vs SKU B) is impossible without a scale-free metric. Leadership will ask for it.",
    },
    goal: "Produce hold-out metrics that include both MAE and a defined MASE.",
    hints: ["`load retail`", "`split horizon=12`", "`fit hw`", "`score`"],
    learning: ["metric batteries", "cross-series comparability"],
    seedSeries: "retail",
    steps: [
      {
        id: "load",
        label: "Load a series",
        detail: "Any.",
        check: (s) => Boolean(s.series),
      },
      {
        id: "score",
        label: "Score battery",
        detail: "MAE + MASE present.",
        check: (s) => Boolean(s.metrics && s.metrics.mase != null && Number.isFinite(s.metrics.mae)),
      },
    ],
    win: (s) => {
      if (!s.metrics || s.metrics.mase == null) return fail("Need MAE and MASE on the hold-out.");
      return win("Metric battery complete. Ready for a review that cannot lie as easily.");
    },
  },
];
