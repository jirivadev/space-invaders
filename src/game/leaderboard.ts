import type { LeaderboardEntry } from "./types";
import { LEADERBOARD_KEY, MAX_LEADERBOARD_ENTRIES } from "./config";

// ========== Leaderboard ==========

export function getLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw) as LeaderboardEntry[];
    return entries
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_LEADERBOARD_ENTRIES);
  } catch {
    return [];
  }
}

export function addToLeaderboard(name: string, score: number) {
  const entries = getLeaderboard();
  const trimmed = name.trim();
  const existing = entries.find((e) => e.name === trimmed);
  if (existing) {
    if (score > existing.score) {
      existing.score = score;
      existing.date = Date.now();
    }
  } else {
    entries.push({ name: trimmed, score, date: Date.now() });
  }
  entries.sort((a, b) => b.score - a.score);
  try {
    localStorage.setItem(
      LEADERBOARD_KEY,
      JSON.stringify(entries.slice(0, MAX_LEADERBOARD_ENTRIES))
    );
  } catch {
    // localStorage may be unavailable
  }
}
