import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

type SessionStorageStateOptions<T> = {
  serialize?: (value: T) => string;
  deserialize?: (rawValue: string) => T;
};

function resolveSessionStorage(): Storage | null {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return null;
  }

  return window.sessionStorage;
}

export function readSessionStorageValue<T>(
  key: string,
  fallbackValue: T,
  options: SessionStorageStateOptions<T> = {},
): T {
  const storage = resolveSessionStorage();

  if (!storage) {
    return fallbackValue;
  }

  const rawValue = storage.getItem(key);
  if (rawValue === null) {
    return fallbackValue;
  }

  try {
    return options.deserialize ? options.deserialize(rawValue) : (JSON.parse(rawValue) as T);
  } catch {
    return fallbackValue;
  }
}

export function writeSessionStorageValue<T>(
  key: string,
  value: T,
  options: SessionStorageStateOptions<T> = {},
): void {
  const storage = resolveSessionStorage();
  if (!storage) {
    return;
  }

  try {
    const rawValue = options.serialize ? options.serialize(value) : JSON.stringify(value);
    storage.setItem(key, rawValue);
  } catch {
    // Ignore session storage failures to keep filters non-blocking.
  }
}

export function useSessionStorageState<T>(
  key: string,
  initialValue: T,
  options: SessionStorageStateOptions<T> = {},
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() =>
    readSessionStorageValue(key, initialValue, options),
  );
  const { serialize, deserialize } = options;

  useEffect(() => {
    writeSessionStorageValue(key, value, { serialize, deserialize });
  }, [deserialize, key, serialize, value]);

  return [value, setValue];
}
