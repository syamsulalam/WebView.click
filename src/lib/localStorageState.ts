import { useEffect, useState } from "react";

export function useLocalStorageState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;

    try {
      const stored = window.localStorage.getItem(key);
      return stored ? JSON.parse(stored) as T : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage failures so form controls still work in private/restricted contexts.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
