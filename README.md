# LearnTS

Interactive time-series sandbox and leveled tutorial.
Concepts first: from frequency and decomposition to baselines, metrics, and
TimesFM-style foundation forecasting.

## Modes

- **Levels** — short challenges with a concept brief, checklist, hint, and a win
  check that encodes the idea (not a magic command sequence).
- **Sandbox** — free command play on synthetic series.

Every command prints the Python sketch you will meet in production.

## Quick start

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # engine unit tests
npm run build     # static dist/
```

## Curriculum

| World | Idea |
|-------|------|
| 1 | A series is not a spreadsheet — index, decomposition, noise, stationarity |
| 2 | Time only moves forward — temporal split, context vs horizon, ACF, leakage |
| 3 | Baselines first — naive, seasonal naive, drift, MASE &lt; 1 |
| 4 | Metrics lie — MAE vs RMSE, MAPE traps, horizon curves |
| 5 | Smoothers — SES, Holt, Holt-Winters, AR, residual diagnostics |
| 6 | Foundation models — pretrain, patches, zero-shot, quantiles, covariates |

## Command dialect

```text
load <series>
show data|chart|acf|pacf|decomp|metrics|forecast|split|quantiles|code
decompose · diff · acf · pacf
split horizon=12 [context=64]
fit naive|snaive|mean|drift|ses|holt|hw|ar|timesfm [params]
forecast · score · quantiles · compare
levels · goal · hint · reset · undo · clear · sandbox · help
run <level-id>
```

## Architecture

```text
src/engine   pure TS state machine (no DOM)
src/ui       terminal, canvas charts, modals, progress
src/levels   level definitions + win predicates
tests/       vitest engine tests
```

UI depends on the engine public API only. Levels depend on `SessionSnapshot`.

## Adding a level

1. Open the right `src/levels/worldN.ts`.
2. Add a `Level` with `concept`, `goal`, `hints`, `steps`, and `win(state)`.
3. Win checks must encode the idea (e.g. score on horizon after a temporal split),
   not a brittle string of commands.
4. Run `npm test`.

## Notes

- The `timesfm` model path is a **pedagogical simulator** of the TimesFM mental
  model (context window, patches, zero-shot, quantile fan). It does not ship
  pretrained weights.
- Series are synthetic and deterministic so every learner sees the same numbers.
- Progress (solved levels) is stored in `localStorage`.

## License

Apache-2.0
