/**
 * Session state machine: load → inspect → split → fit → forecast → score.
 * Pure TS. UI reads SessionSnapshot only.
 */

import type {
  CommandResult,
  ForecastResult,
  Metrics,
  ModelName,
  PipelineStep,
  Series,
  SeriesName,
  SessionSnapshot,
  TemporalSplit,
  Decomposition,
} from "./types";
import { makeSeries } from "./series";
import { acf, decompose, pacfFromAcf } from "./analyze";
import { computeMetrics, formatMetrics } from "./metrics";
import { forecastWith, MODEL_PYTHON, MODEL_LABELS } from "./models";

export class Session {
  series: Series | null = null;
  decomposition: Decomposition | null = null;
  differenced = false;
  diffOrder = 0;
  acf: number[] | null = null;
  pacf: number[] | null = null;
  split: TemporalSplit | null = null;
  model: ModelName | null = null;
  modelParams: Record<string, number | string> = {};
  fitted = false;
  forecast: ForecastResult | null = null;
  metrics: Metrics | null = null;
  trainMetrics: Metrics | null = null;
  scoredOn: "train" | "horizon" | null = null;
  inspectedData = false;
  inspectedChart = false;
  inspectedAcf = false;
  inspectedDecomp = false;
  inspectedMetrics = false;
  inspectedForecast = false;
  inspectedQuantiles = false;
  compared = false;
  fitOnFull = false;
  leakageDetected = false;
  steps: PipelineStep[] = [];
  commandCount = 0;

  clone(): Session {
    const s = new Session();
    s.series = this.series ? { ...this.series, y: [...this.series.y] } : null;
    s.decomposition = this.decomposition
      ? {
          trend: [...this.decomposition.trend],
          seasonal: [...this.decomposition.seasonal],
          residual: [...this.decomposition.residual],
          period: this.decomposition.period,
        }
      : null;
    s.differenced = this.differenced;
    s.diffOrder = this.diffOrder;
    s.acf = this.acf ? [...this.acf] : null;
    s.pacf = this.pacf ? [...this.pacf] : null;
    s.split = this.split ? { ...this.split } : null;
    s.model = this.model;
    s.modelParams = { ...this.modelParams };
    s.fitted = this.fitted;
    s.forecast = this.forecast
      ? {
          ...this.forecast,
          yhat: [...this.forecast.yhat],
          quantiles: this.forecast.quantiles
            ? Object.fromEntries(Object.entries(this.forecast.quantiles).map(([k, v]) => [k, [...v]]))
            : undefined,
          params: { ...this.forecast.params },
        }
      : null;
    s.metrics = this.metrics
      ? { ...this.metrics, perHorizon: [...this.metrics.perHorizon] }
      : null;
    s.trainMetrics = this.trainMetrics
      ? { ...this.trainMetrics, perHorizon: [...this.trainMetrics.perHorizon] }
      : null;
    s.scoredOn = this.scoredOn;
    s.inspectedData = this.inspectedData;
    s.inspectedChart = this.inspectedChart;
    s.inspectedAcf = this.inspectedAcf;
    s.inspectedDecomp = this.inspectedDecomp;
    s.inspectedMetrics = this.inspectedMetrics;
    s.inspectedForecast = this.inspectedForecast;
    s.inspectedQuantiles = this.inspectedQuantiles;
    s.compared = this.compared;
    s.fitOnFull = this.fitOnFull;
    s.leakageDetected = this.leakageDetected;
    s.steps = this.steps.map((st) => ({ ...st }));
    s.commandCount = this.commandCount;
    return s;
  }

  snapshot(): SessionSnapshot {
    let beatSnaive: boolean | null = null;
    let mase: number | null = null;
    if (this.metrics?.mase != null) {
      mase = this.metrics.mase;
      beatSnaive = this.metrics.mase < 1;
    }
    return {
      series: this.series,
      decomposition: this.decomposition,
      differenced: this.differenced,
      diffOrder: this.diffOrder,
      acf: this.acf,
      pacf: this.pacf,
      split: this.split,
      model: this.model,
      modelParams: { ...this.modelParams },
      fitted: this.fitted,
      forecast: this.forecast,
      metrics: this.metrics,
      trainMetrics: this.trainMetrics,
      scoredOn: this.scoredOn,
      inspectedData: this.inspectedData,
      inspectedChart: this.inspectedChart,
      inspectedAcf: this.inspectedAcf,
      inspectedDecomp: this.inspectedDecomp,
      inspectedMetrics: this.inspectedMetrics,
      inspectedForecast: this.inspectedForecast,
      inspectedQuantiles: this.inspectedQuantiles,
      compared: this.compared,
      beatSnaive,
      mase,
      leakageDetected: this.leakageDetected,
      steps: this.steps,
      commandCount: this.commandCount,
      fitOnFull: this.fitOnFull,
    };
  }

  trainSlice(): number[] {
    if (!this.series) return [];
    if (!this.split) return [...this.series.y];
    return this.series.y.slice(0, this.split.trainEnd);
  }

  testSlice(): number[] {
    if (!this.series || !this.split) return [];
    return this.series.y.slice(this.split.trainEnd, this.split.trainEnd + this.split.horizon);
  }

  private push(step: PipelineStep): void {
    this.steps = [...this.steps, step];
    if (this.steps.length > 40) this.steps = this.steps.slice(-40);
    this.commandCount++;
  }

  load(name: SeriesName): CommandResult {
    this.series = makeSeries(name);
    this.decomposition = null;
    this.differenced = false;
    this.diffOrder = 0;
    this.acf = null;
    this.pacf = null;
    this.split = null;
    this.model = null;
    this.modelParams = {};
    this.fitted = false;
    this.forecast = null;
    this.metrics = null;
    this.trainMetrics = null;
    this.scoredOn = null;
    this.inspectedData = false;
    this.inspectedChart = false;
    this.inspectedAcf = false;
    this.inspectedDecomp = false;
    this.inspectedMetrics = false;
    this.inspectedForecast = false;
    this.inspectedQuantiles = false;
    this.compared = false;
    this.fitOnFull = false;
    this.leakageDetected = false;
    this.push({
      kind: "load",
      label: `load ${name}`,
      python: `series = load_series("${name}")  # n=${this.series.y.length}, freq=${this.series.freqLabel}`,
      status: "ok",
      detail: this.series.label,
    });
    return {
      ok: true,
      output: [
        `Loaded "${this.series.label}"`,
        `  n=${this.series.y.length}  freq=${this.series.freqLabel}  period=${this.series.period}`,
        this.series.description,
      ].join("\n"),
      python: `series = load_series("${name}")`,
    };
  }

  show(what: string): CommandResult {
    if (!this.series) return err("No series loaded. Try `load airline`.");
    const s = this.series;
    switch (what) {
      case "data": {
        this.inspectedData = true;
        const head = s.y.slice(0, 6).map((v) => v.toFixed(2)).join(", ");
        const tail = s.y.slice(-6).map((v) => v.toFixed(2)).join(", ");
        this.push({
          kind: "load",
          label: "show data",
          python: `print(series.head(), series.tail(), series.shape)`,
          status: "ok",
        });
        return {
          ok: true,
          output: [
            `Series  ${s.label}  [${s.name}]`,
            `  length     ${s.y.length}`,
            `  frequency  ${s.freqLabel} (${s.freq})`,
            `  period     ${s.period}`,
            `  range      [${Math.min(...s.y).toFixed(2)}, ${Math.max(...s.y).toFixed(2)}]`,
            `  head       ${head} …`,
            `  tail       … ${tail}`,
            s.description,
          ].join("\n"),
          python: `series.describe()`,
        };
      }
      case "chart":
        this.inspectedChart = true;
        this.push({ kind: "load", label: "show chart", python: `series.plot()`, status: "ok" });
        return { ok: true, output: "Stage updated — full series chart." };
      case "acf": {
        const lag = 24;
        this.acf = acf(s.y, Math.min(lag, s.y.length - 2));
        this.inspectedAcf = true;
        this.push({ kind: "acf", label: "acf", python: `from statsmodels.graphics.tsaplots import plot_acf\nplot_acf(series, lags=24)`, status: "ok" });
        return { ok: true, output: `ACF computed (lags 0..${this.acf.length - 1}). Look for a spike near the period.` };
      }
      case "pacf": {
        const lag = 24;
        const rho = acf(s.y, Math.min(lag, s.y.length - 2));
        this.pacf = pacfFromAcf(rho, Math.min(lag, rho.length - 1));
        this.inspectedAcf = true;
        this.push({ kind: "pacf", label: "pacf", python: `plot_pacf(series, lags=24)`, status: "ok" });
        return { ok: true, output: "PACF computed." };
      }
      case "decomp":
        return this.decomposeCmd();
      case "metrics": {
        if (!this.metrics) return err("No metrics yet. `forecast` then `score`.");
        this.inspectedMetrics = true;
        this.push({ kind: "score", label: "show metrics", python: `print(metrics)`, status: "ok" });
        return { ok: true, output: `Metrics on ${this.scoredOn ?? "?"}:\n${formatMetrics(this.metrics)}` };
      }
      case "forecast":
        if (!this.forecast) return err("No forecast yet. `fit` then `forecast`.");
        this.inspectedForecast = true;
        return {
          ok: true,
          output: `Forecast (${this.forecast.model}, h=${this.forecast.horizon}):\n  ${this.forecast.yhat.map((v) => v.toFixed(2)).join(", ")}`,
        };
      case "split":
        if (!this.split) return err("No split yet. `split horizon=12`.");
        return {
          ok: true,
          output: [
            `Split  horizon=${this.split.horizon}  context≥${this.split.context}  temporal=${this.split.temporal}`,
            `  train [0 .. ${this.split.trainEnd})`,
            `  test  [${this.split.trainEnd} .. ${this.split.trainEnd + this.split.horizon})`,
          ].join("\n"),
        };
      case "quantiles":
        if (!this.forecast?.quantiles) return err("No quantiles. Use `fit timesfm` then `forecast`, or `quantiles`.");
        this.inspectedQuantiles = true;
        {
          const lines = Object.entries(this.forecast.quantiles).map(
            ([q, arr]) => `  q${q}  ${arr.slice(0, 6).map((v) => v.toFixed(2)).join(", ")}${arr.length > 6 ? " …" : ""}`,
          );
          return { ok: true, output: `Quantile fan:\n${lines.join("\n")}` };
        }
      case "code":
        return this.showCode();
      default:
        return err(`Unknown show target: ${what}. Try data|chart|acf|pacf|decomp|metrics|forecast|split|quantiles|code`);
    }
  }

  private showCode(): CommandResult {
    const py = this.model
      ? MODEL_PYTHON[this.model](this.forecast?.horizon ?? 12, this.series?.period ?? 1)
      : "# fit a model first";
    return {
      ok: true,
      output: [
        "Python sketch for the current path:",
        `# series: ${this.series?.name ?? "none"}`,
        `# split horizon=${this.split?.horizon ?? "—"}`,
        py,
      ].join("\n"),
      python: py,
    };
  }

  decomposeCmd(): CommandResult {
    if (!this.series) return err("Load a series first.");
    this.decomposition = decompose(this.series.y, this.series.period);
    this.inspectedDecomp = true;
    this.push({
      kind: "decompose",
      label: "decompose",
      python: `from statsmodels.tsa.seasonal import seasonal_decompose\nres = seasonal_decompose(series, model="additive", period=${this.series.period})`,
      status: "ok",
    });
    return {
      ok: true,
      output: `Additive decomposition (period=${this.decomposition.period}). Stage shows trend / seasonal / residual.`,
    };
  }

  diff(order = 1, lag = 1): CommandResult {
    if (!this.series) return err("Load a series first.");
    this.differenced = true;
    this.diffOrder = order;
    this.push({
      kind: "diff",
      label: `diff order=${order} lag=${lag}`,
      python: `d = series.diff(${lag}).diff(...).dropna()  # order=${order}, lag=${lag}`,
      status: "ok",
    });
    return {
      ok: true,
      output: `Differenced (order=${order}, lag=${lag}). Mean-level removed — inspect ACF to see what remains.`,
    };
  }

  splitHorizon(horizon: number, context = 64): CommandResult {
    if (!this.series) return err("Load a series first.");
    const n = this.series.y.length;
    if (horizon < 1) return err("horizon must be ≥ 1");
    if (horizon >= n - 8) return err(`horizon too long for n=${n}`);
    const trainEnd = n - horizon;
    if (trainEnd < context) {
      this.split = {
        horizon,
        context: trainEnd,
        trainEnd,
        temporal: true,
        leaked: false,
      };
    } else {
      this.split = { horizon, context, trainEnd, temporal: true, leaked: false };
    }
    this.push({
      kind: "split",
      label: `split horizon=${horizon}`,
      python: `train, test = temporal_split(series, horizon=${horizon})\n# never shuffle time`,
      status: "ok",
      detail: `train_end=${trainEnd}`,
    });
    return {
      ok: true,
      output: [
        `Temporal split: horizon=${horizon}, train n=${trainEnd}, test n=${horizon}`,
        `Context window will use the last ${Math.min(context, trainEnd)} train points.`,
      ].join("\n"),
    };
  }

  fit(model: ModelName, params: Record<string, number | string> = {}): CommandResult {
    if (!this.series) return err("Load a series first.");
    if (!this.split) {
      // Implicit split at 25% if not set — but flag fitOnFull when they later score wrong
      const horizon = Math.max(8, Math.floor(this.series.y.length * 0.2));
      this.splitHorizon(horizon, 64);
    }
    const split = this.split!;
    const context = this.series.y.slice(0, split.trainEnd);
    if (context.length < 4) return err("Train slice too small to fit.");
    const period = this.series.period;
    const result = forecastWith(model, context, split.horizon, period, params);
    this.model = model;
    this.modelParams = { ...params };
    this.fitted = true;
    this.forecast = result;
    this.fitOnFull = false;
    this.push({
      kind: "fit",
      label: `fit ${model}`,
      python: MODEL_PYTHON[model](split.horizon, period),
      status: "ok",
      detail: MODEL_LABELS[model],
    });
    return {
      ok: true,
      output: [
        `Fitted ${MODEL_LABELS[model]} on train context (n=${context.length}).`,
        `  horizon ready = ${split.horizon}`,
        model === "timesfm"
          ? "  zero-shot patch rollout — no task-specific gradient steps."
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      python: MODEL_PYTHON[model](split.horizon, period),
    };
  }

  forecastCmd(horizon?: number): CommandResult {
    if (!this.series) return err("Load a series first.");
    if (!this.model) return err("Fit a model first: `fit naive` … `fit timesfm`.");
    const split = this.split!;
    const h = horizon ?? split.horizon;
    const context = this.series.y.slice(0, split.trainEnd);
    const result = forecastWith(this.model, context, h, this.series.period, this.modelParams);
    this.forecast = result;
    this.inspectedForecast = true;
    this.push({
      kind: "forecast",
      label: `forecast horizon=${h}`,
      python: `yhat = model.forecast(horizon=${h})`,
      status: "ok",
    });
    return {
      ok: true,
      output: `Forecast generated (h=${h}, model=${result.model}). Stage draws the path over the hold-out.`,
    };
  }

  score(on: "train" | "horizon" = "horizon"): CommandResult {
    if (!this.series || !this.forecast) return err("Need a forecast first.");
    const split = this.split!;
    const train = this.series.y.slice(0, split.trainEnd);
    const test = this.series.y.slice(split.trainEnd, split.trainEnd + this.forecast.horizon);
    if (on === "train") {
      // one-step style fit metrics on train using the model on train (not ideal — teach this)
      const yhat = forecastWith(this.model ?? "naive", train.slice(0, -this.forecast.horizon || -1), this.forecast.horizon, this.series.period, this.modelParams).yhat;
      const yTrue = train.slice(-this.forecast.horizon);
      this.trainMetrics = computeMetrics(yTrue, yhat, train, this.series.period);
      this.scoredOn = "train";
      this.push({
        kind: "score",
        label: "score train",
        python: `m = metrics(train[-h:], yhat_train)\n# careful: train scores flatter you`,
        status: "warn",
        detail: "train score is flattery",
      });
      return {
        ok: true,
        output: `Train-oriented metrics (be skeptical):\n${formatMetrics(this.trainMetrics)}`,
      };
    }
    if (test.length === 0) return err("Hold-out is empty. `split horizon=…` first.");
    this.metrics = computeMetrics(test, this.forecast.yhat, train, this.series.period);
    this.scoredOn = "horizon";
    this.inspectedMetrics = true;
    this.push({
      kind: "score",
      label: "score",
      python: `m = metrics(y_true=test, y_pred=yhat)\nprint(m["mae"], m["rmse"], m["mase"])`,
      status: "ok",
    });
    const snaive = forecastWith("snaive", train, this.forecast.horizon, this.series.period);
    const snaiveM = computeMetrics(test, snaive.yhat, train, this.series.period);
    this.compared = true;
    return {
      ok: true,
      output: [
        `Hold-out metrics (h=${test.length}):`,
        formatMetrics(this.metrics),
        "",
        `Seasonal-naive baseline MASE-comparable MAE = ${snaiveM.mae.toFixed(3)}`,
        this.metrics.mase != null
          ? this.metrics.mase < 1
            ? `MASE ${this.metrics.mase.toFixed(3)} < 1 — you beat seasonal naive.`
            : `MASE ${this.metrics.mase.toFixed(3)} ≥ 1 — seasonal naive is still winning.`
          : "MASE n/a",
      ].join("\n"),
    };
  }

  quantiles(): CommandResult {
    if (!this.forecast) return err("Forecast first.");
    if (!this.forecast.quantiles) {
      return err("This model has no quantile head. Use `fit timesfm` (or a probabilistic model).");
    }
    this.inspectedQuantiles = true;
    this.push({
      kind: "quantiles",
      label: "quantiles",
      python: `q = forecaster.forecast(context, horizon=h, return_quantiles=True)`,
      status: "ok",
    });
    return {
      ok: true,
      output: "Quantile fan ready on the stage. Bands should widen with horizon.",
    };
  }

  compare(): CommandResult {
    if (!this.series || !this.split) return err("Load and split first.");
    const train = this.trainSlice();
    const test = this.testSlice();
    const models: ModelName[] = ["naive", "snaive", "mean", "drift", "ses", "hw", "timesfm"];
    const lines = ["model        MAE     RMSE    MASE"];
    for (const m of models) {
      const fc = forecastWith(m, train, test.length, this.series.period, {});
      const met = computeMetrics(test, fc.yhat, train, this.series.period);
      lines.push(
        `${m.padEnd(12)} ${met.mae.toFixed(3).padStart(6)}  ${met.rmse.toFixed(3).padStart(6)}  ${
          met.mase == null ? " n/a" : met.mase.toFixed(3).padStart(6)
        }`,
      );
    }
    this.compared = true;
    this.push({
      kind: "compare",
      label: "compare",
      python: `for m in [naive, snaive, ets, timesfm]: evaluate(m, test)`,
      status: "ok",
    });
    return { ok: true, output: lines.join("\n") };
  }
}

function err(message: string): CommandResult {
  return { ok: false, output: message, error: message };
}
