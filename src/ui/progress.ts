/** localStorage progress: solved levels + best command counts. */

export interface LevelProgress {
  solved: Record<string, number>;
  bestCommands: Record<string, number>;
}

const KEY = "learnts-progress-v1";

export function loadProgress(): LevelProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { solved: {}, bestCommands: {} };
    const parsed = JSON.parse(raw) as LevelProgress;
    return {
      solved: parsed.solved ?? {},
      bestCommands: parsed.bestCommands ?? {},
    };
  } catch {
    return { solved: {}, bestCommands: {} };
  }
}

export function saveProgress(p: LevelProgress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // ignore quota errors
  }
}

export function markSolved(p: LevelProgress, id: string, commands: number): LevelProgress {
  const next: LevelProgress = {
    solved: { ...p.solved, [id]: Date.now() },
    bestCommands: {
      ...p.bestCommands,
      [id]: Math.min(p.bestCommands[id] ?? Infinity, commands),
    },
  };
  saveProgress(next);
  return next;
}

export function summarizeCurriculum(p: LevelProgress): {
  solvedCount: number;
  solvedIds: string[];
} {
  const solvedIds = Object.keys(p.solved);
  return { solvedCount: solvedIds.length, solvedIds };
}
