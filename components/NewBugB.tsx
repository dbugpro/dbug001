import React from 'react';

interface NewBugProps {
  onBack: () => void;
}

const NewBugB: React.FC<NewBugProps> = ({ onBack }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center animate-fade-in text-white bg-slate-900">
        <div className="w-32 h-32 flex items-center justify-center bg-red-500/20 rounded-full mb-6">
            <span className="text-8xl animate-pulse">🐞</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-red-400">The Ladybug</h1>
        <p className="max-w-md text-slate-300 text-lg mb-8 leading-relaxed">
            A lucky find! This bug brings good fortune and occasionally fixes typos automatically. However, it flies away if you don't commit often.
        </p>
        <button 
            onClick={onBack} 
            className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-full transition-all duration-300 hover:scale-105 shadow-lg shadow-slate-700/50"
        >
            Back to Collection
        </button>
    </div>
  )
}
export default NewBugB;