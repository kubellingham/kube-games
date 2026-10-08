import type { ReactNode } from "react";

/** The end-of-game banner, with room for actions such as a rematch. */
export function WinnerPanel({ title, detail, children }: { title: string; detail?: string; children?: ReactNode }) {
  return (
    <section
      role="status"
      className="flex animate-pop-in flex-col items-center gap-4 rounded-3xl border border-amber-300/30 bg-amber-300/10 px-5 py-7 text-center"
    >
      <span aria-hidden className="text-5xl">
        🏆
      </span>
      <div>
        <h2 className="font-display text-2xl font-extrabold">{title}</h2>
        {detail && <p className="mt-1 text-sm text-zinc-300">{detail}</p>}
      </div>
      {children && <div className="flex flex-wrap justify-center gap-3">{children}</div>}
    </section>
  );
}
