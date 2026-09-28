/**
 * LearnTS — interactive time-series sandbox and leveled tutorial.
 */

import "./styles/app.css";
import type { CommandResult, Level } from "./engine/types";
import { Session } from "./engine/session";
import { executeCommand, HELP_TEXT } from "./engine/commands";
import { WORLDS, getLevel, getNextLevel, curriculumOutcomes } from "./levels";
import { drawChart, type ChartKind, type DrawState } from "./ui/charts";
import { TerminalView, type LogLine } from "./ui/terminal";
import { renderMarkdown, showModal, closeModal } from "./ui/dialog";
import { launchConfetti, playFanfare } from "./ui/confetti";
import {
  loadProgress,
  markSolved,
  summarizeCurriculum,
  type LevelProgress,
} from "./ui/progress";
import { MODEL_LABELS } from "./engine/models";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

class App {
  private root: HTMLElement;
  private session: Session;
  private level: Level | null = null;
  private log: LogLine[] = [];
  private golf: string[] = [];
  private progress: LevelProgress = loadProgress();
  private terminal!: TerminalView;
  private chartEl!: HTMLCanvasElement;
  private pipelineEl!: HTMLElement;
  private briefEl!: HTMLElement;
  private titleEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private undoStack: Session[] = [];
  private chartKind: ChartKind = "series";
  private fitProgress = 1;
  private solvedFlash = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.session = new Session();
    this.mount();
    this.renderAll();
    this.pushMeta("LearnTS — time series from zero to foundation models.");
    this.pushMeta("Type `help`, `levels`, or `load airline` to start.");
    const summary = summarizeCurriculum(this.progress);
    if (summary.solvedCount > 0) {
      this.pushOut("");
      this.pushMeta(`Progress restored: ${summary.solvedCount} level(s) solved.`);
    }
  }

  private mount(): void {
    this.root.innerHTML = `
      <div class="shell">
        <header class="chrome">
          <div class="brand">Learn<span>TS</span><span class="brand-sub">TIMESFM PATH</span></div>
          <nav class="chrome-nav" aria-label="primary">
            <button type="button" data-action="levels">Levels</button>
            <button type="button" data-action="goal">Goal</button>
            <button type="button" data-action="hint">Hint</button>
            <button type="button" data-action="lesson">Lesson</button>
            <button type="button" data-action="undo">Undo</button>
            <button type="button" data-action="reset">Reset</button>
            <button type="button" data-action="sandbox">Sandbox</button>
            <button type="button" data-action="help">Help</button>
          </nav>
          <div class="chrome-meta" id="chrome-meta">sandbox</div>
        </header>
        <div class="body">
          <aside class="rail" id="rail" aria-label="levels"></aside>
          <div class="stage-col">
            <section class="brief" id="brief" aria-label="concept brief"></section>
            <section class="stage">
              <div class="stage-canvas-wrap">
                <canvas id="chart" width="900" height="320" aria-label="time series chart"></canvas>
              </div>
              <div class="pipeline" id="pipeline"></div>
            </section>
          </div>
        </div>
        <div class="dock">
          <div class="terminal" id="terminal"></div>
          <div class="dock-status" id="dock-status"></div>
        </div>
      </div>
    `;
    this.chartEl = this.root.querySelector("#chart")!;
    this.pipelineEl = this.root.querySelector("#pipeline")!;
    this.briefEl = this.root.querySelector("#brief")!;
    this.titleEl = this.root.querySelector("#chrome-meta")!;
    this.statusEl = this.root.querySelector("#dock-status")!;
    this.terminal = new TerminalView(this.root.querySelector("#terminal")!, (cmd) =>
      this.handleCommand(cmd),
    );
    this.root.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "levels") this.openLevels();
        if (action === "goal") this.focusGuide();
        if (action === "hint") this.handleCommand("hint");
        if (action === "lesson") this.replayLesson();
        if (action === "undo") this.handleCommand("undo");
        if (action === "reset") this.handleCommand("reset");
        if (action === "sandbox") this.handleCommand("sandbox");
        if (action === "help") this.openHelp();
        this.terminal.focus();
      });
    });
    window.addEventListener("resize", () => this.drawStage());
  }

  private pushOut(text: string): void {
    for (const line of text.split("\n")) {
      this.log.push({ kind: "out", text: line });
    }
    this.terminal.render(this.log);
  }

  private pushMeta(text: string): void {
    for (const line of text.split("\n")) {
      this.log.push({ kind: "meta", text: line });
    }
    this.terminal.render(this.log);
  }

  private pushOk(text: string): void {
    for (const line of text.split("\n")) {
      this.log.push({ kind: "ok", text: line });
    }
    this.terminal.render(this.log);
  }

  private pushErr(text: string): void {
    this.log.push({ kind: "err", text });
    this.terminal.render(this.log);
  }

  private pushPy(text: string): void {
    for (const line of text.split("\n")) {
      this.log.push({ kind: "py", text: line });
    }
    this.terminal.render(this.log);
  }

  private handleCommand(raw: string): void {
    const line = raw.trim();
    this.log.push({ kind: "cmd", text: `› ${line}` });
    this.terminal.render(this.log);
    this.golf.push(line);
    this.undoStack.push(this.session.clone());
    if (this.undoStack.length > 40) this.undoStack.shift();

    const result = executeCommand(this.session, line, {
      onLevels: () => this.cmdLevels(),
      onGoal: () => this.cmdGoal(),
      onHint: () => this.cmdHint(),
      onReset: () => this.cmdReset(),
      onUndo: () => this.cmdUndo(),
      onClear: () => this.cmdClear(),
      onSandbox: () => this.cmdSandbox(),
      onRun: (id) => this.cmdRun(id),
    });

    if (result.python) this.pushPy(result.python);
    if (result.ok) {
      if (result.output) this.pushOut(result.output);
    } else {
      this.pushErr(result.error ?? result.output);
    }
    this.renderAll();
    this.checkWin();
  }

  private cmdLevels(): CommandResult {
    const lines = ["Available levels:"];
    for (const w of WORLDS) {
      lines.push(`  ${w.title}`);
      for (const l of w.levels) {
        const done = this.progress.solved[l.id] ? "✓" : " ";
        lines.push(`   [${done}] ${l.id}  ${l.title}`);
      }
    }
    this.openLevels();
    return { ok: true, output: lines.join("\n") };
  }

  private cmdGoal(): CommandResult {
    if (!this.level) {
      return {
        ok: true,
        output: "Sandbox mode. Try `load airline` → `split horizon=12` → `fit timesfm` → `score`. Or `levels` to pick a challenge.",
      };
    }
    return {
      ok: true,
      output: [`Goal ${this.level.id} — ${this.level.title}`, this.level.goal].join("\n"),
    };
  }

  private cmdHint(): CommandResult {
    if (!this.level) return { ok: true, output: "No level active. `levels` then `run <id>`." };
    const hints = this.level.hints;
    return {
      ok: true,
      output: hints.map((h, i) => `hint ${i + 1}: ${h}`).join("\n"),
    };
  }

  private cmdReset(): CommandResult {
    this.session = this.level
      ? this.applySeed(new Session())
      : new Session();
    this.undoStack = [];
    this.golf = [];
    this.chartKind = "series";
    this.fitProgress = 1;
    this.renderAll();
    return { ok: true, output: "Reset. Clean slate." };
  }

  private cmdUndo(): CommandResult {
    const prev = this.undoStack.pop();
    if (!prev) return { ok: false, error: "Nothing to undo.", output: "Nothing to undo." };
    this.session = prev;
    this.renderAll();
    return { ok: true, output: "Undid last command." };
  }

  private cmdClear(): CommandResult {
    this.log = [];
    this.terminal.clearLog();
    return { ok: true, output: "" };
  }

  private cmdSandbox(): CommandResult {
    this.level = null;
    this.session = new Session();
    this.chartKind = "series";
    this.renderAll();
    return { ok: true, output: "Sandbox mode. Free play." };
  }

  private cmdRun(id: string): CommandResult {
    const level = getLevel(id);
    if (!level) {
      return {
        ok: false,
        error: "unknown level",
        output: `Unknown level "${id}". Type \`levels\`.`,
      };
    }
    this.startLevel(level);
    return {
      ok: true,
      output: [`Level ${level.id} — ${level.title}`, level.goal].join("\n"),
    };
  }

  private applySeed(s: Session): Session {
    if (this.level?.seedSeries) {
      s.load(this.level.seedSeries);
    }
    return s;
  }

  private startLevel(level: Level): void {
    this.level = level;
    this.session = this.applySeed(new Session());
    this.undoStack = [];
    this.golf = [];
    this.solvedFlash = false;
    this.chartKind = "series";
    this.fitProgress = 1;
    this.renderAll();
    this.replayLesson();
  }

  private replayLesson(): void {
    if (!this.level) return;
    const c = this.level.concept;
    showModal(`
      <h2>${escapeHtml(this.level.id)} · ${escapeHtml(this.level.title)}</h2>
      <p><strong>${escapeHtml(c.title)}</strong></p>
      ${renderMarkdown(c.body)}
      <h3>What happens here</h3>
      ${renderMarkdown(c.whatHappens)}
      <h3>Why it matters</h3>
      ${renderMarkdown(c.why)}
      ${c.formula ? `<div class="formula">${escapeHtml(c.formula)}</div>` : ""}
      ${c.callout ? `<div class="callout">${escapeHtml(c.callout)}</div>` : ""}
      <h3>Goal</h3>
      <p>${escapeHtml(this.level.goal)}</p>
      <p><em>You will learn:</em> ${this.level.learning.map((l) => escapeHtml(l)).join(" · ")}</p>
      <div class="actions">
        <button type="button" class="primary" data-close>Start</button>
      </div>
    `);
  }

  private openLevels(): void {
    const items = WORLDS.map((w) => {
      const rows = w.levels
        .map((l) => {
          const done = this.progress.solved[l.id];
          return `
            <button type="button" data-level="${escapeHtml(l.id)}">
              <div class="lid">${escapeHtml(l.id)}${done ? ' <span class="solved">✓ solved</span>' : ""}</div>
              <div class="ltitle">${escapeHtml(l.title)}</div>
            </button>`;
        })
        .join("");
      return `<h3>${escapeHtml(w.title)}</h3><div class="level-list">${rows}</div>`;
    }).join("");
    showModal(`
      <h2>Levels</h2>
      <p>Concept-first challenges. Each one teaches one idea you cannot skip.</p>
      ${items}
      <div class="actions">
        <button type="button" class="primary" data-close>Close</button>
        <button type="button" class="ghost" data-action-sandbox>Sandbox</button>
      </div>
    `);
    document.querySelectorAll<HTMLButtonElement>("[data-level]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.level!;
        closeModal();
        this.handleCommand(`run ${id}`);
      });
    });
    document.querySelector("[data-action-sandbox]")?.addEventListener("click", () => {
      closeModal();
      this.handleCommand("sandbox");
    });
  }

  private openHelp(): void {
    showModal(`
      <h2>Help</h2>
      <p>LearnTS teaches time-series forecasting from first principles to TimesFM-style foundation models.</p>
      <h3>Modes</h3>
      <ul>
        <li><strong>Levels</strong> — guided challenges with concept briefs and win checks.</li>
        <li><strong>Sandbox</strong> — free command play.</li>
      </ul>
      <h3>Commands</h3>
      <pre class="mono">${escapeHtml(HELP_TEXT)}</pre>
      <h3>Outcomes</h3>
      <ul>${curriculumOutcomes().map((o) => `<li>${escapeHtml(o)}</li>`).join("")}</ul>
      <div class="actions"><button type="button" class="primary" data-close>Close</button></div>
    `);
  }

  private focusGuide(): void {
    this.briefEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  private checkWin(): void {
    if (!this.level || this.solvedFlash) return;
    const snap = this.session.snapshot();
    const result = this.level.win(snap);
    if (!result.won) return;
    this.solvedFlash = true;
    this.progress = markSolved(this.progress, this.level.id, this.golf.length);
    this.pushOk(result.feedback);
    launchConfetti();
    playFanfare();
    const next = getNextLevel(this.level.id);
    const nextLabel = next ? `Next: ${next.id} ${next.title}` : "Curriculum complete.";
    showModal(`
      <h2>Level clear</h2>
      <p>${escapeHtml(result.feedback)}</p>
      <p><strong>${escapeHtml(nextLabel)}</strong></p>
      <div class="actions">
        ${next ? `<button type="button" class="primary" data-next="${escapeHtml(next.id)}">Continue</button>` : ""}
        <button type="button" class="ghost" data-close>Stay here</button>
      </div>
    `);
    const nbtn = document.querySelector<HTMLButtonElement>("[data-next]");
    nbtn?.addEventListener("click", () => {
      closeModal();
      this.handleCommand(`run ${nbtn.dataset.next!}`);
    });
  }

  private renderAll(): void {
    this.renderRail();
    this.renderBrief();
    this.renderPipeline();
    this.renderStatus();
    this.drawStage();
    this.titleEl.textContent = this.level
      ? `${this.level.id} · ${this.level.title}`
      : "sandbox";
  }

  private renderRail(): void {
    const rail = this.root.querySelector("#rail")!;
    rail.innerHTML = WORLDS.map((w) => {
      const items = w.levels
        .map((l) => {
          const done = Boolean(this.progress.solved[l.id]);
          const active = this.level?.id === l.id;
          return `<button type="button" class="rail-item${active ? " is-active" : ""}${done ? " is-done" : ""}" data-run="${escapeHtml(l.id)}">
            <span class="id">${escapeHtml(l.id)}</span>
            <span>${escapeHtml(l.title)}</span>
          </button>`;
        })
        .join("");
      return `<div class="rail-world"><div class="rail-world-title">${escapeHtml(w.title)}</div>${items}</div>`;
    }).join("");
    rail.querySelectorAll<HTMLButtonElement>("[data-run]").forEach((btn) => {
      btn.addEventListener("click", () => this.handleCommand(`run ${btn.dataset.run}`));
    });
  }

  private renderBrief(): void {
    if (!this.level) {
      this.briefEl.innerHTML = `
        <h2>Sandbox — time series lab</h2>
        <p class="goal">load → inspect → split time forward → fit → forecast → score</p>
        <p>Play freely. The stage always shows the series, the train/horizon boundary, and any forecast.
        Commands print the Python sketch you will meet in production code.</p>
        <div class="meta-row">
          <span class="chip">decompose</span>
          <span class="chip">ACF / PACF</span>
          <span class="chip">baselines</span>
          <span class="chip">MASE</span>
          <span class="chip">TimesFM zero-shot</span>
          <span class="chip">quantile fan</span>
        </div>
      `;
      return;
    }
    const c = this.level.concept;
    const snap = this.session.snapshot();
    const steps = this.level.steps
      .map((st) => {
        const done = st.check(snap);
        return `<span class="chip${done ? " ok" : ""}">${done ? "✓" : "○"} ${escapeHtml(st.label)}</span>`;
      })
      .join("");
    this.briefEl.innerHTML = `
      <h2>${escapeHtml(this.level.title)}</h2>
      <p class="goal">${escapeHtml(this.level.goal)}</p>
      <p><strong>${escapeHtml(c.title)}</strong></p>
      <p>${escapeHtml(c.body)}</p>
      ${c.formula ? `<div class="formula">${escapeHtml(c.formula)}</div>` : ""}
      ${c.callout ? `<div class="callout">${escapeHtml(c.callout)}</div>` : ""}
      <div class="meta-row">${steps}</div>
    `;
  }

  private renderPipeline(): void {
    const steps = this.session.steps.slice(-8);
    if (steps.length === 0) {
      this.pipelineEl.innerHTML = `<div class="pipe-node"><span class="kind">idle</span> waiting for commands</div>`;
      return;
    }
    this.pipelineEl.innerHTML = steps
      .map(
        (st, i) => `
        ${i > 0 ? '<span class="pipe-arrow">→</span>' : ""}
        <div class="pipe-node ${st.status}">
          <span class="kind">${escapeHtml(st.kind)}</span>
          <span>${escapeHtml(st.label)}</span>
        </div>`,
      )
      .join("");
  }

  private renderStatus(): void {
    const s = this.session;
    const snap = s.snapshot();
    const model = s.model ? MODEL_LABELS[s.model] : "—";
    const split = s.split ? `h=${s.split.horizon} / train=${s.split.trainEnd}` : "—";
    const metric = s.metrics ? `MAE ${s.metrics.mae.toFixed(2)} · MASE ${s.metrics.mase == null ? "n/a" : s.metrics.mase.toFixed(2)}` : "—";
    this.statusEl.innerHTML = `
      <span>series <b>${escapeHtml(s.series?.label ?? "none")}</b></span>
      <span>split <b>${escapeHtml(split)}</b></span>
      <span>model <b>${escapeHtml(model)}</b></span>
      <span>score <b>${escapeHtml(metric)}</b></span>
      <span>cmds <b>${s.commandCount}</b></span>
    `;
    void snap;
  }

  private drawStage(): void {
    const s = this.session;
    let kind: ChartKind = this.chartKind;
    if (s.decomposition) kind = "decomp";
    if (s.acf && !s.forecast && !s.decomposition) kind = "acf";
    if (s.forecast) kind = "forecast";
    const state: DrawState = {
      series: s.series,
      split: s.split,
      forecast: s.forecast,
      decomposition: s.decomposition,
      acf: s.acf,
      kind,
      fitProgress: this.fitProgress,
    };
    drawChart(this.chartEl, state);
    if (s.forecast && this.fitProgress < 1) {
      this.fitProgress = Math.min(1, this.fitProgress + 0.08);
      requestAnimationFrame(() => this.drawStage());
    }
  }
}

const appRoot = document.getElementById("app");
if (appRoot) {
  new App(appRoot);
}
