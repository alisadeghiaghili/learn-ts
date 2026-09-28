/**
 * Shared engine types for the LearnTS sandbox.
 *
 * A faithful time-series forecasting mental model: series → temporal split →
 * model → forecast → metrics. No DOM, no real model weights.
 */

export type SeriesName =
  | "trend"
  | "seasonal"
  | "airline"
  | "retail"
  | "energy"
  | "random_walk"
  | "noise"
  | "intermittent"
  | "outlier"
  | "level"
  | "shift"
  | "short_season";

export type ModelName =
  | "naive"
  | "snaive"
  | "mean"
  | "drift"
  | "ses"
  | "holt"
  | "hw"
  | "ar"
  | "timesfm";

export type Freq = "D" | "W" | "M" | "Q" | "H";

export interface Series {
  readonly name: SeriesName;
  readonly label: string;
  readonly freq: Freq;
  readonly freqLabel: string;
  readonly period: number;
  readonly y: readonly number[];
  /** Optional known-future covariate (e.g. calendar intensity 0..1). */
  readonly known?: readonly number[];
  readonly description: string;
}

export interface TemporalSplit {
  readonly horizon: number;
  readonly context: number;
  readonly trainEnd: number;
  /** true when train/test were cut in time order (always required). */
  readonly temporal: boolean;
  /** true if someone attempted to shuffle / leak future into train. */
  readonly leaked: boolean;
}

export interface ForecastResult {
  readonly model: ModelName;
  readonly yhat: readonly number[];
  readonly horizon: number;
  /** Quantile fan: q → horizon-length array (optional). */
  readonly quantiles?: Readonly<Record<string, readonly number[]>>;
  readonly params: Readonly<Record<string, number | string>>;
}

export interface Metrics {
  readonly mae: number;
  readonly rmse: number;
  readonly mape: number | null;
  readonly smape: number;
  readonly mase: number | null;
  readonly n: number;
  readonly perHorizon: readonly number[];
}

export interface Decomposition {
  readonly trend: readonly number[];
  readonly seasonal: readonly number[];
  readonly residual: readonly number[];
  readonly period: number;
}

export interface PipelineStep {
  readonly kind:
    | "load"
    | "decompose"
    | "diff"
    | "acf"
    | "pacf"
    | "split"
    | "fit"
    | "forecast"
    | "score"
    | "quantiles"
    | "compare"
    | "reset";
  readonly label: string;
  readonly python: string;
  readonly status: "ok" | "warn" | "error";
  readonly detail?: string;
}

export interface WinResult {
  readonly won: boolean;
  readonly feedback: string;
}

export interface ConceptBrief {
  readonly title: string;
  readonly body: string;
  readonly whatHappens: string;
  readonly why: string;
  readonly formula?: string;
  readonly callout?: string;
}

export interface GoalStep {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly command?: string;
  readonly check: (state: SessionSnapshot) => boolean;
}

export interface Level {
  readonly id: string;
  readonly world: string;
  readonly worldTitle: string;
  readonly title: string;
  readonly concept: ConceptBrief;
  readonly goal: string;
  readonly hints: readonly string[];
  readonly learning: readonly string[];
  readonly steps: readonly GoalStep[];
  readonly seedSeries?: SeriesName;
  readonly win: (state: SessionSnapshot) => WinResult;
}

export interface SessionSnapshot {
  readonly series: Series | null;
  readonly decomposition: Decomposition | null;
  readonly differenced: boolean;
  readonly diffOrder: number;
  readonly acf: readonly number[] | null;
  readonly pacf: readonly number[] | null;
  readonly split: TemporalSplit | null;
  readonly model: ModelName | null;
  readonly modelParams: Readonly<Record<string, number | string>>;
  readonly fitted: boolean;
  readonly forecast: ForecastResult | null;
  readonly metrics: Metrics | null;
  readonly trainMetrics: Metrics | null;
  readonly scoredOn: "train" | "horizon" | null;
  readonly inspectedData: boolean;
  readonly inspectedChart: boolean;
  readonly inspectedAcf: boolean;
  readonly inspectedDecomp: boolean;
  readonly inspectedMetrics: boolean;
  readonly inspectedForecast: boolean;
  readonly inspectedQuantiles: boolean;
  readonly compared: boolean;
  readonly beatSnaive: boolean | null;
  readonly mase: number | null;
  readonly leakageDetected: boolean;
  readonly steps: readonly PipelineStep[];
  readonly commandCount: number;
  /** Last forecaster used without fitting on train only. */
  readonly fitOnFull: boolean;
}

export interface CommandResult {
  readonly ok: boolean;
  readonly output: string;
  readonly error?: string;
  readonly python?: string;
}
