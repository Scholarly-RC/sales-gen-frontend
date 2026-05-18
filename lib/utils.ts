import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function debounce<T extends (...args: never[]) => void>(
  callback: T,
  delayMs: number,
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      timeoutId = null;
      callback(...args);
    }, delayMs);
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (!timeoutId) {
      return;
    }
    clearTimeout(timeoutId);
    timeoutId = null;
  };

  return debounced;
}
