# LearnTS — Product & Design Spec

Interactive time-series sandbox and leveled tutorial.
Curriculum moves from series fundamentals to foundation-model forecasting
(TimesFM mental model). Concepts first; the API surface the learner will meet
in production is always visible next to the sandbox command.

## Product thesis

Time series fails silently: random splits look fine, MAPE flatters low-volume
items, a seasonal-naive baseline beats your "model", and a foundation model
hallucinates a trend nobody asked for.
LearnTS makes those states visible, challengeable, and hard to forget.

Three modes, same shell:

1. **Sandbox** — free command play on synthetic series.
2. **Levels** — short challenges with a win condition and a concept brief.
3. **Concept labs** — watch a surface change (decomposition, ACF, horizon
   error curve, quantile fan).

Every user action updates a stage that always shows:

- the series and any forecast overlay
- train / context / horizon regions (never mixed)
- decomposition or ACF when requested
- metrics panel
- pipeline strip (series → split → model → forecast → score)
- the Python equivalent of the last command

## Out of scope (v1)

- Real TimesFM weights / GPU inference (the engine is a faithful *mental model*).
- Real CPython execution (Pyodide is a later backend).
- Production data connectors, user accounts, remote progress sync.

v1 ships a TypeScript engine that implements honest baselines, classical
smoothers, and a patch-style zero-shot forecaster used to teach the TimesFM
concept path. Code panels show the real Python API shape learners will meet.

## Information architecture

```
Chrome:  LearnTS · levels · sandbox · goal
Left:    level rail (worlds → levels, solved markers)
Center:  concept brief (paper) + visual stage (dark lab)
Bottom:  command dock + Python equivalent + status
```

### Level schema

```ts
interface Level {
  id: string;
  title: string;
  world: string;
  concept: ConceptBrief;      // why this matters
  goal: string;               // one sentence win condition
  hints: string[];
  win: (state: SessionSnapshot) => WinResult;
  seedSeries?: SeriesName;
}
```

### Command grammar (maps to a TimesFM-flavored Python mental model)

```
help | levels | goal | hint | reset | undo | clear | sandbox
load <series>
show data|chart|acf|decomp|metrics|code|forecast|split|quantiles
decompose
diff [order=1] [lag=1]
acf [lags=24]
pacf [lags=24]
split horizon=12 [context=64]
fit naive|snaive|mean|drift|ses|holt|hw|ar|timesfm [param=value ...]
forecast horizon=12
score
quantiles [q=0.1,0.5,0.9]
compare
run <level-id>
```

Example equivalence taught in the dock:

```text
split horizon=12
→ train, test = temporal_split(series, horizon=12)

fit timesfm
→ from timesfm import TimesFM
  forecaster = TimesFM.from_pretrained("google/timesfm-2.5-200m-pytorch")
  fc = forecaster.forecast(context, horizon=12)
```

## Pedagogy rules

1. Concept brief opens every level in plain language (no jargon dump).
2. Win checks encode the *idea*, not a magic command sequence
   (e.g. "beat seasonal-naive MASE < 1 **and** evaluate only on the hold-out horizon").
3. Failure feedback is diagnostic: name the misconception, not "wrong".
4. The Python line is always visible after a DSL command.
5. Golf counters exist as a stretch goal, not the main score.
6. Never let a random split look successful.

## World map (v1 content)

**World 1 — A series is not a spreadsheet**

| id | concept | win sketch |
|----|---------|------------|
| 1.1 | index, value, frequency | load + `show data` |
| 1.2 | trend / seasonality / residual | `decompose` on seasonal series |
| 1.3 | noise vs signal | contrast pure noise with structured series |
| 1.4 | stationarity and differencing | `diff` then inspect ACF |

**World 2 — Time only moves forward**

| id | concept | win sketch |
|----|---------|------------|
| 2.1 | temporal split | `split horizon=…`, never shuffle |
| 2.2 | context vs horizon | choose a context long enough for season |
| 2.3 | autocorrelation | `acf` finds the period |
| 2.4 | leakage | refuse "fit on all data then score on all data" |

**World 3 — Baselines first**

| id | concept | win sketch |
|----|---------|------------|
| 3.1 | naive last-value | forecast with naive on a walk |
| 3.2 | seasonal naive | beat naive on strong seasonality |
| 3.3 | drift / mean | pick the right simple baseline |
| 3.4 | MASE < 1 vs snaive | any real model must beat snaive |

**World 4 — Metrics lie**

| id | concept | win sketch |
|----|---------|------------|
| 4.1 | MAE vs RMSE | outlier series, choose the right loss |
| 4.2 | MAPE / sMAPE traps | low-volume intermittent series |
| 4.3 | horizon error curve | error grows with h |
| 4.4 | report both point and scale-free | MASE + MAE |

**World 5 — Smoothers and simple structure**

| id | concept | win sketch |
|----|---------|------------|
| 5.1 | exponential smoothing | SES on level-only series |
| 5.2 | Holt / Holt-Winters | trend+season, watch components |
| 5.3 | AR as memory | short memory series |
| 5.4 | residuals should be boring | diagnose leftover structure |

**World 6 — Foundation models (TimesFM path)**

| id | concept | win sketch |
|----|---------|------------|
| 6.1 | pretrain on many series | why zero-shot can work |
| 6.2 | patches and context | patch length, context window |
| 6.3 | zero-shot forecast | `fit timesfm` without training |
| 6.4 | quantile forecasts | fan chart, coverage |
| 6.5 | zero-shot vs fine-tune | when domain shift hurts |
| 6.6 | covariates past / future | known calendar vs observed only |
| 6.7 | multivariate channels | joint vs independent |

## Visual system

**Style anchor:** laboratory instrument face + cool editorial notebook.
Not SaaS cards, not warm cream editorial, not neon-on-black.

**Palette**

| token | hex | role |
|-------|-----|------|
| void | `#0A1018` | stage / terminal ground |
| surface | `#13202C` | elevated dark panels |
| paper | `#E6E9E4` | concept brief (cool sage paper) |
| ink | `#0F1518` | text on paper |
| chalk | `#C5CED6` | text on dark |
| signal | `#F0B429` | primary accent — active / fitted |
| alarm | `#E23D51` | leakage, errors |
| calm | `#2A9D8F` | solved, valid |
| series | `#5B8DEF` | observed series |
| forecast | `#9B7EDE` | model forecast |
| band | `#2A9D8F` | quantile band / hold-out |

**Typography**

- Display / concept titles: `Newsreader`
- UI / body labels: `IBM Plex Sans`
- Code / terminal / metrics: `IBM Plex Mono`

Scale: concept title 28–32px / 500; brief body 16px / 1.55; UI 13–14px;
mono 12–13px. Max measure for brief text ≈ 62ch.

**Layout rhythm**

8px base. Shell is a full-viewport instrument panel:

```
┌──────────────────────────────────────────────────┐
│ top chrome (48px)                                │
├──────────┬───────────────────────────────────────┤
│ rail     │ brief (auto, paper)                   │
│ 220px    ├───────────────────────────────────────┤
│          │ stage (flex, void)  chart + pipeline  │
├──────────┴───────────────────────────────────────┤
│ dock (132px) command · Python equivalent         │
└──────────────────────────────────────────────────┘
```

**Signature moments**

1. **Forecast bloom** — on successful `forecast` / `fit`, the forecast path
   draws in (~400ms) and the model node on the pipeline strip ignites `signal`.
2. **Leakage strike** — illegal order (score on train as win, random split,
   fit on full series then score on the same points) paints the pipeline edge
   `alarm` and opens a short concept callout.
3. **Quantile fan** — probabilistic forecasts widen as horizon grows.

Motion respects `prefers-reduced-motion`. Focus rings are 2px `signal`.

## Architecture

```
src/engine   pure TS state machine (series generators, split, baselines,
             smoothers, metrics, ACF, patch-style zero-shot forecaster,
             command parser). No DOM.
src/ui       DOM + canvas renderers (terminal, stage, charts, pipeline).
src/levels   level definitions + win predicates.
tests/       engine unit tests (vitest).
```

Dependency inversion: UI depends on `engine` public API only. Levels depend on
`SessionSnapshot` read model. Engine never imports UI.

## Tech

- Vite + TypeScript (strict)
- Vitest for engine tests
- No UI framework — terminal + canvas control matters more than component
  bookkeeping; keeps the bundle small and the interaction tight.
- Fonts via Google Fonts with system stack fallback.

## Success criteria for v1

1. Sandbox usable end-to-end for series → split → fit → forecast → score.
2. Worlds 1–3 completable with concept briefs and honest win checks;
   Worlds 4–6 ship as complete levels.
3. Every command prints its Python equivalent.
4. `npm test` green; `npm run build` produces a static `dist/`.
5. README explains pedagogy and how to add a level.
6. No external product name of any other learn-game is mentioned in docs or UI.
