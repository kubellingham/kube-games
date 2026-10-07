import { ButtonLink } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { gameRoutes } from "@/games/routes";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center py-16">
      <StatePanel icon="🧭" title="Page not found" actions={<ButtonLink href={gameRoutes.library}>Browse games</ButtonLink>}>
        That game or page doesn&apos;t exist (yet).
      </StatePanel>
    </div>
  );
}
