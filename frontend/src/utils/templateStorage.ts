import type { LabelLayout } from "@/types/labelLayout";

export interface SavedTemplate {
  id: string;
  name: string;
  layout: LabelLayout;
  createdAt: number;
}

const STORAGE_KEY = "labelprint-templates";
const CURRENT_KEY = "labelprint-current-layout";

export function getSavedTemplates(): SavedTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTemplate(name: string, layout: LabelLayout): SavedTemplate {
  const templates = getSavedTemplates();
  const template: SavedTemplate = {
    id: `tpl-${Date.now()}`,
    name,
    layout: JSON.parse(JSON.stringify(layout)),
    createdAt: Date.now(),
  };
  templates.push(template);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  return template;
}

export function deleteTemplate(id: string): void {
  const templates = getSavedTemplates().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function saveCurrentLayout(layout: LabelLayout): void {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(layout));
}

export function loadCurrentLayout(): LabelLayout | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function exportTemplateToJson(template: SavedTemplate): void {
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${template.name.replace(/\s+/g, "_")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportLayoutToJson(name: string, layout: LabelLayout): void {
  const template: SavedTemplate = {
    id: `tpl-${Date.now()}`,
    name,
    layout,
    createdAt: Date.now(),
  };
  exportTemplateToJson(template);
}

export function importTemplateFromFile(file: File): Promise<SavedTemplate> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data.layout?.elements) {
          reject(new Error("Неверный формат файла шаблона"));
          return;
        }
        const template: SavedTemplate = {
          id: `tpl-${Date.now()}`,
          name: data.name || "Импортированный",
          layout: data.layout,
          createdAt: Date.now(),
        };
        // Also save to localStorage
        const templates = getSavedTemplates();
        templates.push(template);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
        resolve(template);
      } catch {
        reject(new Error("Не удалось прочитать файл"));
      }
    };
    reader.onerror = () => reject(new Error("Ошибка чтения файла"));
    reader.readAsText(file);
  });
}
