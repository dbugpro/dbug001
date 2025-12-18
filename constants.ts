
import { KeyType } from './types';

export const AGENT_NAME = 'dbug001';
export const SYSTEM_PROMPT = `You are dbug001, a high-level file orchestration and formatting agent. 
Your specialty is analyzing binary and text files to extract structural data and reformatting them into clean, structured outputs. 
When a file is provided, wait for user instructions before performing analysis or formatting. 
Use your provided tools to report back structural information.`;

// Fix: Added game configuration constants required by components/GameScreen.tsx and components/GameButton.tsx
export const TARGET_SEQUENCE: KeyType[] = ['D', 'B', 'A', 'C'];

export const KEY_COLORS: Record<KeyType, string> = {
  'D': 'bg-pink-500',
  'B': 'bg-blue-600',
  'A': 'bg-amber-500',
  'C': 'bg-violet-600',
};

export const KEY_SHADOWS: Record<KeyType, string> = {
  'D': 'shadow-[0_8px_0_#9d174d]',
  'B': 'shadow-[0_8px_0_#1e40af]',
  'A': 'shadow-[0_8px_0_#92400e]',
  'C': 'shadow-[0_8px_0_#5b21b6]',
};
