import { useCallback, useEffect, useState } from "react";

import { ApiError } from "./api";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

// Loads once on mount and whenever a dependency changes, and ignores a
// response that arrives after the component has moved on, which otherwise
// shows the previous project's data for a moment.
export function useApi<T>(load: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  const reload = useCallback(() => setReloadCount((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    load()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // A 401 is already handled globally by signing the user out; showing
        // "session expired" under it would just be noise.
        if (err instanceof ApiError && err.status === 401) return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // load is rebuilt on every render by design; deps describe what it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadCount]);

  return { data, loading, error, reload };
}
