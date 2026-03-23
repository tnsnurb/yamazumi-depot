import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatWO(id: number | string, prefix?: string | number | null): string {
  if (!id) return '';
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
  if (isNaN(numericId)) return `WO-${id}`;

  const val = prefix || new Date().getFullYear();
  return `WO-${val}-${String(numericId).padStart(4, '0')}`;
}
