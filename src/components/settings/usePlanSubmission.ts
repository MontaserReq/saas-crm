'use client';

import { useRef, useState } from 'react';

/** Keep controls disabled throughout the network call on React 18. */
export function usePlanSubmission(onFailure: () => void) {
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  const submit = (action: () => Promise<void>) => {
    if (running.current) return;
    running.current = true; setPending(true);
    void action().catch(onFailure).finally(() => { running.current = false; setPending(false); });
  };
  return [pending, submit] as const;
}
