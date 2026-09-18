import { storageKeys } from '@/src/lib/storageKeys';

export interface LocalMemoryItem {
  id: string;
  category: 'preference' | 'goal' | 'profile' | 'habit';
  key: string;
  value: string;
  updatedAt: string;
}

const DEFAULT_MEMORIES: Omit<LocalMemoryItem, 'id' | 'updatedAt'>[] = [
  {
    category: 'preference',
    key: 'Preferred Currency',
    value: 'INR (₹)',
  },
  {
    category: 'preference',
    key: 'Response Style',
    value: 'Concise, data-driven, practical, and clear formatting',
  },
  {
    category: 'goal',
    key: 'Primary Focus',
    value: 'Smart budgeting, expense reduction, and disciplined SIP investing',
  },
];

export const getLocalMemories = (): LocalMemoryItem[] => {
  try {
    const raw = localStorage.getItem(storageKeys.aiAdvisorMemories);
    if (!raw) {
      const initial: LocalMemoryItem[] = DEFAULT_MEMORIES.map((m, idx) => ({
        ...m,
        id: `mem-default-${idx + 1}`,
        updatedAt: new Date().toISOString(),
      }));
      localStorage.setItem(storageKeys.aiAdvisorMemories, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveLocalMemory = (
  category: LocalMemoryItem['category'],
  key: string,
  value: string
): LocalMemoryItem => {
  const current = getLocalMemories();
  const trimmedKey = key.trim();
  const trimmedVal = value.trim();

  const existingIdx = current.findIndex(
    (m) => m.key.toLowerCase() === trimmedKey.toLowerCase()
  );

  const item: LocalMemoryItem = {
    id: existingIdx >= 0 ? current[existingIdx].id : `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category,
    key: trimmedKey,
    value: trimmedVal,
    updatedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    current[existingIdx] = item;
  } else {
    current.push(item);
  }

  localStorage.setItem(storageKeys.aiAdvisorMemories, JSON.stringify(current));
  return item;
};

export const deleteLocalMemory = (id: string): void => {
  const current = getLocalMemories();
  const filtered = current.filter((m) => m.id !== id);
  localStorage.setItem(storageKeys.aiAdvisorMemories, JSON.stringify(filtered));
};

export const syncExtractedMemories = (
  newMemories: Array<{ category?: string; key?: string; value?: string }>
): void => {
  if (!Array.isArray(newMemories) || !newMemories.length) return;

  for (const item of newMemories) {
    if (item.key && item.value) {
      const category = (['preference', 'goal', 'profile', 'habit'].includes(item.category || '')
        ? item.category
        : 'preference') as LocalMemoryItem['category'];
      saveLocalMemory(category, item.key, item.value);
    }
  }
};

export const getMemoriesForAdvisor = (): string[] => {
  const memories = getLocalMemories();
  return memories.map((m) => `${m.key}: ${m.value}`);
};
