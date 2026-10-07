"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";

type Copied = "code" | "link" | null;

const noopSubscribe = () => () => {};

function useCanShare() {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
}

function useCopied() {
  const [copied, setCopied] = useState<Copied>(null);
  const flash = (what: Exclude<Copied, null>) => {
    setCopied(what);
    setTimeout(() => setCopied((current) => (current === what ? null : current)), 2000);
  };
  return [copied, flash] as const;
}

/** A room code with buttons to copy it, copy an invite link, or share it. */
export function RoomCode({ code, invitePath }: { code: string; invitePath: string }) {
  const [copied, flash] = useCopied();
  const canShare = useCanShare();
  const inviteUrl = () => new URL(invitePath, window.location.origin).toString();

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="sr-only">Room code {code.split("").join(" ")}</p>
      <div aria-hidden className="flex gap-1.5 sm:gap-2" data-testid="room-code">
        {code.split("").map((char, i) => (
          <span
            key={i}
            className="grid h-14 w-11 place-items-center rounded-xl border border-white/15 bg-white/[0.06] font-mono text-3xl font-bold text-white sm:h-16 sm:w-13 sm:text-4xl"
          >
            {char}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          onClick={async () => {
            if (await copyText(code)) flash("code");
          }}
        >
          {copied === "code" ? "✓ Copied!" : "Copy code"}
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            if (await copyText(inviteUrl())) flash("link");
          }}
        >
          {copied === "link" ? "✓ Link copied!" : "Copy invite link"}
        </Button>
        {canShare && (
          <Button
            variant="secondary"
            onClick={() =>
              navigator.share({ title: "Join my game", text: `Join my game with code ${code}`, url: inviteUrl() }).catch(() => {})
            }
          >
            Share…
          </Button>
        )}
      </div>
      <p aria-live="polite" className="sr-only">
        {copied === "code" ? "Room code copied" : copied === "link" ? "Invite link copied" : ""}
      </p>
    </div>
  );
}

/** Compact room code chip; click to copy. */
export function RoomCodeChip({ code }: { code: string }) {
  const [copied, flash] = useCopied();
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(code)) flash("code");
      }}
      className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-sm ring-1 ring-white/10 transition ring-inset hover:bg-white/10"
      aria-label={`Room code ${code}. Copy to clipboard`}
    >
      <span className="text-zinc-400">Room</span>
      <span className="font-mono font-bold tracking-wider">{code}</span>
      <span aria-hidden className="text-zinc-400">
        {copied ? "✓" : "⧉"}
      </span>
    </button>
  );
}
