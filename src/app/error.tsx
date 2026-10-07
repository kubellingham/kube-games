"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { gameRoutes } from "@/games/routes";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center py-16">
      <StatePanel
        tone="danger"
        icon="💥"
        title="Something went wrong"
        actions={
          <>
            <Button onClick={retry}>Try again</Button>
            <ButtonLink href={gameRoutes.library} variant="secondary">
              Back to library
            </ButtonLink>
          </>
        }
      >
        An unexpected error interrupted the game. Your progress on the server is safe.
      </StatePanel>
    </div>
  );
}
