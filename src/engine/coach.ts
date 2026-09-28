/**
 * Coach lines: diagnostic feedback when a win check fails.
 */

import type { SessionSnapshot } from "./types";

export function coachLine(state: SessionSnapshot, goal: string): string {
  if (!state.series) return "Load a series before anything else. `load airline` is a good start.";
  if (!state.split) return "Cut time forward first: `split horizon=12`. Never shuffle.";
  if (!state.fitted || !state.forecast) return "Fit a model on the train slice: `fit snaive` or `fit timesfm`.";
  if (!state.metrics) return "Score only on the hold-out: `score`.";
  if (state.leakageDetected) {
    return "Leakage detected. Future values must not enter training. Reset and split again.";
  }
  if (state.scoredOn === "train") {
    return "Train scores flatter you. Score the hold-out horizon.";
  }
  return `You are close. Current goal: ${goal}`;
}

export function nextSteps(state: SessionSnapshot): string[] {
  const steps: string[] = [];
  if (!state.series) steps.push("load <series>");
  if (!state.inspectedData) steps.push("show data");
  if (!state.split) steps.push("split horizon=12");
  if (!state.fitted) steps.push("fit <model>");
  if (!state.forecast) steps.push("forecast");
  if (!state.metrics) steps.push("score");
  return steps;
}
