
import { KeyType } from './types';

export const TARGET_SEQUENCE: KeyType[] = ['D', 'B', 'A', 'C'];

export const KEY_COLORS: Record<KeyType, string> = {
  D: 'bg-blue-500 hover:bg-blue-400',
  B: 'bg-yellow-500 hover:bg-yellow-400',
  A: 'bg-green-500 hover:bg-green-400',
  C: 'bg-red-500 hover:bg-red-400',
};

export const KEY_SHADOWS: Record<KeyType, string> = {
  D: 'shadow-[0_5px_0px_0px_#1d4ed8]',
  B: 'shadow-[0_5px_0px_0px_#a16207]',
  A: 'shadow-[0_5px_0px_0px_#15803d]',
  C: 'shadow-[0_5px_0px_0px_#b91c1c]',
};

export const KEY_MAP: { [key: string]: KeyType } = {
  D: 'D',
  B: 'B',
  A: 'A',
  C: 'C',
};
