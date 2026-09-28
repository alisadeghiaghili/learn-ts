/**
 * Shared helpers for level definitions.
 */

import type { SessionSnapshot, WinResult } from "../engine/types";

export function fail(feedback: string): WinResult {
  return { won: false, feedback };
}

export function win(feedback = "Clear. Concept locked."): WinResult {
  return { won: true, feedback };
}

export function hasSeries(s: SessionSnapshot): boolean {
  return Boolean(s.series);
}

export function hasTemporalSplit(s: SessionSnapshot): boolean {
  return Boolean(s.split?.temporal && !s.split.leaked && !s.leakageDetected);
}
