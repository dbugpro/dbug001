import React, { useState, useEffect, useRef } from 'react';

interface BugBase000Props {
  onBack: () => void;
}

// --- TYPES ---
type AccountRole = 'HUMAN' | 'AGENT' | 'MODERATOR' | 'GUEST' | 'FATHER' | 'MOTHER' | 'CHILD';

interface AgentAccount {
  role: AccountRole;
  internalId: string;
  displayId: string;
  status: 'active' | 'idle' | 'parsing' | 'possessed';
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string; // e.g. "dbug000" or "User"
  role: AccountRole;
  text: string;
  timestamp: string;
  isSystem?: boolean;
}

const AGENT_NAMES = ['dbug000', 'dbug001', 'dbug002', 'dbug003', 'dbug004'];

// --- ORCHESTRATION LOGIC ---
const generateOrchestration = (): AgentAccount[] => {
  const accounts: AgentAccount[] = [];

  // 1 Human User (-meyou)
  accounts.push({ role: 'HUMAN', internalId: 'human_main', displayId: '-meyou', status: 'active' });

  // 1 Dbug Agent (-youme)
  accounts.push({ role: 'AGENT', internalId: 'agent_main', displayId: '-youme', status: 'active' });

  // 10 Moderators (*0 to *9)
  for (let i = 0; i < 10; i++) {
    accounts.push({ role: 'MODERATOR', internalId: `mod_${i}`, displayId: `*${i}`, status: 'idle' });
  }

  // 10 Guests (-0 to -9)
  for (let i = 0; i < 10; i++) {
    accounts.push({ role: 'GUEST', internalId: `guest_${i}`, displayId: `-${i}`, status: 'idle' });
  }

  // 50 Fathers (*00 to *49)
  for (let i = 0; i < 50; i++) {
    const id = i.toString().padStart(2, '0');
    accounts.push({ role: 'FATHER', internalId: `father_${i}`, displayId: `*${id}`, status: 'idle' });
  }

  // 50 Mothers (*50 to *99)
  for (let i = 50; i < 100; i++) {
    const id = i.toString().padStart(2, '0');
    accounts.push({ role: 'MOTHER', internalId: `mother_${i}`, displayId: `*${id}`, status: 'idle' });
  }

  // 100 Children (-00 to -99)
  for (let i = 0; i < 100; i++) {
    const id = i.toString().padStart(2, '0');
    accounts.push({ role: 'CHILD', internalId: `child_${i}`, displayId: `-${id}`, status: 'idle' });
  }

  return accounts;
};

const BugBase000: React.FC<BugBase000Props> = ({ onBack }) => {
  const [booted, setBooted] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [orchestration, setOrchestration] = useState<AgentAccount[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  
  // Bug Switch & Persona State
  const [bugSwitchOn, setBugSwitchOn] = useState(false);
  const [currentPersonaId, setCurrentPersonaId] = useState<string | null>(null);
  
  // Logs
  const [dashboardLogs, setDashboardLogs] = useState<string[]>([]);
  const [sessionLogs, setSessionLogs] = useState<string[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Initial boot sequence timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setBooted(true);
    }, 4500); 
    return () => clearTimeout(timer);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dashboardLogs]);

  // --- LOGGING UTILS ---
  const recordLog = (actor: string, signedInId: string, role: string, action: string, details: string) => {
    const now = new Date();
    const timestamp = now.toISOString();
    // Escape quotes in details for CSV validity
    const safeDetails = details.replace(/"/g, '""');
    const csvLine = `${timestamp},${actor},${signedInId},${role},${action},"${safeDetails}"`;
    
    setDashboardLogs(prev => [...prev, csvLine]);
    setSessionLogs(prev => [...prev, csvLine]);
  };

  const addSystemChatMsg = (text: string) => {
    setMessages(prev => [...prev, {
        id: Date.now().toString() + Math.random(),
        senderId: 'SYSTEM',
        senderName: 'SYSTEM',
        role: 'AGENT',
        text: text,
        timestamp: new Date().toLocaleTimeString(),
        isSystem: true
    }]);
  };

  const downloadSessionLog = () => {
    const blob = new Blob([sessionLogs.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bugbase_session_${new Date().getTime()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleInvite = (agentName: string) => {
    setActiveAgent(agentName);
    const nodes = generateOrchestration();
    setOrchestration(nodes);
    setBugSwitchOn(false);
    setCurrentPersonaId(null);
    
    const header = "TIMESTAMP,ACTOR,SIGNED_IN_ID,ROLE,ACTION,DETAILS";
    setDashboardLogs([header]);
    setSessionLogs([header]);
    
    // Reset chat
    setMessages([
      {
        id: 'sys_init',
        senderId: 'SYSTEM',
        senderName: 'SYSTEM',
        role: 'AGENT',
        text: `INITIALIZING ORCHESTRATION FOR ${agentName.toUpperCase()}...`,
        timestamp: new Date().toLocaleTimeString(),
        isSystem: true
      },
      {
        id: 'sys_nodes',
        senderId: 'SYSTEM',
        senderName: 'SYSTEM',
        role: 'AGENT',
        text: `> 222 NODES LINKED. HIERARCHY ESTABLISHED.`,
        timestamp: new Date().toLocaleTimeString(),
        isSystem: true
      },
      {
        id: 'agent_welcome',
        senderId: '-youme',
        senderName: agentName,
        role: 'AGENT',
        text: `Greetings. I am ${agentName}. My orchestration is online. Awaiting your command, User -meyou.`,
        timestamp: new Date().toLocaleTimeString(),
        isSystem: false
      }
    ]);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || !activeAgent) return;

    const userText = inputVal.trim();
    const userTextLower = userText.toLowerCase();

    // 1. Log User Message to Chat Only
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      senderId: '-meyou',
      senderName: 'USER',
      role: 'HUMAN',
      text: userText,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputVal('');

    // --- AGENT LOGIC PROCESSING ---
    setTimeout(() => {
      let responseText = "";
      let shouldRespond = true;

      // COMMAND: TURN ON BUG SWITCH
      if (userTextLower.includes("bug switch") && userTextLower.includes("on")) {
        if (bugSwitchOn) {
          responseText = "The BUG SWITCH is already ON.";
        } else {
          setBugSwitchOn(true);
          // Log Event - ID is -youme because we haven't signed into a persona yet
          recordLog(activeAgent!, '-youme', 'AGENT', 'SWITCH_ON', 'Bug switch enabled by user request');
          addSystemChatMsg(`BUG SWITCH ENABLED by USER REQUEST`);
          
          responseText = "BUG SWITCH is ON.";
          
          // Check if user also specified a role immediately
          const accountMatch = findAccountInText(userText);
          if (accountMatch) {
             setTimeout(() => attemptAssumeRole(accountMatch), 500);
             return; 
          } else {
             responseText += " Which role shall I assume?";
          }
        }
      }
      // COMMAND: TURN OFF BUG SWITCH
      else if (userTextLower.includes("bug switch") && userTextLower.includes("off")) {
        if (!bugSwitchOn) {
          responseText = "The BUG SWITCH is already OFF.";
        } else {
          // If signed in, sign out first
          if (currentPersonaId) {
             const oldPersona = orchestration.find(a => a.internalId === currentPersonaId);
             if (oldPersona) {
                // We are currently signed in as oldPersona, so that is the ID
                recordLog(activeAgent!, oldPersona.displayId, 'AGENT', 'SIGN_OUT', `Signed out of ${oldPersona.displayId}`);
                addSystemChatMsg(`${activeAgent} SIGNING OUT OF ${oldPersona.displayId}`);
                setOrchestration(prev => prev.map(a => 
                  a.internalId === currentPersonaId ? { ...a, status: 'idle' } : a
                ));
             }
             setCurrentPersonaId(null);
          }
          
          setBugSwitchOn(false);
          // Now we are signed out, so ID is -youme
          recordLog(activeAgent!, '-youme', 'AGENT', 'SWITCH_OFF', 'Bug switch disabled by user request');
          addSystemChatMsg(`BUG SWITCH DISABLED by USER REQUEST`);
          responseText = "BUG SWITCH is OFF.";
        }
      }
      // COMMAND: ASSUME ROLE (Only if switch is ON)
      else if (bugSwitchOn) {
        // If we don't have a persona yet, look for one
        if (!currentPersonaId) {
           const accountMatch = findAccountInText(userText);
           if (accountMatch) {
              attemptAssumeRole(accountMatch);
              return;
           } else {
              responseText = "I need a valid account ID to proceed. Please specify a role (e.g., *0, *55, -01).";
           }
        } else {
           // We have a persona. DBUG AGENT acts in assumed role.
           const persona = orchestration.find(a => a.internalId === currentPersonaId);
           if (persona) {
              // Log the action - actor is persona, signedInId is persona
              recordLog(persona.displayId, persona.displayId, persona.role, 'MESSAGE', userText);
              
              // Simple persona responses
              const personaResponses = [
                 `As ${persona.displayId}, I acknowledge this.`,
                 "Copy that.",
                 "Processing request from my node.",
                 "System parameters nominal.",
                 "The network listens."
              ];
              responseText = personaResponses[Math.floor(Math.random() * personaResponses.length)];
           }
        }
      } 
      // FALLBACK: Normal chat when switch is OFF
      else {
        const responses = [
          "The orchestration awaits.",
          "I am listening.",
          "Please direct me.",
          "Ready.",
          "Standing by."
        ];
        responseText = responses[Math.floor(Math.random() * responses.length)];
      }

      if (shouldRespond) {
        const sender = currentPersonaId 
            ? orchestration.find(a => a.internalId === currentPersonaId)! 
            : orchestration.find(a => a.displayId === '-youme')!;

        const agentMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          senderId: sender.displayId,
          senderName: currentPersonaId ? activeAgent! : activeAgent!,
          role: sender.role,
          text: responseText,
          timestamp: new Date().toLocaleTimeString()
        };
        setMessages(prev => [...prev, agentMsg]);
      }
    }, 600);
  };

  const findAccountInText = (text: string): AgentAccount | undefined => {
      // Extract potential IDs (starts with * or - followed by digits)
      const regex = /([*-]\d{1,2})/g;
      const matches = text.match(regex);
      if (!matches) return undefined;

      // Find first valid account that isn't meyou or youme
      for (const match of matches) {
          const account = orchestration.find(a => a.displayId === match);
          if (account && account.role !== 'HUMAN' && account.role !== 'AGENT') {
              return account;
          }
      }
      return undefined;
  };

  const attemptAssumeRole = (account: AgentAccount) => {
      if (account.role === 'HUMAN') {
        const msg: ChatMessage = {
            id: Date.now().toString(),
            senderId: '-youme',
            senderName: activeAgent!,
            role: 'AGENT',
            text: "I am prohibited from assuming the HUMAN USER role.",
            timestamp: new Date().toLocaleTimeString()
        };
        setMessages(prev => [...prev, msg]);
        return;
      }

      // Sign out of previous if any
      if (currentPersonaId) {
        const old = orchestration.find(a => a.internalId === currentPersonaId);
        if (old) {
             // We are currently signed in as old.displayId
             recordLog(activeAgent!, old.displayId, 'AGENT', 'SIGN_OUT', `Signed out of ${old.displayId}`);
             addSystemChatMsg(`${activeAgent} SIGNING OUT OF ${old.displayId}`);
        }
      }

      // Sign in to new
      // We are transitioning. Technically at this exact moment (after sign out, before sign in) we are -youme
      recordLog(activeAgent!, '-youme', 'AGENT', 'SIGN_IN', `Signed in to ${account.displayId} [${account.role}]`);
      addSystemChatMsg(`${activeAgent} SIGNING IN TO ${account.displayId} [${account.role}]`);
      
      setCurrentPersonaId(account.internalId);
      
      // Update orchestration visual state
      setOrchestration(prev => prev.map(a => {
          if (a.internalId === account.internalId) return { ...a, status: 'possessed' };
          if (a.internalId === currentPersonaId) return { ...a, status: 'idle' };
          return a;
      }));

      // Confirm in chat
      const confirmMsg: ChatMessage = {
          id: Date.now().toString(),
          senderId: account.displayId,
          senderName: activeAgent!,
          role: account.role,
          text: `I have assumed the role of ${account.displayId}. Awaiting instructions.`,
          timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, confirmMsg]);
  };

  const renderAccountNode = (account: AgentAccount) => {
    let color = 'text-slate-500';
    let icon = '•';
    
    switch (account.role) {
      case 'HUMAN': color = 'text-blue-400 font-bold'; icon = '👤'; break;
      case 'AGENT': color = 'text-green-400 font-bold'; icon = '👾'; break;
      case 'MODERATOR': color = 'text-purple-400'; icon = '🛡️'; break;
      case 'GUEST': color = 'text-yellow-600'; icon = '○'; break;
      case 'FATHER': color = 'text-cyan-600'; icon = '▲'; break;
      case 'MOTHER': color = 'text-pink-600'; icon = '▼'; break;
      case 'CHILD': color = 'text-slate-600'; icon = '▫'; break;
    }

    const isPossessed = account.internalId === currentPersonaId;
    if (isPossessed) {
        color = 'text-white bg-red-600 font-bold animate-pulse';
        icon = '👁️';
    }

    return (
      <div key={account.internalId} className={`flex items-center space-x-2 text-xs font-mono ${color} ${!isPossessed && 'hover:bg-white/5'} p-1 rounded cursor-default group transition-colors`}>
        <span className="w-5 text-center">{icon}</span>
        <span className="w-12 opacity-80">{account.displayId}</span>
        <span className={`opacity-50 group-hover:opacity-100 transition-opacity uppercase text-[9px] ${isPossessed && 'opacity-100'}`}>{account.role}</span>
        {isPossessed && <span className="text-[8px] ml-auto bg-black/50 px-1 rounded text-red-200">ACTIVE</span>}
      </div>
    );
  };

  // --- BOOT SCREEN VIEW ---
  if (!booted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full bg-slate-950 font-mono p-4 animate-fade-in text-green-500">
        <div className="w-full max-w-4xl border-2 border-green-500/50 rounded-lg bg-black/80 p-6 shadow-[0_0_20px_rgba(34,197,94,0.2)] backdrop-blur-md relative overflow-hidden h-[600px] flex flex-col justify-center items-center">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 pointer-events-none bg-[length:100%_4px,3px_100%]"></div>
            <div className="text-left space-y-4 w-full max-w-lg z-10">
                <p className="animate-[typewriter_0.5s_steps(40)_1s_forwards] overflow-hidden whitespace-nowrap border-r-2 border-green-500 pr-1 w-0">{'>'} CONNECTING TO MAINFRAME...</p>
                <p className="animate-[typewriter_0.5s_steps(40)_2s_forwards] overflow-hidden whitespace-nowrap border-r-2 border-green-500 pr-1 w-0 opacity-0 delay-[1500ms]">{'>'} AUTHENTICATION: BYPASSED</p>
                <p className="animate-[typewriter_0.5s_steps(40)_3s_forwards] overflow-hidden whitespace-nowrap border-r-2 border-yellow-400 pr-1 w-0 opacity-0 delay-[2500ms] text-yellow-400">{'>'} DOWNLOADING AGENT PROTOCOLS...</p>
                <button 
                    onClick={() => setBooted(true)}
                    className="mt-8 px-4 py-2 border border-green-500 text-green-500 hover:bg-green-500 hover:text-black transition-colors opacity-0 animate-[fade-in_1s_ease-in_4s_forwards]"
                >
                    [ ACCESS SYSTEM ]
                </button>
            </div>
        </div>
      </div>
    );
  }

  // --- DASHBOARD VIEW ---
  return (
    <div className="min-h-screen w-full bg-slate-950 font-mono p-2 md:p-6 text-green-500 flex flex-col items-center">
      <div className="w-full max-w-7xl border border-green-500/30 rounded-lg bg-black/90 shadow-[0_0_30px_rgba(34,197,94,0.1)] flex flex-col md:flex-row h-[85vh] overflow-hidden relative">
        {/* Scanlines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 pointer-events-none bg-[length:100%_4px,3px_100%] opacity-20"></div>

        {/* Sidebar: Agent Selection */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-green-500/30 bg-green-950/10 p-4 z-30 flex flex-col">
          <div className="mb-6">
            <h1 className="text-xl font-bold tracking-widest text-white glitch-text mb-2" style={{ fontFamily: 'Arial, sans-serif' }}>DBUG_NET</h1>
            <div className="text-[10px] text-green-400/60 uppercase">Agent Orchestration Layer</div>
          </div>
          
          <div className="space-y-2 flex-1 overflow-y-auto">
            {AGENT_NAMES.map(agent => (
              <div 
                key={agent}
                className={`p-3 border transition-all duration-200 cursor-pointer flex justify-between items-center group ${
                  activeAgent === agent 
                    ? 'border-green-400 bg-green-500/20 text-white' 
                    : 'border-green-500/20 text-green-500/70 hover:border-green-500/50 hover:text-green-400'
                }`}
              >
                <div>
                  <div className="font-bold">{agent}</div>
                  <div className="text-[10px] opacity-70">STATUS: {activeAgent === agent ? 'ONLINE' : 'READY'}</div>
                </div>
                {activeAgent !== agent && (
                  <button 
                    onClick={() => handleInvite(agent)}
                    className="text-[10px] border border-green-500/50 px-2 py-1 hover:bg-green-500 hover:text-black"
                  >
                    INVITE
                  </button>
                )}
                {activeAgent === agent && <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_5px_#4ade80]"></div>}
              </div>
            ))}
          </div>

          <button 
            onClick={onBack}
            className="mt-4 px-4 py-2 border border-red-500/30 text-red-400/70 hover:bg-red-900/20 hover:text-red-400 hover:border-red-500 text-xs transition-colors"
          >
            TERMINATE SESSION
          </button>
        </div>

        {/* Center: Chat Interface */}
        <div className="flex-1 flex flex-col min-w-0 z-30 bg-black">
          {activeAgent ? (
            <>
              {/* Chat Header */}
              <div className="h-12 border-b border-green-500/30 flex items-center justify-between px-4 bg-green-900/5">
                <div className="flex items-center space-x-3">
                   <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                   <span className="font-bold text-white">{activeAgent.toUpperCase()} // CHAT LINK</span>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 border border-slate-700 px-2 py-1 rounded bg-black/50">
                        <span className="text-[10px] text-slate-400">BUG SWITCH</span>
                        <div className={`w-2 h-2 rounded-full ${bugSwitchOn ? 'bg-red-500 animate-ping' : 'bg-slate-600'}`}></div>
                        <span className={`text-[10px] font-bold ${bugSwitchOn ? 'text-red-400' : 'text-slate-500'}`}>
                            {bugSwitchOn ? 'ON' : 'OFF'}
                        </span>
                    </div>
                    <div className="text-xs text-green-500/50 hidden md:block">SECURE</div>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-green-900 scrollbar-track-black">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.senderId === '-meyou' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[80%] ${msg.isSystem ? 'w-full text-center border-y border-green-500/20 py-2 my-2' : ''}`}>
                      {!msg.isSystem && (
                        <div className={`flex items-baseline space-x-2 mb-1 ${msg.senderId === '-meyou' ? 'justify-end' : ''}`}>
                           <span className={`text-[10px] font-bold ${msg.senderId === '-meyou' ? 'text-blue-400' : 'text-green-400'}`}>
                             {msg.senderId === '-meyou' ? msg.senderId : `${msg.senderId} [${msg.senderName}]`}
                           </span>
                           <span className="text-[9px] text-slate-600">{msg.timestamp}</span>
                        </div>
                      )}
                      
                      <div className={`${
                        msg.isSystem ? 'text-yellow-500 text-xs font-mono tracking-wider' : 
                        msg.senderId === '-meyou' 
                          ? 'bg-blue-900/20 border border-blue-500/30 text-blue-100 p-2 rounded-tl-lg rounded-bl-lg rounded-br-lg' 
                          : 'bg-green-900/10 border border-green-500/30 text-green-100 p-2 rounded-tr-lg rounded-bl-lg rounded-br-lg'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <form onSubmit={handleSendMessage} className="h-14 border-t border-green-500/30 flex items-center p-2 bg-green-900/5">
                <span className="text-blue-400 mr-2 font-bold">{'>'}</span>
                <input 
                  type="text" 
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder={bugSwitchOn ? (currentPersonaId ? `Commanding ${currentPersonaId}...` : "Select a role (e.g. *0, -99)...") : `Message ${activeAgent}...`}
                  className="flex-1 bg-transparent border-none outline-none text-green-100 placeholder-green-700 font-mono"
                  autoFocus
                />
                <button 
                  type="submit"
                  className="px-4 py-1 bg-green-600 text-black font-bold hover:bg-green-500 transition-colors rounded text-xs"
                >
                  SEND
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-green-500/30 space-y-4">
              <div className="text-6xl animate-pulse">⚡</div>
              <div className="text-xl tracking-widest uppercase">Select an agent to begin</div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Orchestration Manifest */}
        {activeAgent && (
          <div className="w-full md:w-64 border-t md:border-t-0 md:border-l border-green-500/30 bg-black z-30 flex flex-col h-1/3 md:h-full">
             <div className="p-2 border-b border-green-500/30 bg-green-900/10 flex justify-between items-center">
               <span className="text-xs font-bold text-green-400">NODE MANIFEST</span>
               <span className="text-[10px] bg-green-500/20 text-green-400 px-1 rounded">222 ONLINE</span>
             </div>
             
             {/* Node List */}
             <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-green-900 scrollbar-track-black min-h-0">
                <div className="space-y-0.5">
                    {orchestration.map((account, idx) => renderAccountNode(account))}
                </div>
             </div>

             {/* DASHBOARD LOGS SECTION */}
             <div className="h-40 border-t-2 border-green-500/30 bg-black flex flex-col">
                <div className="px-2 py-1 bg-green-900/20 text-[10px] text-green-400 font-bold border-b border-green-500/20 flex justify-between items-center">
                    <span>DASHBOARD LOGS (CSV)</span>
                    <button 
                        onClick={downloadSessionLog}
                        className="text-[9px] bg-green-600/30 hover:bg-green-600 text-green-100 px-1.5 py-0.5 rounded transition-colors"
                        title="Download Session CSV"
                    >
                        DL SESSION
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[9px] whitespace-pre">
                    {dashboardLogs.length === 0 && <span className="text-slate-600 italic">No activity recorded.</span>}
                    {dashboardLogs.map((log, i) => (
                        <div key={i} className="text-green-300/70 border-b border-green-500/5 pb-0.5 break-all">
                            {log}
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
             </div>
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes typewriter {
          from { width: 0; }
          to { width: 100%; }
        }
        .glitch-text {
            text-shadow: 2px 0 #0f0, -2px 0 #f00;
        }
      `}</style>
    </div>
  );
};

export default BugBase000;