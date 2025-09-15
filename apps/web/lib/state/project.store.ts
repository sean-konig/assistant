'use client';

import { create } from 'zustand';

type ProjectState = {
  code: string | null;
  set: (code: string | null) => void;
  restore: () => void;
};

export const useProjectStore = create<ProjectState>((set) => ({
  code: null,
  set: (code) => {
    set({ code });
    if (code) localStorage.setItem('selected_project_code', code);
    else localStorage.removeItem('selected_project_code');
  },
  restore: () => {
    const code = localStorage.getItem('selected_project_code');
    if (code) set({ code });
  },
}));

