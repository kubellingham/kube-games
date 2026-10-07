"use client";

import { useEffect, useState } from "react";

/** True only once `flag` has stayed true for `delayMs`; avoids flashing UI for brief blips. */
export function useDelayedFlag(flag: boolean, delayMs: number): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!flag) return;
    const timer = setTimeout(() => setElapsed(true), delayMs);
    return () => {
      clearTimeout(timer);
      setElapsed(false);
    };
  }, [flag, delayMs]);
  return flag && elapsed;
}
