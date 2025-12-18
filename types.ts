
export type AccountRole = 'AGENT' | 'USER' | 'SYSTEM';

// Fix: Added KeyType used by GameScreen and GameButton components to resolve import errors
export type KeyType = 'D' | 'B' | 'A' | 'C';

export interface Message {
  id: string;
  role: AccountRole;
  text: string;
  timestamp: string;
}

export interface FileData {
  name: string;
  size: number;
  type: string;
  base64: string;
  lastModified: number;
}

export interface AnalysisResult {
  signature: string;
  summary: string;
  metadata: Record<string, string>;
  isBinary: boolean;
}

export interface FormattingResult {
  content: string;
  format: string;
  fileName: string;
}
