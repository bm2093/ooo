// src/lib/local-storage.ts

export function getFromLocalStorage<T = any>(key: string, defaultValue: T | null = null): T | null {
  if (typeof window === "undefined") return defaultValue;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function saveToLocalStorage<T = any>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // silently fail if storage is unavailable
  }
}

export function removeFromLocalStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore errors
  }
}

export function clearLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.clear();
  } catch {
    // ignore errors
  }
}
