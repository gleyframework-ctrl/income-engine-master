import { useEffect, useRef, useState } from "react";

export function usePolling<T>(
  fetchFn: () => Promise<T>,
  shouldContinue: (d: T) => boolean,
  onComplete: (d: T) => void,
  interval = 2000,
) {
  const [data, setData] = useState<T | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isPolling) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const r = await fetchFn();
        if (!mountedRef.current) return;
        setData(r);
        if (shouldContinue(r)) {
          timeout = setTimeout(poll, interval);
        } else {
          onComplete(r);
          setIsPolling(false);
        }
      } catch {
        setIsPolling(false);
      }
    };
    poll();
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isPolling, fetchFn, shouldContinue, onComplete, interval]);

  return {
    data,
    isPolling,
    start: () => setIsPolling(true),
    stop: () => setIsPolling(false),
  };
}
