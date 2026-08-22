import { useEffect, useState } from 'react';

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function millisecondsUntilNextLocalMidnight(now: Date): number {
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1, nextMidnight.getTime() - now.getTime());
}

export function useLocalToday(): string {
  const [today, setToday] = useState(() => toLocalDateKey(new Date()));

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const scheduleNextDay = () => {
      const now = new Date();
      timeout = setTimeout(() => {
        setToday(toLocalDateKey(new Date()));
        scheduleNextDay();
      }, millisecondsUntilNextLocalMidnight(now));
    };
    scheduleNextDay();
    return () => {
      if (timeout !== undefined) clearTimeout(timeout);
    };
  }, []);

  return today;
}
