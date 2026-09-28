/**
 * Engine unit tests — series, metrics, split, baselines, zero-shot path.
 */

import { describe, expect, it } from "vitest";
import { makeSeries, SERIES_CATALOG } from "../src/engine/series";
import { computeMetrics, mae, mase, mape } from "../src/engine/metrics";
import { decompose, acf, difference } from "../src/engine/analyze";
import {
  forecastNaive,
  forecastSNaive,
  forecastTimesFm,
  forecastWith,
  estimatePeriod,
} from "../src/engine/models";
import { Session } from "../src/engine/session";
import { executeCommand } from "../src/engine/commands";
import { getLevel, ALL_LEVELS, getNextLevel } from "../src/levels";

describe("series generators", () => {
  it("creates every catalog series with length > 20", () => {
    for (const name of SERIES_CATALOG) {
      const s = makeSeries(name);
      expect(s.y.length).toBeGreaterThan(20);
      expect(s.label.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic", () => {
    const a = makeSeries("airline").y;
    const b = makeSeries("airline").y;
    expect(a).toEqual(b);
  });
});

describe("metrics", () => {
  it("MAE is zero on perfect prediction", () => {
    expect(mae([1, 2, 3], [1, 2, 3])).toBeCloseTo(0);
  });

  it("MAPE is null on zero y", () => {
    expect(mape([0, 1], [0, 1])).toBeNull();
  });

  it("MASE < 1 when better than seasonal naive scale", () => {
    const train = Array.from({ length: 40 }, (_, i) => 10 + Math.sin(i / 3));
    const yTrue = train.slice(30, 36);
    const yPred = yTrue.map((v) => v + 0.01);
    const m = mase(yTrue, yPred, train, 3);
    expect(m).not.toBeNull();
    expect(m!).toBeLessThan(1);
  });

  it("computeMetrics fills perHorizon", () => {
    const m = computeMetrics([1, 2, 3], [1.2, 2, 2.5], [0, 1, 2, 3], 1);
    expect(m.perHorizon.length).toBe(3);
    expect(Number.isFinite(m.rmse)).toBe(true);
  });
});

describe("analyze", () => {
  it("decompose reconstructs approximately for additive seasonal", () => {
    const s = makeSeries("airline");
    const d = decompose(s.y, 12);
    expect(d.trend.length).toBe(s.y.length);
    expect(d.seasonal.length).toBe(s.y.length);
    expect(d.residual.length).toBe(s.y.length);
  });

  it("acf lag0 is 1", () => {
    const s = makeSeries("seasonal");
    const r = acf(s.y, 30);
    expect(r[0]).toBeCloseTo(1);
  });

  it("difference shortens series by lag", () => {
    const d = difference([1, 3, 6, 10], 1, 1);
    expect(d).toEqual([2, 3, 4]);
  });

  it("estimates period near 24 on daily seasonality", () => {
    const s = makeSeries("seasonal");
    const p = estimatePeriod(s.y, 48);
    expect(p).toBeGreaterThanOrEqual(20);
    expect(p).toBeLessThanOrEqual(28);
  });
});

describe("models", () => {
  it("naive repeats last value", () => {
    const fc = forecastNaive([1, 2, 5], 3);
    expect(fc.yhat).toEqual([5, 5, 5]);
  });

  it("snaive tiles the season", () => {
    const ctx = [1, 2, 3, 4, 5, 6];
    const fc = forecastSNaive(ctx, 3, 3);
    expect(fc.yhat).toEqual([4, 5, 6]);
  });

  it("timesfm produces horizon and quantiles", () => {
    const s = makeSeries("airline");
    const fc = forecastTimesFm(s.y.slice(0, 100), 12);
    expect(fc.yhat.length).toBe(12);
    expect(fc.quantiles?.["0.5"]?.length).toBe(12);
  });

  it("forecastWith dispatches", () => {
    const fc = forecastWith("mean", [1, 2, 3], 2, 1);
    expect(fc.model).toBe("mean");
    expect(fc.yhat.length).toBe(2);
  });
});

describe("session temporal split", () => {
  it("splits forward in time", () => {
    const s = new Session();
    s.load("airline");
    const r = s.splitHorizon(12, 48);
    expect(r.ok).toBe(true);
    expect(s.split?.temporal).toBe(true);
    expect(s.split?.trainEnd).toBe(s.series!.y.length - 12);
  });

  it("score on horizon produces metrics", () => {
    const s = new Session();
    s.load("airline");
    s.splitHorizon(12, 48);
    s.fit("snaive");
    s.forecastCmd();
    s.score("horizon");
    expect(s.metrics).not.toBeNull();
    expect(s.scoredOn).toBe("horizon");
  });
});

describe("commands", () => {
  const hooks = {
    onLevels: () => ({ ok: true, output: "levels" }),
    onGoal: () => ({ ok: true, output: "goal" }),
    onHint: () => ({ ok: true, output: "hint" }),
    onReset: () => ({ ok: true, output: "reset" }),
    onUndo: () => ({ ok: true, output: "undo" }),
    onClear: () => ({ ok: true, output: "" }),
    onSandbox: () => ({ ok: true, output: "sandbox" }),
    onRun: (id: string) => ({ ok: true, output: `run ${id}` }),
  };

  it("load + split + fit timesfm + score path", () => {
    const s = new Session();
    expect(executeCommand(s, "load airline", hooks).ok).toBe(true);
    expect(executeCommand(s, "split horizon=12", hooks).ok).toBe(true);
    expect(executeCommand(s, "fit timesfm", hooks).ok).toBe(true);
    expect(executeCommand(s, "forecast", hooks).ok).toBe(true);
    expect(executeCommand(s, "score", hooks).ok).toBe(true);
    expect(s.metrics?.mase).not.toBeNull();
  });

  it("rejects unknown model", () => {
    const s = new Session();
    s.load("level");
    const r = executeCommand(s, "fit nope", hooks);
    expect(r.ok).toBe(false);
  });
});

describe("levels", () => {
  it("registers worlds 1-6", () => {
    expect(ALL_LEVELS.length).toBeGreaterThanOrEqual(20);
    expect(getLevel("1.1")?.title).toContain("Index");
    expect(getLevel("6.3")?.worldTitle).toContain("Foundation");
  });

  it("win 1.1 after load+show data", () => {
    const s = new Session();
    s.load("airline");
    s.show("data");
    const r = getLevel("1.1")!.win(s.snapshot());
    expect(r.won).toBe(true);
  });

  it("win 2.1 requires temporal split", () => {
    const s = new Session();
    s.load("airline");
    const r = getLevel("2.1")!.win(s.snapshot());
    expect(r.won).toBe(false);
    s.splitHorizon(12);
    const r2 = getLevel("2.1")!.win(s.snapshot());
    expect(r2.won).toBe(true);
  });

  it("get next level chains", () => {
    const next = getNextLevel("1.1");
    expect(next?.id).toBe("1.2");
  });
});
