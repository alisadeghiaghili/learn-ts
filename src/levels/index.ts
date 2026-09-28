import type { Level } from "../engine/types";
import { WORLD1_LEVELS } from "./world1";
import { WORLD2_LEVELS } from "./world2";
import { WORLD3_LEVELS } from "./world3";
import { WORLD4_LEVELS } from "./world4";
import { WORLD5_LEVELS } from "./world5";
import { WORLD6_LEVELS } from "./world6";

export const ALL_LEVELS: Level[] = [
  ...WORLD1_LEVELS,
  ...WORLD2_LEVELS,
  ...WORLD3_LEVELS,
  ...WORLD4_LEVELS,
  ...WORLD5_LEVELS,
  ...WORLD6_LEVELS,
];

export interface WorldInfo {
  id: string;
  title: string;
  levels: Level[];
}

export const WORLDS: WorldInfo[] = [
  { id: "w1", title: "A series is not a spreadsheet", levels: WORLD1_LEVELS },
  { id: "w2", title: "Time only moves forward", levels: WORLD2_LEVELS },
  { id: "w3", title: "Baselines first", levels: WORLD3_LEVELS },
  { id: "w4", title: "Metrics lie", levels: WORLD4_LEVELS },
  { id: "w5", title: "Smoothers and simple structure", levels: WORLD5_LEVELS },
  { id: "w6", title: "Foundation models", levels: WORLD6_LEVELS },
];

export function getLevel(id: string): Level | undefined {
  return ALL_LEVELS.find((l) => l.id === id);
}

export function getNextLevel(id: string): Level | undefined {
  const i = ALL_LEVELS.findIndex((l) => l.id === id);
  return i >= 0 ? ALL_LEVELS[i + 1] : undefined;
}

export function curriculumOutcomes(): string[] {
  return [
    "Read a series: frequency, period, trend, season, residual",
    "Split time forward and refuse leakage",
    "Beat the right baseline (naive / snaive / drift)",
    "Choose metrics that do not lie (MAE, RMSE, MASE)",
    "Use SES / Holt / Holt-Winters / AR with intent",
    "Run and evaluate zero-shot TimesFM-style forecasts",
    "Use quantiles, covariates, and multivariate shape correctly",
  ];
}
