import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MappingTemplate {
  id: string;
  name: string;
  organizationId: string;
  mapping: Record<string, string>; // Maps systemField -> csvHeader
  createdAt: string;
}

interface TemplateState {
  templates: MappingTemplate[];
  addTemplate: (template: MappingTemplate) => void;
  removeTemplate: (id: string) => void;
  updateTemplate: (id: string, updates: Partial<MappingTemplate>) => void;
}

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set) => ({
      templates: [],
      addTemplate: (template) => set((state) => ({ templates: [...state.templates, template] })),
      removeTemplate: (id) => set((state) => ({ templates: state.templates.filter(t => t.id !== id) })),
      updateTemplate: (id, updates) => set((state) => ({
        templates: state.templates.map(t => t.id === id ? { ...t, ...updates } : t)
      })),
    }),
    {
      name: 'mapping-templates-storage',
    }
  )
);
