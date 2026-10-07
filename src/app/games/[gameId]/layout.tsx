import { GAMES } from "@/games/registry";

// Prerender every playable game; unknown ids render on demand and hit notFound().
export function generateStaticParams() {
  return GAMES.filter((game) => game.availability === "available").map((game) => ({ gameId: game.id }));
}

export default function GameLayout({ children }: LayoutProps<"/games/[gameId]">) {
  return children;
}
