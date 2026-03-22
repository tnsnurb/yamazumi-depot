import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatWO(id: number | string, dateStr?: string | null): string {
  if (!id) return '';
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
  if (isNaN(numericId)) return `WO-${id}`;

  let year = new Date().getFullYear();
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      year = d.getFullYear();
    }
  }

  return `WO-${year}-${String(numericId).padStart(4, '0')}`;
}
