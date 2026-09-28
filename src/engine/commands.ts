/**
 * Command parser for the LearnTS terminal dialect.
 */

import type { CommandResult, ModelName, SeriesName } from "./types";
import type { Session } from "./session";
import { SERIES_CATALOG } from "./series";
import { MODEL_LABELS } from "./models";

const MODELS: ModelName[] = ["naive", "snaive", "mean", "drift", "ses", "holt", "hw", "ar", "timesfm"];

export const HELP_TEXT = `LearnTS commands
  load <series>          ${SERIES_CATALOG.slice(0, 6).join(" | ")} …
  show data|chart|acf|pacf|decomp|metrics|forecast|split|quantiles|code
  decompose              additive trend / seasonal / residual
  diff [order=1] [lag=1]
  acf [lags=24]          autocorrelation
  pacf [lags=24]
  split horizon=12 [context=64]
  fit <model> [params]   ${MODELS.join(" | ")}
  forecast [horizon=12]
  score [train|horizon]
  quantiles
  compare                baselines side by side
  levels | goal | hint | reset | undo | clear | sandbox | help
  run <level-id>         e.g. run 1.1`;

export function parseParams(tokens: string[]): Record<string, number | string> {
  const params: Record<string, number | string> = {};
  for (const t of tokens) {
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq);
    const v = t.slice(eq + 1);
    const num = Number(v);
    params[k] = v !== "" && !Number.isNaN(num) ? num : v;
  }
  return params;
}

export function executeCommand(
  session: Session,
  raw: string,
  hooks: {
    onLevels: () => CommandResult;
    onGoal: () => CommandResult;
    onHint: () => CommandResult;
    onReset: () => CommandResult;
    onUndo: () => CommandResult;
    onClear: () => CommandResult;
    onSandbox: () => CommandResult;
    onRun: (id: string) => CommandResult;
  },
): CommandResult {
  const line = raw.trim();
  if (!line) return { ok: true, output: "" };
  const tokens = line.split(/\s+/);
  const cmd = tokens[0]!.toLowerCase();
  const rest = tokens.slice(1);

  switch (cmd) {
    case "help":
      return { ok: true, output: HELP_TEXT, python: "help()" };
    case "levels":
      return hooks.onLevels();
    case "goal":
      return hooks.onGoal();
    case "hint":
      return hooks.onHint();
    case "reset":
      return hooks.onReset();
    case "undo":
      return hooks.onUndo();
    case "clear":
      return hooks.onClear();
    case "sandbox":
      return hooks.onSandbox();
    case "run":
      return hooks.onRun(rest[0] ?? "");
    case "load": {
      const name = (rest[0] ?? "").toLowerCase() as SeriesName;
      if (!SERIES_CATALOG.includes(name)) {
        return {
          ok: false,
          error: "unknown series",
          output: `Unknown series "${rest[0] ?? ""}". Try: ${SERIES_CATALOG.join(", ")}`,
        };
      }
      return session.load(name);
    }
    case "show":
      return session.show((rest[0] ?? "chart").toLowerCase());
    case "decompose":
    case "decomp":
      return session.decomposeCmd();
    case "diff": {
      const p = parseParams(rest);
      return session.diff(Number(p.order ?? 1), Number(p.lag ?? 1));
    }
    case "acf": {
      const p = parseParams(rest);
      void p;
      return session.show("acf");
    }
    case "pacf":
      return session.show("pacf");
    case "split": {
      const p = parseParams(rest);
      const horizon = Number(p.horizon ?? 12);
      const context = Number(p.context ?? 64);
      return session.splitHorizon(horizon, context);
    }
    case "fit": {
      const name = (rest[0] ?? "").toLowerCase() as ModelName;
      if (!MODELS.includes(name)) {
        return {
          ok: false,
          error: "unknown model",
          output: `Unknown model "${rest[0] ?? ""}". Try: ${MODELS.join(", ")}`,
        };
      }
      return session.fit(name, parseParams(rest.slice(1)));
    }
    case "forecast": {
      const p = parseParams(rest);
      return session.forecastCmd(p.horizon != null ? Number(p.horizon) : undefined);
    }
    case "score": {
      const on = (rest[0] ?? "horizon").toLowerCase();
      return session.score(on === "train" ? "train" : "horizon");
    }
    case "quantiles":
      return session.quantiles();
    case "compare":
      return session.compare();
    default:
      return {
        ok: false,
        error: "unknown command",
        output: `Unknown command "${cmd}". Type \`help\`.`,
      };
  }
}

export function modelCatalog(): string {
  return MODELS.map((m) => `${m.padEnd(10)} ${MODEL_LABELS[m]}`).join("\n");
}
