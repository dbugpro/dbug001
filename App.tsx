import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Message, FileData, AnalysisResult, FormattingResult } from './types';
import { AGENT_NAME, SYSTEM_PROMPT } from './constants';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [file, setFile] = useState<FileData | null>(null);
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

  const generateHexDump = (base64: string) => {
    const binary = atob(base64);
    let hex = '';
    for (let i = 0; i < Math.min(binary.length, 512); i += 16) {
      const chunk = binary.slice(i, i + 16);
      const hexLine = chunk.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
      const asciiLine = chunk.split('').map(c => {
        const code = c.charCodeAt(0);
        return (code >= 32 && code <= 126) ? c : '.';
      }).join('');
      hex += `${i.toString(16).padStart(8, '0')}  ${hexLine.padEnd(48, ' ')}  |${asciiLine}|\n`;
    }
    return hex;
  };

  /**
   * Implements the logic of DDBC_ConvertHelper.py
   * - Bit expansion: 0 -> 01, 1 -> 10
   * - Padded to full bytes with '0'
   */
  const runDDBCConversion = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    // Convert bytes to bit string
    let bitString = '';
    for (const byte of bytes) {
      bitString += byte.toString(2).padStart(8, '0');
    }

    // Apply DDBC conversion logic
    let convertedBits = '';
    for (const bit of bitString) {
      convertedBits += bit === '0' ? '01' : '10';
    }

    // Pad to full bytes with '0'
    const paddingCount = (8 - (convertedBits.length % 8)) % 8;
    convertedBits += '0'.repeat(paddingCount);

    // Convert bit string back to bytes
    const resultBytes = new Uint8Array(convertedBits.length / 8);
    for (let i = 0; i < convertedBits.length; i += 8) {
      resultBytes[i / 8] = parseInt(convertedBits.slice(i, i + 8), 2);
    }

    // Convert result back to base64
    let binaryStr = '';
    for (let i = 0; i < resultBytes.length; i++) {
      binaryStr += String.fromCharCode(resultBytes[i]);
    }
    return btoa(binaryStr);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setFile({
        name: uploadedFile.name,
        size: uploadedFile.size,
        type: uploadedFile.type || 'application/octet-stream',
        base64,
        lastModified: uploadedFile.lastModified,
      });
      setAnalysis(null);
      setFormatResult(null);
      setHexDump(null);
      
      addMessage('SYSTEM', `File mounted: ${uploadedFile.name} (${(uploadedFile.size / 1024).toFixed(2)} KB)`);
      addMessage('AGENT', `Data stream stabilized. I have initialized the **DBUG Tool Set**. \n\nI recommend starting with the **Hex Editor** sub-routine to verify raw byte offsets. Alternatively, if this is for DDB transmission, you should run the **DDBC Convert** tool (DDBC_ConvertHelper.py). How shall we proceed?`);
      
      if (window.innerWidth < 768) {
        setActiveTab('workbench');
      }
    };
    reader.readAsDataURL(uploadedFile);
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
      name: 'open_hex_editor',
      description: 'Generate a hex dump of the first 512 bytes of the file for manual inspection.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          confirm: { type: Type.BOOLEAN, description: 'Confirm hex generation.' }
        }
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

    try {
      const parts: any[] = [{ text: prompt }];
      if (file) {
        parts.push({
          inlineData: {
            mimeType: file.type,
            data: file.base64
          }
        });
      }

      const response = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: { parts },
          config: {
            systemInstruction: SYSTEM_PROMPT,
            tools: [{ functionDeclarations: [analyzeTool, formatTool, hexTool, ddbcTool] }]
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
              metadata: { "Size": `${(file?.size || 0)} bytes`, "Type": file?.type || 'unknown' }
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
          } else if (call.name === 'open_hex_editor') {
            if (file) {
              const dump = generateHexDump(file.base64);
              setHexDump(dump);
              addMessage('AGENT', `Hex Editor sub-routine executed. Raw offset view is now active in the Workbench.`);
            }
          } else if (call.name === 'run_ddbc_convert') {
            if (file) {
              const convertedBase64 = runDDBCConversion(file.base64);
              setFormatResult({
                content: `DDBC_ConvertHelper.py: Bitwise expansion complete.\n- Bit transformation (0->01, 1->10) applied.\n- Stream padded to full bytes.\n- Source: ${file.name}\n- Resulting size: ~${Math.ceil((file.size * 2))} bytes (plus padding).`,
                format: 'BIN',
                fileName: 'DDBC_ConvertedFile.bin',
                binaryData: convertedBase64
              });
              addMessage('AGENT', `DDBC Conversion successful. The bit-expanded binary stream is ready. You can download **DDBC_ConvertedFile.bin** from the Workbench.`);
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
    if (!file) {
      addMessage('SYSTEM', 'ERROR: No file mounted. Please mount a data stream first.');
      return;
    }
    executeDbug(promptOverride || `Run tool: ${toolName}`);
  };

  const handleDownload = () => {
    if (!formatResult) return;
    
    let blob: Blob;
    if (formatResult.format === 'BIN' && formatResult.binaryData) {
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
                  {file.type} // {(file.size / 1024).toFixed(2)} KB
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
              <span className="text-[9px] md:text-[10px] font-bold text-slate-400">HEX EDITOR // OFFSET_VIEW</span>
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
              <span className="text-[9px] md:text-[10px] font-bold text-cyan-400">OUTPUT // {formatResult.format === 'BIN' ? 'BINARY_STREAM (DDBC)' : `FORMATted_${formatResult.format}`}</span>
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
              
              {/* Tool: Hex Editor */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                    <h3 className="text-white font-bold text-xs uppercase tracking-wider">PRTCL_HEX_EDITOR</h3>
                  </div>
                  <button 
                    onClick={() => runTool('open_hex_editor', 'Open the Hex Editor to inspect raw offsets')}
                    className="text-[9px] bg-cyan-900/30 text-cyan-400 border border-cyan-800 px-3 py-1 rounded hover:bg-cyan-600 hover:text-black transition-all font-bold uppercase"
                  >
                    Run Sub-routine
                  </button>
                </div>
                <div className="bg-black/40 border border-slate-800 p-4 rounded text-xs text-slate-400 leading-relaxed space-y-2">
                  <p><span className="text-cyan-600 font-bold">DESC:</span> Provides a side-by-side hexadecimal and ASCII projection of the input buffer. Recommended for manual signature validation.</p>
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
                    onClick={() => runTool('run_ddbc_convert', 'Execute DDBC_ConvertHelper.py script on the file')}
                    className="text-[9px] bg-cyan-900/30 text-cyan-400 border border-cyan-800 px-3 py-1 rounded hover:bg-cyan-600 hover:text-black transition-all font-bold uppercase"
                  >
                    Run Script
                  </button>
                </div>
                <div className="bg-black/40 border border-slate-800 p-4 rounded text-xs text-slate-400 leading-relaxed space-y-2">
                  <p><span className="text-cyan-600 font-bold">DESC:</span> DDBC_ConvertHelper.py logic. Bit-expansion utility for DDB transmission. Transforms bits (0->01, 1->10) and pads to full bytes.</p>
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
