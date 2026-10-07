"use client";

import { createLocalStore, useLocalStore } from "@/lib/local-store";
import { sanitizeDisplayName } from "../rules";

export const playerNameStore = createLocalStore<string>("kube-games:player-name", {
  parse: (raw) => sanitizeDisplayName(raw) ?? "",
  serialize: (name) => name,
  serverValue: "",
});

/** The display name this browser last played under, or "" if none yet. */
export function useSavedPlayerName(): string {
  return useLocalStore(playerNameStore);
}

const ADJECTIVES = ["Swift", "Clever", "Lucky", "Bold", "Sneaky", "Cosmic", "Mighty", "Quiet", "Brave", "Zippy"];
const ANIMALS = ["Otter", "Falcon", "Panda", "Fox", "Koala", "Tiger", "Gecko", "Raven", "Lynx", "Narwhal"];

export function randomPlayerName(): string {
  const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
}

/** Cleans the name the player typed (or invents one) and remembers it. */
export function commitPlayerName(input: string): string {
  const name = sanitizeDisplayName(input) ?? randomPlayerName();
  playerNameStore.set(name);
  return name;
}
