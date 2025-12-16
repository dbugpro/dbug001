
import React from 'react';

interface NewBugsPageProps {
  onBack: () => void;
}

const NewBugsPage: React.FC<NewBugsPageProps> = ({ onBack }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center animate-fade-in">
      <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-lime-400 to-green-500 mb-6">
        NEW BUGS DISCOVERED
      </h1>
      <p className="text-slate-300 text-xl mb-12 max-w-lg leading-relaxed">
        Congratulations on reaching a score of 100! You have unlocked the secret developer zone. 
        New bugs are being hatched here for future updates.
      </p>
      
      <div className="flex space-x-8 mb-12 text-6xl animate-bounce">
        <span>🐛</span>
        <span className="animation-delay-200">🐞</span>
        <span className="animation-delay-400">🦗</span>
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

export default NewBugsPage;
