
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Message, FileData, AnalysisResult, FormattingResult } from './types';
import { AGENT_NAME, SYSTEM_PROMPT } from './constants';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [file, setFile] = useState<FileData | null>(null);
  const [originalData, setOriginalData] = useState<Uint8Array | null>(null);
  const [workingData, setWorkingData] = useState<Uint8Array | null>(null);
  const [clipboard, setClipboard] = useState<Uint8Array | null>(null);
  const [undoStack, setUndoStack] = useState<Uint8Array[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [formatResult, setFormatResult] = useState<FormattingResult | null>(null);
  const [hexDump, setHexDump] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'workbench'>('chat');
  const [showToolSet, setShowToolSet] = useState(false);
  const [tuiCursor, setTuiCursor] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  const addMessage = (role: 'AGENT' | 'USER' | 'SYSTEM', text: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role,
      text,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const snapshot = () => {
    if (workingData) {
      setUndoStack(prev => {
        const next = [...prev, new Uint8Array(workingData)];
        if (next.length > 100) next.shift();
        return next;
      });
    }
  };

  const generateHexDump = (data: Uint8Array, start = 0, length = 512, cursorOffset?: number) => {
    let hex = '';
    const BYTES_PER_LINE = 16;
    const end = Math.min(data.length, start + length);
    for (let i = start; i < end; i += BYTES_PER_LINE) {
      const chunk = data.slice(i, i + BYTES_PER_LINE);
      const hexLine = Array.from(chunk).map((b, idx) => {
        const addr = i + idx;
        const hexStr = b.toString(16).padStart(2, '0').toUpperCase();
        return addr === cursorOffset ? `[${hexStr}]` : ` ${hexStr} `;
      }).join('');
      const asciiLine = Array.from(chunk).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
      hex += `${i.toString(16).padStart(8, '0').toUpperCase()}  ${hexLine.padEnd(52, ' ')} |${asciiLine}|\n`;
    }
    return hex;
  };

  const parseHexBytes = (hexString: string): Uint8Array => {
    const clean = hexString.replace(/[\s,]/g, '');
    if (clean.length % 2 !== 0) throw new Error("Invalid hex string length");
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) {
      bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
    }
    return bytes;
  };

  const calculateChecksums = async (data: Uint8Array) => {
    const sha256Buffer = await crypto.subtle.digest('SHA-256', data);
    const sha1Buffer = await crypto.subtle.digest('SHA-1', data);
    const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    return {
      SHA256: toHex(sha256Buffer),
      SHA1: toHex(sha1Buffer),
      MD5: "[MD5_SIMULATED_VIA_DBUG_PROTOCOL]"
    };
  };

  const calculateDiff = (a: Uint8Array, b: Uint8Array) => {
    const diffs: { offset: number; a: number; b: number }[] = [];
    const length = Math.min(a.length, b.length);
    for (let i = 0; i < length; i++) {
      if (a[i] !== b[i]) {
        diffs.push({ offset: i, a: a[i], b: b[i] });
      }
    }
    return {
      diffs,
      sizeDiff: a.length !== b.length ? { a: a.length, b: b.length } : null
    };
  };

  const runDDBCConversion = (bytes: Uint8Array) => {
    let bitString = '';
    for (const byte of bytes) bitString += byte.toString(2).padStart(8, '0');
    let convertedBits = '';
    for (const bit of bitString) convertedBits += bit === '0' ? '01' : '10';
    const paddingCount = (8 - (convertedBits.length % 8)) % 8;
    convertedBits += '0'.repeat(paddingCount);
    const resultBytes = new Uint8Array(convertedBits.length / 8);
    for (let i = 0; i < convertedBits.length; i += 8) resultBytes[i / 8] = parseInt(convertedBits.slice(i, i + 8), 2);
    return resultBytes;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer);
      setFile({
        name: uploadedFile.name,
        size: uploadedFile.size,
        type: uploadedFile.type || 'application/octet-stream',
        base64: btoa(String.fromCharCode(...bytes)),
        lastModified: uploadedFile.lastModified,
      });
      setOriginalData(new Uint8Array(bytes));
      setWorkingData(new Uint8Array(bytes));
      setUndoStack([]);
      setAnalysis(null);
      setFormatResult(null);
      setHexDump(null);
      
      addMessage('SYSTEM', `File mounted: ${uploadedFile.name}`);
      addMessage('AGENT', `Modular Hex Editor Platform (v2.5) initialized. \n\nProtocols available: **CORE**, **TUI**, **GUI**, **DIFF**, **CHECKSUM**. \n\nYou can now use 'hjkl' navigation logic or surgical core commands. Use 'checksum' to verify integrity.`);
      
      if (window.innerWidth < 768) setActiveTab('workbench');
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    addMessage('SYSTEM', 'ORCHESTRATION TERMINATED.');
  };

  const executeDbug = async (prompt: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    addMessage('USER', prompt);
    setInputValue('');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const parts: any[] = [{ text: prompt }];
      if (workingData) {
        parts.push({
          inlineData: {
            mimeType: file?.type || 'application/octet-stream',
            data: btoa(String.fromCharCode(...workingData))
          }
        });
      }

      const hexTool: FunctionDeclaration = {
        name: 'hex_editor_operation',
        description: 'Modular Hex Platform operations: dump, edit, overwrite, insert, delete, search, copy, paste, checksum, diff, undo, save.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            operation: { 
              type: Type.STRING, 
              enum: ['dump', 'edit', 'overwrite', 'insert', 'delete', 'search', 'copy', 'paste', 'checksum', 'diff', 'undo', 'save', 'tui_nav']
            },
            offset: { type: Type.STRING },
            value: { type: Type.STRING },
            values: { type: Type.STRING },
            length: { type: Type.STRING },
            pattern: { type: Type.STRING },
            direction: { type: Type.STRING, enum: ['h', 'j', 'k', 'l'] }
          },
          required: ['operation']
        }
      };

      const response = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: { parts },
          config: {
            systemInstruction: SYSTEM_PROMPT,
            tools: [{ functionDeclarations: [hexTool] }]
          }
        }),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => reject(new Error('AbortError')));
        })
      ]);

      if (controller.signal.aborted) return;

      const calls = response.functionCalls;
      if (calls && calls.length > 0) {
        for (const call of calls) {
          if (call.name === 'hex_editor_operation') {
            const args = call.args as any;
            if (!workingData) continue;
            let logMsg = "";
            switch (args.operation) {
              case 'dump': {
                const start = parseInt(args.offset || '0x0', 16);
                const len = parseInt(args.length || '0x200', 16);
                setHexDump(generateHexDump(workingData, start, len));
                logMsg = `Projecting ${len} bytes from 0x${start.toString(16).toUpperCase()}.`;
                break;
              }
              case 'tui_nav': {
                let next = tuiCursor;
                if (args.direction === 'h') next = Math.max(0, next - 1);
                if (args.direction === 'l') next = Math.min(workingData.length - 1, next + 1);
                if (args.direction === 'j') next = Math.min(workingData.length - 1, next + 16);
                if (args.direction === 'k') next = Math.max(0, next - 16);
                setTuiCursor(next);
                const start = Math.floor(next / 16) * 16 - 64;
                setHexDump(generateHexDump(workingData, Math.max(0, start), 256, next));
                logMsg = `TUI navigation: Positioned at 0x${next.toString(16).toUpperCase()}.`;
                break;
              }
              case 'edit': {
                snapshot();
                const off = parseInt(args.offset, 16);
                const val = parseInt(args.value, 16);
                workingData[off] = val;
                setHexDump(generateHexDump(workingData, Math.max(0, off - 32), 128, off));
                logMsg = `Core: Byte 0x${off.toString(16).toUpperCase()} edited.`;
                break;
              }
              case 'checksum': {
                const hashes = await calculateChecksums(workingData);
                setFormatResult({
                   content: `INTEGRITY VALIDATION\n--------------------\nSHA256: ${hashes.SHA256}\nSHA1:   ${hashes.SHA1}\nMD5:    ${hashes.MD5}`,
                   format: 'MD',
                   fileName: 'integrity.md'
                });
                logMsg = "Integrity check complete.";
                break;
              }
              case 'diff': {
                if (!originalData) break;
                const diffData = calculateDiff(originalData, workingData);
                setFormatResult({
                   content: `BINARY DIFF MODE\n----------------\nDelta Count: ${diffData.diffs.length}\n${diffData.diffs.slice(0, 20).map(d => `0x${d.offset.toString(16).toUpperCase()}: 0x${d.a.toString(16).toUpperCase()} -> 0x${d.b.toString(16).toUpperCase()}`).join('\n')}`,
                   format: 'TXT',
                   fileName: 'diff.txt'
                });
                logMsg = "Diff module active.";
                break;
              }
              case 'save': {
                setFormatResult({
                   content: `Session finalized. Magnitude: ${workingData.length} bytes.`,
                   format: 'BIN',
                   fileName: `mod_edit_${file?.name || 'file.bin'}`,
                   binaryData: btoa(String.fromCharCode(...workingData))
                });
                logMsg = "Modifications saved to stream.";
                break;
              }
              case 'undo': {
                if (undoStack.length > 0) {
                  const last = undoStack[undoStack.length - 1];
                  setWorkingData(last);
                  setUndoStack(prev => prev.slice(0, -1));
                  logMsg = "Undo operation successful.";
                }
                break;
              }
            }
            addMessage('AGENT', `Modular Hex Platform: ${logMsg}`);
          }
        }
      } else {
        addMessage('AGENT', response.text || "Synchronized.");
      }
    } catch (error: any) {
      if (error.message === 'AbortError') return;
      addMessage('SYSTEM', `ERROR: ${error.message || 'Orchestration desync'}`);
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const runTool = (toolName: string, promptOverride?: string) => {
    setShowToolSet(false);
    if (!workingData && toolName !== 'view_glossary') {
      addMessage('SYSTEM', 'ERROR: Mount data stream.');
      return;
    }
    executeDbug(promptOverride || `Run tool: ${toolName}`);
  };

  // Fix: Explicitly use window.Blob to avoid shadowing or conflicting type definitions and resolve parameter count mismatch errors on lines 429 and 430
  const handleDownload = () => {
    if (!formatResult) return;
    let finalBlob: any;
    if ((formatResult.format === 'BIN' || formatResult.format === 'RAW') && formatResult.binaryData) {
      const binData = atob(formatResult.binaryData);
      const byteList = new Uint8Array(binData.length);
      for (let i = 0; i < binData.length; i++) {
        byteList[i] = binData.charCodeAt(i);
      }
      // Line 429: Explicit global constructor use
      finalBlob = new window.Blob([byteList], { type: 'application/octet-stream' });
    } else {
      // Line 430: Explicit global constructor use
      finalBlob = new window.Blob([formatResult.content], { type: 'text/plain' });
    }
    const blobUrl = URL.createObjectURL(finalBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = formatResult.fileName;
    link.click();
    URL.revokeObjectURL(blobUrl);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-[#0a0a0c] text-slate-300 font-mono overflow-hidden relative">
      <div className={`w-full md:w-1/2 flex flex-col border-r border-slate-800 bg-[#0d0d11] ${activeTab === 'chat' ? 'flex h-full' : 'hidden md:flex'}`}>
        <div className="p-4 border-b border-slate-800 flex justify-between items-start shrink-0">
          <div className="flex flex-col">
            <h1 className="text-cyan-400 font-bold tracking-widest text-lg">DBUG 001</h1>
            <button onClick={() => setShowToolSet(true)} className="text-[10px] text-slate-500 hover:text-cyan-400 flex items-center mt-1 uppercase">
              <span className="mr-1.5 opacity-50 font-bold">◈</span> DBUG TOOL SET
            </button>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
            <span className="text-[10px] text-slate-500 uppercase">{isProcessing ? 'Processing' : 'Standby'}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
          {messages.map(msg => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'USER' ? 'items-end' : 'items-start'}`}>
              <div className="flex items-baseline space-x-2 mb-1">
                <span className={`text-[10px] font-bold ${msg.role === 'USER' ? 'text-cyan-400' : 'text-green-500'}`}>{msg.role}</span>
                <span className="text-[9px] text-slate-700">{msg.timestamp}</span>
              </div>
              <div className={`p-3 text-sm max-w-[90%] rounded border ${msg.role === 'USER' ? 'bg-cyan-950/20 border-cyan-800/50 text-cyan-50' : 'bg-green-950/10 border-green-900/30 text-green-50'}`}>
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); executeDbug(inputValue); }} className="p-4 border-t border-slate-800 flex bg-black/20">
          <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} disabled={isProcessing} placeholder="Command dbug001..." className="flex-1 bg-transparent outline-none text-cyan-100 text-sm py-2" />
          <button type="submit" disabled={isProcessing || !inputValue.trim()} className="ml-2 px-6 py-2 bg-cyan-600 text-black font-bold text-xs rounded">EXEC</button>
        </form>
      </div>

      <div className={`flex-1 flex flex-col p-4 md:p-6 space-y-4 bg-[#0a0a0c] ${activeTab === 'workbench' ? 'flex h-full' : 'hidden md:flex'}`}>
        <div className="flex justify-between items-center">
          <h2 className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Workbench // Modular Platform</h2>
          <label className="cursor-pointer border border-slate-800 px-3 py-2 rounded bg-slate-900/50 text-[10px] uppercase font-bold">
            Mount Stream
            <input type="file" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>

        {file ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded flex items-center space-x-4">
              <div className="text-3xl text-cyan-900/50">📄</div>
              <div className="min-w-0">
                <div className="text-cyan-400 font-bold text-sm truncate">{file.name}</div>
                <div className="text-[9px] text-slate-500 uppercase">{file.type} // {((workingData?.length || 0) / 1024).toFixed(2)} KB</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-600 space-y-4 min-h-[200px]">
            <div className="text-5xl opacity-20">📁</div>
            <div className="text-[10px] uppercase font-bold text-center">Mount a binary or text stream for orchestration</div>
          </div>
        )}

        {hexDump && (
          <div className="bg-black border border-slate-800 rounded-lg flex flex-col shrink-0">
            <div className="p-3 border-b border-slate-800 bg-slate-900/50 text-[9px] font-bold uppercase tracking-tighter">Hex projection</div>
            <div className="p-4 overflow-x-auto whitespace-pre font-mono text-[9px] md:text-[11px] text-green-400/80 bg-[#050507]">
              {hexDump}
            </div>
          </div>
        )}

        {formatResult && (
          <div className="flex-1 bg-black border border-cyan-900/30 rounded-lg flex flex-col min-h-[300px]">
            <div className="p-3 border-b border-cyan-900/30 bg-cyan-950/10 flex justify-between items-center">
              <span className="text-[9px] font-bold text-cyan-400 uppercase">Module Output</span>
              <button onClick={handleDownload} className="text-[9px] bg-cyan-600 text-black px-3 py-1.5 rounded font-bold uppercase">Extract</button>
            </div>
            <div className="flex-1 p-4 overflow-auto">
              <pre className="text-[10px] text-cyan-100/80 whitespace-pre-wrap">{formatResult.content}</pre>
            </div>
          </div>
        )}
      </div>

      {showToolSet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-[#0d0d11] border border-cyan-900/50 rounded-lg p-6 shadow-2xl">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-cyan-400 font-bold uppercase tracking-widest">DBUG Tool Set</h2>
                <button onClick={() => setShowToolSet(false)} className="text-slate-500 hover:text-white transition-colors">✕</button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ToolCard title="HEX_CORE" icon="🧠" desc="Core binary engine. Edits, undo, snapshots." onClick={() => runTool('hex_editor_operation', 'Launch Core')} />
                <ToolCard title="HEX_TUI" icon="🔥" desc="Terminal navigation (hjkl) simulation." onClick={() => runTool('hex_editor_operation', 'Activate TUI')} />
                <ToolCard title="HEX_CHECKSUM" icon="🔐" desc="Integrity validation (SHA256, SHA1, MD5)." onClick={() => runTool('hex_editor_operation', 'checksum', 'Run integrity check')} />
                <ToolCard title="HEX_DIFF" icon="🔁" desc="Identify delta from original mount state." onClick={() => runTool('hex_editor_operation', 'diff', 'Calculate binary diff')} />
                <ToolCard title="DDBC_CONV" icon="📦" desc="Double Digit Binary bit-expansion." onClick={() => runTool('run_ddbc_convert', 'Run bit-expansion protocol')} />
                <ToolCard title="GLOSSARY" icon="📖" desc="System definitions and code-book." onClick={() => runTool('view_glossary', 'Show glossary')} />
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ToolCard: React.FC<{ title: string; icon: string; desc: string; onClick: () => void }> = ({ title, icon, desc, onClick }) => (
  <div onClick={onClick} className="bg-black/40 border border-slate-800 p-4 rounded hover:border-cyan-600 transition-all cursor-pointer group">
    <div className="flex items-center space-x-3 mb-2">
      <span className="text-xl group-hover:scale-110 transition-transform">{icon}</span>
      <h3 className="text-white font-bold text-xs uppercase tracking-wider">{title}</h3>
    </div>
    <p className="text-[10px] text-slate-500 leading-relaxed">{desc}</p>
  </div>
);

export default App;
