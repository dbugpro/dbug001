import React from 'react';

interface NewBugsProps {
  onBack: () => void;
  onOpenA: () => void;
  onOpenB: () => void;
  onOpenC: () => void;
  onOpenD: () => void;
}

const NewBugs: React.FC<NewBugsProps> = ({ onBack, onOpenA, onOpenB, onOpenC, onOpenD }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center animate-fade-in">
      <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-lime-400 to-green-500 mb-6">
        NEW BUGS DISCOVERED
      </h1>
      <p className="text-slate-300 text-xl mb-12 max-w-lg leading-relaxed">
        Congratulations on reaching a score of 100! You have unlocked the{' '}
        <span 
          onClick={onOpenD}
          className="cursor-pointer"
        >
          secret developer zone
        </span>. 
        Click on a bug to inspect it.
      </p>
      
      <div className="flex space-x-12 mb-12 text-6xl">
        <button 
          onClick={onOpenA} 
          className="animate-bounce hover:scale-125 transition-transform duration-300 cursor-pointer focus:outline-none" 
          style={{ animationDelay: '0ms' }}
          title="Inspect Bug A"
        >
          🐛
        </button>
        <button 
          onClick={onOpenB} 
          className="animate-bounce hover:scale-125 transition-transform duration-300 cursor-pointer focus:outline-none" 
          style={{ animationDelay: '200ms' }}
          title="Inspect Bug B"
        >
          🐞
        </button>
        <button 
          onClick={onOpenC} 
          className="animate-bounce hover:scale-125 transition-transform duration-300 cursor-pointer focus:outline-none" 
          style={{ animationDelay: '400ms' }}
          title="Inspect Bug C"
        >
          🦗
        </button>
      </div>

      <button
        onClick={onBack}
        className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-full transition-all duration-300 hover:scale-105 shadow-lg shadow-slate-700/50"
      >
        Return to Game
      </button>
    </div>
  );
};

export default NewBugs;