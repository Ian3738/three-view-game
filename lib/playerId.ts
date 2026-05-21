"use client";

const KEY = "tvg.playerId";

export function getOrCreatePlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id =
      "p_" +
      Math.random().toString(36).slice(2, 10) +
      Date.now().toString(36).slice(-4);
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
