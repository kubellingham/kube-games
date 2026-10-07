import type { GameTheme } from "../types";

interface ThemeStyles {
  /** Gradient stops for `bg-linear-*`. */
  gradient: string;
  glow: string;
  text: string;
}

// Full class names (not built from strings) so Tailwind can find them.
export const THEME_STYLES: Record<GameTheme, ThemeStyles> = {
  violet: { gradient: "from-violet-500 via-fuchsia-500 to-pink-500", glow: "shadow-fuchsia-500/30", text: "text-fuchsia-300" },
  sky: { gradient: "from-sky-500 via-cyan-500 to-teal-400", glow: "shadow-cyan-500/30", text: "text-cyan-300" },
  amber: { gradient: "from-amber-400 via-orange-500 to-rose-500", glow: "shadow-orange-500/30", text: "text-amber-300" },
  emerald: { gradient: "from-emerald-400 via-teal-500 to-cyan-500", glow: "shadow-emerald-500/30", text: "text-emerald-300" },
  rose: { gradient: "from-rose-500 via-pink-500 to-fuchsia-500", glow: "shadow-rose-500/30", text: "text-rose-300" },
};
