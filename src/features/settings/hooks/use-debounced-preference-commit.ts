import { useCallback, useEffect, useRef } from "react";

import { setPreference, type Preferences } from "@/lib/storage/preferences";

const COMMIT_DELAY_MS = 180;

export function useDebouncedPreferenceCommit<K extends keyof Preferences>(key: K) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Preferences[K] | undefined>(undefined);

  const commit = useCallback(
    (value: Preferences[K]) => {
      latest.current = value;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void setPreference(key, value);
      }, COMMIT_DELAY_MS);
    },
    [key]
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (latest.current !== undefined) void setPreference(key, latest.current);
    },
    [key]
  );

  return commit;
}
