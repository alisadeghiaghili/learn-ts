/**
 * Terminal view: log, history, placeholder input.
 */

export type LogKind = "cmd" | "out" | "err" | "meta" | "ok" | "py";

export interface LogLine {
  kind: LogKind;
  text: string;
}

function escapeHtml(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

const BASE_COMMANDS = [
  "load airline",
  "load energy",
  "load retail",
  "load random_walk",
  "load noise",
  "load intermittent",
  "load outlier",
  "load level",
  "load trend",
  "load seasonal",
  "load shift",
  "load short_season",
  "show data",
  "show chart",
  "show acf",
  "show pacf",
  "show decomp",
  "show metrics",
  "show forecast",
  "show split",
  "show quantiles",
  "show code",
  "decompose",
  "diff order=1",
  "split horizon=12",
  "split horizon=12 context=64",
  "fit naive",
  "fit snaive",
  "fit mean",
  "fit drift",
  "fit ses",
  "fit holt",
  "fit hw",
  "fit ar",
  "fit timesfm",
  "fit timesfm patch_length=32 context=96",
  "forecast",
  "forecast horizon=24",
  "score",
  "score train",
  "quantiles",
  "compare",
  "levels",
  "goal",
  "hint",
  "run 1.1",
  "run 6.3",
  "reset",
  "undo",
  "clear",
  "help",
  "sandbox",
];

export class TerminalView {
  private logEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private history: string[] = [];
  private histIdx = -1;

  constructor(
    private root: HTMLElement,
    private onCommand: (cmd: string) => void,
  ) {
    this.root.innerHTML = `
      <div class="term-log" id="term-log" role="log" aria-live="polite"></div>
      <div class="term-input-row">
        <span class="term-prompt" aria-hidden="true">›</span>
        <input class="term-input" id="term-input" type="text" spellcheck="false"
          autocomplete="off" placeholder="type a command — help" aria-label="command input" />
      </div>
    `;
    this.logEl = this.root.querySelector("#term-log")!;
    this.inputEl = this.root.querySelector("#term-input")!;
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const v = this.inputEl.value;
        if (v.trim()) {
          this.history.push(v);
          this.histIdx = this.history.length;
          this.inputEl.value = "";
          this.onCommand(v);
        }
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        if (this.histIdx > 0) {
          this.histIdx--;
          this.inputEl.value = this.history[this.histIdx] ?? "";
        }
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        if (this.histIdx < this.history.length) {
          this.histIdx++;
          this.inputEl.value = this.history[this.histIdx] ?? "";
        }
        e.preventDefault();
      }
    });
  }

  focus(): void {
    this.inputEl.focus();
  }

  setPlaceholder(text: string): void {
    this.inputEl.placeholder = text;
  }

  render(log: LogLine[]): void {
    this.logEl.innerHTML = log
      .map((l) => `<div class="line ${l.kind}">${escapeHtml(l.text)}</div>`)
      .join("");
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  append(line: LogLine): void {
    const div = document.createElement("div");
    div.className = `line ${line.kind}`;
    div.textContent = line.text;
    this.logEl.appendChild(div);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  clearLog(): void {
    this.logEl.innerHTML = "";
  }

  suggestions(prefix: string): string[] {
    const p = prefix.trim().toLowerCase();
    if (!p) return BASE_COMMANDS.slice(0, 8);
    return BASE_COMMANDS.filter((c) => c.toLowerCase().startsWith(p)).slice(0, 8);
  }
}
