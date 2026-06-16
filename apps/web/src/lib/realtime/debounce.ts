export type TimerApi<TimerId> = {
  setTimeout: (callback: () => void, delayMs: number) => TimerId;
  clearTimeout: (timerId: TimerId) => void;
};

const defaultTimers: TimerApi<ReturnType<typeof setTimeout>> = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (timerId) => clearTimeout(timerId),
};

export function createRefreshDebouncer<TimerId = ReturnType<typeof setTimeout>>(
  callback: () => void,
  delayMs: number,
  timers?: TimerApi<TimerId>,
) {
  let pendingTimer: TimerId | null = null;
  const activeTimers = timers ?? (defaultTimers as unknown as TimerApi<TimerId>);

  return {
    schedule() {
      if (pendingTimer !== null) {
        activeTimers.clearTimeout(pendingTimer);
      }

      pendingTimer = activeTimers.setTimeout(() => {
        pendingTimer = null;
        callback();
      }, delayMs);
    },
    cancel() {
      if (pendingTimer !== null) {
        activeTimers.clearTimeout(pendingTimer);
        pendingTimer = null;
      }
    },
    hasPending() {
      return pendingTimer !== null;
    },
  };
}
