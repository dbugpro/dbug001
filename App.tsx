import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Message, FileData, AnalysisResult, FormattingResult } from './types';
import { AGENT_NAME, SYSTEM_PROMPT } from './constants';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [file, setFile] = useState<FileData | null>(null);
  const [workingData, setWorkingData] = useState<Uint8Array | null>(null);
  const [undoStack, setUndoStack] = useState<Uint8Array[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [formatResult, setFormatResult] = useState<FormattingResult | null>(null);
  const [hexDump, setHexDump] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'workbench'>('chat');
  const [showToolSet, setShowToolSet] = useState(false);
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
        if (next.length > 50) next.shift();
        return next;
      });
    }
  };

  const generateHexDump = (data: Uint8Array, start = 0, length = 512) => {
    let hex = '';
    const BYTES_PER_LINE = 16;
    const end = Math.min(data.length, start + length);
    for (let i = start; i < end; i += BYTES_PER_LINE) {
      const chunk = data.slice(i, i + BYTES_PER_LINE);
      const hexLine = Array.from(chunk).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      const asciiLine = Array.from(chunk).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
      hex += `${i.toString(16).padStart(8, '0').toUpperCase()}  ${hexLine.padEnd(48, ' ')}  |${asciiLine}|\n`;
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

  /**
   * Implements the logic of DDBC_ConvertHelper.py
   */
  const runDDBCConversion = (bytes: Uint8Array) => {
    let bitString = '';
    for (const byte of bytes) {
      bitString += byte.toString(2).padStart(8, '0');
    }

    let convertedBits = '';
    for (const bit of bitString) {
      convertedBits += bit === '0' ? '01' : '10';
    }

    const paddingCount = (8 - (convertedBits.length % 8)) % 8;
    convertedBits += '0'.repeat(paddingCount);

    const resultBytes = new Uint8Array(convertedBits.length / 8);
    for (let i = 0; i < convertedBits.length; i += 8) {
      resultBytes[i / 8] = parseInt(convertedBits.slice(i, i + 8), 2);
    }

    return resultBytes;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer);
      const base64 = btoa(String.fromCharCode(...bytes));
      
      setFile({
        name: uploadedFile.name,
        size: uploadedFile.size,
        type: uploadedFile.type || 'application/octet-stream',
        base64,
        lastModified: uploadedFile.lastModified,
      });
      setWorkingData(bytes);
      setUndoStack([]);
      setAnalysis(null);
      setFormatResult(null);
      setHexDump(null);
      
      addMessage('SYSTEM', `File mounted: ${uploadedFile.name} (${(uploadedFile.size / 1024).toFixed(2)} KB)`);
      addMessage('AGENT', `Data stream stabilized. My sub-routines are ready. \n\nI have initialized the **Advanced Hex Editor** (HexEditor_Advanced.py). You can now perform surgical edits directly from this chat. \n\nCommands available:\n- **dump [offset] [length]**: Examine specific blocks.\n- **edit [offset] [value]**: Modify a single byte.\n- **overwrite [offset] [hex]**: Replace a byte range.\n- **insert [offset] [hex]**: Inject new data.\n- **delete [offset] [len]**: Remove segments.\n- **search [hex]**: Locate patterns.\n- **undo**: Revert last change.\n- **save**: Prepare for extraction.\n\nShall we begin by dumping the first 512 bytes?`);
      
      if (window.innerWidth < 768) {
        setActiveTab('workbench');
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    addMessage('SYSTEM', 'ORCHESTRATION TERMINATED: User initiated manual override.');
  };

  const executeDbug = async (prompt: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    addMessage('USER', prompt);
    setInputValue('');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const analyzeTool: FunctionDeclaration = {
      name: 'perform_structural_analysis',
      description: 'Analyze the structure of the provided file data and return metadata and a summary.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          signature: { type: Type.STRING, description: 'The detected file signature or magic numbers.' },
          summary: { type: Type.STRING, description: 'A brief summary of the content.' },
          isBinary: { type: Type.BOOLEAN, description: 'Whether the file appears to be binary.' }
        },
        required: ['signature', 'summary', 'isBinary']
      }
    };

    const formatTool: FunctionDeclaration = {
      name: 'apply_formatting_template',
      description: 'Format the file content into a structured text representation.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING, description: 'The formatted content string.' },
          format: { type: Type.STRING, description: 'The name of the target format (e.g. JSON, CSV, MD).' },
          fileName: { type: Type.STRING, description: 'Suggested filename for export.' }
        },
        required: ['content', 'format', 'fileName']
      }
    };

    const hexTool: FunctionDeclaration = {
      name: 'hex_editor_operation',
      description: 'Perform advanced hex editing operations (dump, edit, overwrite, insert, delete, search, undo, save).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          operation: { 
            type: Type.STRING, 
            description: 'The operation to perform: dump, edit, overwrite, insert, delete, search, undo, save',
            enum: ['dump', 'edit', 'overwrite', 'insert', 'delete', 'search', 'undo', 'save']
          },
          offset: { type: Type.STRING, description: 'The hex offset (e.g., 0x10) for the operation.' },
          value: { type: Type.STRING, description: 'Hex value (e.g. 0xFF) for edit.' },
          values: { type: Type.STRING, description: 'Space-separated hex string for overwrite/insert.' },
          length: { type: Type.STRING, description: 'Hex length for dump or delete.' },
          pattern: { type: Type.STRING, description: 'Hex pattern to search for.' }
        },
        required: ['operation']
      }
    };

    const ddbcTool: FunctionDeclaration = {
      name: 'run_ddbc_convert',
      description: 'Executes the DDBC_ConvertHelper.py logic: transforms binary streams by expanding bits (0->01, 1->10).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          confirm: { type: Type.BOOLEAN, description: 'Confirm script execution.' }
        }
      }
    };

    const exportRawTool: FunctionDeclaration = {
      name: 'export_raw_binary',
      description: 'Exports the original raw binary data of the uploaded file.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          confirm: { type: Type.BOOLEAN, description: 'Confirm raw export.' }
        }
      }
    };

    const glossaryTool: FunctionDeclaration = {
      name: 'view_glossary',
      description: 'Displays the BUG BASE CODE BOOK GLOSSARY (bbc_book_glossary_version_0.0.1.json).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          confirm: { type: Type.BOOLEAN, description: 'Confirm glossary view.' }
        }
      }
    };

    try {
      const parts: any[] = [{ text: prompt }];
      if (workingData) {
        const base64 = btoa(String.fromCharCode(...workingData));
        parts.push({
          inlineData: {
            mimeType: file?.type || 'application/octet-stream',
            data: base64
          }
        });
      }

      const response = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: { parts },
          config: {
            systemInstruction: SYSTEM_PROMPT,
            tools: [{ functionDeclarations: [analyzeTool, formatTool, hexTool, ddbcTool, exportRawTool, glossaryTool] }]
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
          if (call.name === 'perform_structural_analysis') {
            const result = call.args as any;
            setAnalysis({
              signature: result.signature,
              summary: result.summary,
              isBinary: result.isBinary,
              metadata: { "Size": `${(workingData?.length || 0)} bytes`, "Type": file?.type || 'unknown' }
            });
            addMessage('AGENT', `Analysis complete. Structural integrity verified. I've populated the Workbench with the data matrix.`);
          } else if (call.name === 'apply_formatting_template') {
            const result = call.args as any;
            setFormatResult({
              content: result.content,
              format: result.format,
              fileName: result.fileName
            });
            addMessage('AGENT', `Formatting applied: [${result.format}]. The export stream is ready for download in the Workbench.`);
          } else if (call.name === 'hex_editor_operation') {
            const args = call.args as any;
            if (!workingData) {
              addMessage('SYSTEM', "ERROR: No data stream to edit.");
              continue;
            }

            let logMsg = "";
            switch (args.operation) {
              case 'dump': {
                const start = parseInt(args.offset || '0x0', 16);
                const len = parseInt(args.length || '0x200', 16);
                setHexDump(generateHexDump(workingData, start, len));
                logMsg = `Dumping ${len} bytes from offset 0x${start.toString(16).toUpperCase()}.`;
                break;
              }
              case 'edit': {
                snapshot();
                const off = parseInt(args.offset, 16);
                const val = parseInt(args.value, 16);
                workingData[off] = val;
                setHexDump(generateHexDump(workingData, Math.max(0, off - 32), 128));
                logMsg = `Byte at 0x${off.toString(16).toUpperCase()} changed to 0x${val.toString(16).toUpperCase()}.`;
                break;
              }
              case 'overwrite': {
                snapshot();
                const off = parseInt(args.offset, 16);
                const bytes = parseHexBytes(args.values);
                workingData.set(bytes, off);
                setHexDump(generateHexDump(workingData, Math.max(0, off - 16), bytes.length + 32));
                logMsg = `Overwrote ${bytes.length} bytes at offset 0x${off.toString(16).toUpperCase()}.`;
                break;
              }
              case 'insert': {
                snapshot();
                const off = parseInt(args.offset, 16);
                const bytes = parseHexBytes(args.values);
                const newData = new Uint8Array(workingData.length + bytes.length);
                newData.set(workingData.slice(0, off), 0);
                newData.set(bytes, off);
                newData.set(workingData.slice(off), off + bytes.length);
                setWorkingData(newData);
                setHexDump(generateHexDump(newData, Math.max(0, off - 16), bytes.length + 32));
                logMsg = `Inserted ${bytes.length} bytes at offset 0x${off.toString(16).toUpperCase()}. Buffer expanded to ${newData.length} bytes.`;
                break;
              }
              case 'delete': {
                snapshot();
                const off = parseInt(args.offset, 16);
                const len = parseInt(args.length, 16);
                const newData = new Uint8Array(workingData.length - len);
                newData.set(workingData.slice(0, off), 0);
                newData.set(workingData.slice(off + len), off);
                setWorkingData(newData);
                setHexDump(generateHexDump(newData, Math.max(0, off - 32), 128));
                logMsg = `Deleted ${len} bytes from offset 0x${off.toString(16).toUpperCase()}. Buffer reduced to ${newData.length} bytes.`;
                break;
              }
              case 'search': {
                const pattern = parseHexBytes(args.pattern);
                const matches: number[] = [];
                for (let i = 0; i < workingData.length - pattern.length + 1; i++) {
                  let match = true;
                  for (let j = 0; j < pattern.length; j++) {
                    if (workingData[i + j] !== pattern[j]) {
                      match = false;
                      break;
                    }
                  }
                  if (match) matches.push(i);
                }
                logMsg = matches.length > 0 
                  ? `Found ${matches.length} matches for pattern [${args.pattern}]: ${matches.slice(0, 5).map(m => '0x' + m.toString(16).toUpperCase()).join(', ')}${matches.length > 5 ? '...' : ''}`
                  : `No matches found for pattern [${args.pattern}].`;
                break;
              }
              case 'undo': {
                if (undoStack.length > 0) {
                  const last = undoStack[undoStack.length - 1];
                  setWorkingData(last);
                  setUndoStack(prev => prev.slice(0, -1));
                  setHexDump(generateHexDump(last, 0, 512));
                  logMsg = "Undo successful. Buffer state restored.";
                } else {
                  logMsg = "Nothing to undo.";
                }
                break;
              }
              case 'save': {
                const base64 = btoa(String.fromCharCode(...workingData));
                setFormatResult({
                  content: `HEX_EDITOR: Manual modifications finalized.\n- File: ${file?.name}\n- Final Size: ${workingData.length} bytes`,
                  format: 'BIN',
                  fileName: `edited_${file?.name || 'file.bin'}`,
                  binaryData: base64
                });
                logMsg = "State finalized. Modified binary stream is now ready for extraction in the Workbench.";
                break;
              }
            }
            addMessage('AGENT', `Hex Editor sub-routine: ${logMsg}`);
          } else if (call.name === 'run_ddbc_convert') {
            if (workingData) {
              const convertedBytes = runDDBCConversion(workingData);
              const convertedBase64 = btoa(String.fromCharCode(...convertedBytes));
              setFormatResult({
                content: `DDBC_ConvertHelper.py: Bitwise expansion complete.\n- Bit transformation (0->01, 1->10) applied.\n- Stream padded to full bytes.\n- Source: ${file?.name}\n- Resulting size: ${convertedBytes.length} bytes.`,
                format: 'BIN',
                fileName: 'DDBC_ConvertedFile.bin',
                binaryData: convertedBase64
              });
              addMessage('AGENT', `DDBC Conversion successful. The bit-expanded binary stream has been generated according to the DDBC_ConvertHelper.py specification. You can download the output file from the Workbench.`);
            }
          } else if (call.name === 'export_raw_binary') {
            if (workingData) {
              const base64 = btoa(String.fromCharCode(...workingData));
              setFormatResult({
                content: `RAW_EXPORT: Extraction of current buffer.\n- Name: ${file?.name}\n- Size: ${workingData.length} bytes`,
                format: 'RAW',
                fileName: `raw_${file?.name || 'data.bin'}`,
                binaryData: base64
              });
              addMessage('AGENT', `Raw export sub-routine complete. The current unmodified data stream is now available for download in the Workbench.`);
            }
          } else if (call.name === 'view_glossary') {
            try {
              const glossaryResp = await fetch('./bbc_book_glossary_version_0.0.1.json');
              const glossaryData = await glossaryResp.json();
              setFormatResult({
                content: JSON.stringify(glossaryData, null, 2),
                format: 'JSON',
                fileName: 'bbc_book_glossary_version_0.0.1.json'
              });
              addMessage('AGENT', `Glossary sub-routine loaded. The 'BUG BASE CODE BOOK GLOSSARY' (v0.0.1) is now visible in the Workbench.`);
            } catch (e) {
              addMessage('SYSTEM', `ERROR: Failed to fetch glossary data stream.`);
            }
          }
        }
      } else {
        addMessage('AGENT', response.text || "Command processed with no structural changes.");
      }
    } catch (error: any) {
      if (error.message === 'AbortError') return;
      console.error(error);
      addMessage('SYSTEM', 'ERROR: Orchestration layer failed to respond. Check console.');
    } finally {
      if (!controller.signal.aborted) {
        setIsProcessing(false);
        abortControllerRef.current = null;
      }
    }
  };

  const runTool = (toolName: string, promptOverride?: string) => {
    setShowToolSet(false);
    if (!workingData && toolName !== 'view_glossary') {
      addMessage('SYSTEM', 'ERROR: No file mounted. Please mount a data stream first.');
      return;
    }
    executeDbug(promptOverride || `Run tool: ${toolName}`);
  };

  const handleDownload = () => {
    if (!formatResult) return;
    
    let blob: Blob;
    if ((formatResult.format === 'BIN' || formatResult.format === 'RAW') && formatResult.binaryData) {
      const binaryString = atob(formatResult.binaryData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: 'application/octet-stream' });
    } else {
      blob = new Blob([formatResult.content], { type: 'text/plain' });
    }
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = formatResult.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-[#0a0a0c] text-slate-300 font-mono overflow-hidden relative">
      {/* Sidebar / Chat Pane */}
      <div className={`w-full md:w-1/2 flex flex-col border-r border-slate-800 bg-[#0d0d11] ${activeTab === 'chat' ? 'flex h-full' : 'hidden md:flex'}`}>
        <div className="p-4 border-b border-slate-800 flex justify-between items-start shrink-0">
          <div className="flex flex-col">
            <h1 className="text-cyan-400 font-bold tracking-widest text-lg">DBUG 001</h1>
            <button 
              onClick={() => setShowToolSet(true)}
              className="text-[10px] text-slate-500 hover:text-cyan-400 flex items-center mt-1 transition-colors group uppercase tracking-tight text-left"
            >
              <span className="mr-1.5 opacity-50 font-bold">◈</span> 
              DBUG TOOL SET 
              <span className="ml-1 opacity-50 group-hover:opacity-100 transition-opacity">+</span>
            </button>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
            <span className="text-[10px] text-slate-500 uppercase">{isProcessing ? 'Processing' : 'Standby'}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
          {messages.length === 0 && (
            <div className="text-slate-600 text-xs italic opacity-50">
              [SYSTEM] INITIALIZING AGENT INTERFACE...<br/>
              [SYSTEM] WAITING FOR INPUT STREAM...
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'USER' ? 'items-end' : 'items-start'}`}>
              <div className="flex items-baseline space-x-2 mb-1">
                <span className={`text-[10px] font-bold ${msg.role === 'USER' ? 'text-cyan-400' : msg.role === 'SYSTEM' ? 'text-yellow-600' : 'text-green-500'}`}>
                  {msg.role}
                </span>
                <span className="text-[9px] text-slate-700">{msg.timestamp}</span>
              </div>
              <div className={`p-3 text-sm max-w-[90%] rounded border ${
                msg.role === 'USER' 
                ? 'bg-cyan-950/20 border-cyan-800/50 text-cyan-50' 
                : msg.role === 'SYSTEM' 
                  ? 'bg-slate-900 border-slate-800 text-slate-400 font-bold italic text-xs' 
                  : 'bg-green-950/10 border-green-900/30 text-green-50'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <form 
          onSubmit={(e) => { e.preventDefault(); executeDbug(inputValue); }}
          className="p-4 border-t border-slate-800 flex bg-black/20 shrink-0"
        >
          <input 
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isProcessing}
            placeholder="Command dbug001..."
            className="flex-1 bg-transparent border-none outline-none text-cyan-100 placeholder-slate-700 text-sm py-2"
          />
          {isProcessing ? (
            <button 
              type="button"
              onClick={handleStop}
              className="ml-2 px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded transition-all active:scale-95 flex items-center space-x-2"
            >
              <span className="w-2 h-2 bg-white rounded-sm animate-pulse"></span>
              <span>STOP</span>
            </button>
          ) : (
            <button 
              type="submit"
              disabled={isProcessing || !inputValue.trim()}
              className="ml-2 px-6 py-2 bg-cyan-600 text-black font-bold text-xs rounded hover:bg-cyan-500 disabled:opacity-30 transition-all active:scale-95"
            >
              EXEC
            </button>
          )}
        </form>
      </div>

      {/* Main Workbench Pane */}
      <div className={`flex-1 flex flex-col p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto bg-[#0a0a0c] ${activeTab === 'workbench' ? 'flex h-full' : 'hidden md:flex'}`}>
        <div className="flex justify-between items-center shrink-0">
          <h2 className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-widest">Workbench // Data Matrix</h2>
          <label className="cursor-pointer group flex items-center space-x-2 text-[10px] border border-slate-800 px-3 py-2 rounded bg-slate-900/50 hover:bg-slate-800 transition-colors active:scale-95">
            <span className="text-slate-400 uppercase font-bold">Mount New File</span>
            <input type="file" className="hidden" onChange={handleFileUpload} />
            <span className="text-cyan-500 group-hover:translate-y-[-1px] transition-transform">↑</span>
          </label>
        </div>

        {file ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded flex items-center space-x-4">
              <div className="text-3xl md:text-4xl">📄</div>
              <div className="min-w-0">
                <div className="text-cyan-400 font-bold text-sm truncate">{file.name}</div>
                <div className="text-[9px] md:text-[10px] text-slate-500 uppercase tracking-tighter">
                  {file.type} // {(workingData?.length || 0) / 1024 > 0 ? ((workingData?.length || 0) / 1024).toFixed(2) : 0} KB
                </div>
              </div>
            </div>
            {analysis && (
              <div className="bg-green-950/10 border border-green-900/30 p-4 rounded flex flex-col justify-center">
                <div className="text-[9px] md:text-[10px] text-green-500 font-bold uppercase mb-1">Structural Signature</div>
                <div className="text-sm text-green-100 font-bold truncate">{analysis.signature}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-600 space-y-4 min-h-[200px] md:min-h-[300px]">
            <div className="text-5xl md:text-6xl opacity-20">📁</div>
            <div className="text-[10px] md:text-xs uppercase tracking-widest font-bold text-center px-4">Drop or Select binary files to analyze</div>
          </div>
        )}

        {/* Hex Editor View */}
        {hexDump && (
          <div className="bg-black border border-slate-800 rounded-lg flex flex-col animate-fade-in shrink-0">
            <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
              <span className="text-[9px] md:text-[10px] font-bold text-slate-400">HEX EDITOR // INTERACTIVE_VIEW</span>
              <button 
                onClick={() => setHexDump(null)}
                className="text-[9px] text-slate-500 hover:text-white"
              >
                Close View
              </button>
            </div>
            <div className="p-4 overflow-x-auto whitespace-pre font-mono text-[9px] md:text-[11px] text-green-400/80 leading-relaxed bg-[#050507]">
              {hexDump}
            </div>
          </div>
        )}

        {analysis && (
          <div className="bg-[#0d0d11] border border-slate-800 p-4 md:p-5 rounded-lg space-y-3 animate-fade-in shrink-0">
             <div className="flex items-center justify-between">
               <h3 className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">Analysis Report</h3>
               <span className="text-[9px] bg-slate-800 px-2 py-0.5 rounded text-slate-500">RAW_MD_v1.0</span>
             </div>
             <p className="text-xs md:text-sm text-slate-300 leading-relaxed border-l-2 border-cyan-800 pl-4 py-1 italic">
               "{analysis.summary}"
             </p>
          </div>
        )}

        {formatResult && (
          <div className="flex-1 bg-black border border-cyan-900/30 rounded-lg flex flex-col animate-slide-up min-h-[300px]">
            <div className="p-3 border-b border-cyan-900/30 flex justify-between items-center bg-cyan-950/10 shrink-0">
              <span className="text-[9px] md:text-[10px] font-bold text-cyan-400">OUTPUT // {formatResult.format === 'BIN' ? 'BINARY_STREAM' : formatResult.format === 'RAW' ? 'RAW_EXPORT' : `FORMATted_${formatResult.format}`}</span>
              <button 
                onClick={handleDownload}
                className="text-[9px] md:text-[10px] bg-cyan-600 hover:bg-cyan-500 text-black px-3 py-1.5 rounded font-bold uppercase transition-colors active:scale-95"
              >
                Download Stream
              </button>
            </div>
            <div className="flex-1 p-4 overflow-auto scrollbar-thin scrollbar-thumb-cyan-900">
              <pre className="text-[10px] md:text-xs text-cyan-100/80 leading-5 whitespace-pre-wrap">
                {formatResult.content}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Tool Set Modal Overlay */}
      {showToolSet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-[#0d0d11] border border-cyan-900/50 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-cyan-900/30 flex justify-between items-center bg-cyan-950/10">
              <h2 className="text-cyan-400 font-bold text-sm tracking-widest uppercase">DBUG Sub-routine Library</h2>
              <button 
                onClick={() => setShowToolSet(false)}
                className="text-slate-500 hover:text-white transition-colors p-1"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-cyan-900">
              
              {/* Tool: View Glossary */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full shadow-[0_0_5px_rgba(234,179,8,0.5)]"></div>
                    <h3 className="text-white font-bold text-xs uppercase tracking-wider">PRTCL_VIEW_GLOSSARY</h3>
                  </div>
                  <button 
                    onClick={() => runTool('view_glossary', 'Display the BUG BASE CODE BOOK glossary')}
                    className="text-[9px] bg-yellow-900/30 text-yellow-400 border border-yellow-800 px-3 py-1 rounded hover:bg-yellow-600 hover:text-black transition-all font-bold uppercase"
                  >
                    View Glossary
                  </button>
                </div>
                <div className="bg-black/40 border border-slate-800 p-4 rounded text-xs text-slate-400 leading-relaxed space-y-2">
                  <p><span className="text-yellow-600 font-bold">DESC:</span> Displays the official BUG BASE CODE BOOK glossary (bbc_book_glossary_version_0.0.1.json). Contains acronyms and logic definitions.</p>
                </div>
              </div>

              {/* Tool: Hex Editor */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                    <h3 className="text-white font-bold text-xs uppercase tracking-wider">PRTCL_HEX_EDITOR</h3>
                  </div>
                  <button 
                    onClick={() => runTool('hex_editor_operation', 'Launch the Advanced Hex Editor interface')}
                    className="text-[9px] bg-cyan-900/30 text-cyan-400 border border-cyan-800 px-3 py-1 rounded hover:bg-cyan-600 hover:text-black transition-all font-bold uppercase"
                  >
                    Launch Editor
                  </button>
                </div>
                <div className="bg-black/40 border border-slate-800 p-4 rounded text-xs text-slate-400 leading-relaxed space-y-2">
                  <p><span className="text-cyan-600 font-bold">DESC:</span> Interactive surgical editor (HexEditor_Advanced.py). Supports dump, edit, overwrite, insert, delete, search, and undo operations directly from chat.</p>
                </div>
              </div>

              {/* Tool: RAW Export */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                    <h3 className="text-white font-bold text-xs uppercase tracking-wider">PRTCL_RAW_EXPORT</h3>
                  </div>
                  <button 
                    onClick={() => runTool('export_raw_binary', 'Export the current raw binary buffer')}
                    className="text-[9px] bg-cyan-900/30 text-cyan-400 border border-cyan-800 px-3 py-1 rounded hover:bg-cyan-600 hover:text-black transition-all font-bold uppercase"
                  >
                    Run Sub-routine
                  </button>
                </div>
                <div className="bg-black/40 border border-slate-800 p-4 rounded text-xs text-slate-400 leading-relaxed space-y-2">
                  <p><span className="text-cyan-600 font-bold">DESC:</span> Extracts and serves the current input buffer without any high-level transformations. Reflects all hex edits.</p>
                </div>
              </div>

              {/* Tool: DDBC Convert */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                    <h3 className="text-white font-bold text-xs uppercase tracking-wider">PRTCL_DDBC_CONVERT</h3>
                  </div>
                  <button 
                    onClick={() => runTool('run_ddbc_convert', 'Execute DDBC_ConvertHelper.py script on the current buffer')}
                    className="text-[9px] bg-cyan-900/30 text-cyan-400 border border-cyan-800 px-3 py-1 rounded hover:bg-cyan-600 hover:text-black transition-all font-bold uppercase"
                  >
                    Run Script
                  </button>
                </div>
                <div className="bg-black/40 border border-slate-800 p-4 rounded text-xs text-slate-400 leading-relaxed space-y-2">
                  <p><span className="text-cyan-600 font-bold">DESC:</span> DDBC_ConvertHelper.py script. Bit-expansion utility for DDB transmission. Transforms bits (0->01, 1->10) and pads to full bytes.</p>
                </div>
              </div>

              {/* Tool: Analysis */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                    <h3 className="text-white font-bold text-xs uppercase tracking-wider">PRTCL_STRUCT_ANALYSIS</h3>
                  </div>
                  <button 
                    onClick={() => runTool('perform_structural_analysis', 'Perform deep structural analysis on the file')}
                    className="text-[9px] bg-cyan-900/30 text-cyan-400 border border-cyan-800 px-3 py-1 rounded hover:bg-cyan-600 hover:text-black transition-all font-bold uppercase"
                  >
                    Run Sub-routine
                  </button>
                </div>
                <div className="bg-black/40 border border-slate-800 p-4 rounded text-xs text-slate-400 leading-relaxed space-y-2">
                  <p><span className="text-cyan-600 font-bold">DESC:</span> Performs non-destructive deep inspection of binary headers, entropy levels, and segment structures.</p>
                </div>
              </div>

              {/* Tool: Reformat */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                    <h3 className="text-white font-bold text-xs uppercase tracking-wider">PRTCL_DATA_REFORMAT</h3>
                  </div>
                  <button 
                    onClick={() => runTool('apply_formatting_template', 'Reformat this data into a structured output')}
                    className="text-[9px] bg-cyan-900/30 text-cyan-400 border border-cyan-800 px-3 py-1 rounded hover:bg-cyan-600 hover:text-black transition-all font-bold uppercase"
                  >
                    Run Sub-routine
                  </button>
                </div>
                <div className="bg-black/40 border border-slate-800 p-4 rounded text-xs text-slate-400 leading-relaxed space-y-2">
                  <p><span className="text-cyan-600 font-bold">DESC:</span> State-aware reformatting engine capable of projecting unstructured memory dumps into standardized object notation (JSON, CSV, MD).</p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-black/40 border-t border-cyan-900/20 flex justify-end">
              <button 
                onClick={() => setShowToolSet(false)}
                className="px-6 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-[10px] rounded uppercase transition-colors"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Navigation Tab Bar */}
      <div className="md:hidden flex border-t border-slate-800 bg-[#0d0d11] shrink-0">
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-4 flex flex-col items-center justify-center space-y-1 transition-colors ${activeTab === 'chat' ? 'bg-cyan-950/20 text-cyan-400' : 'text-slate-500'}`}
        >
          <span className="text-xl">💬</span>
          <span className="text-[9px] font-bold uppercase tracking-widest">Agent Chat</span>
          {activeTab === 'chat' && <div className="w-8 h-0.5 bg-cyan-400 mt-1 rounded-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('workbench')}
          className={`flex-1 py-4 flex flex-col items-center justify-center space-y-1 transition-colors ${activeTab === 'workbench' ? 'bg-cyan-950/20 text-cyan-400' : 'text-slate-500'}`}
        >
          <span className="text-xl">🛠️</span>
          <span className="text-[9px] font-bold uppercase tracking-widest">Workbench</span>
          {activeTab === 'workbench' && <div className="w-8 h-0.5 bg-cyan-400 mt-1 rounded-full"></div>}
        </button>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-up { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .animate-slide-up { animation: slide-up 0.4s ease-out forwards; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #334155; }
        @media screen and (max-width: 768px) {
          input { font-size: 16px !important; }
        }
      `}</style>
    </div>
  );
};

export default App;
