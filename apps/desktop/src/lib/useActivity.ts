import { useEffect, useState } from "react";
import { api } from "./api";
import type { Activity } from "./types";

/** Latest throttled input sample, or null before any arrives. Only flows while the live monitor is on. */
export function useActivity(): Activity | null {
  const [a, setA] = useState<Activity | null>(null);
  useEffect(() => {
    let off: (() => void) | undefined;
    let dead = false;
    void api.onActivity(setA).then((u) => (dead ? u() : (off = u)));
    return () => {
      dead = true;
      off?.();
    };
  }, []);
  return a;
}
