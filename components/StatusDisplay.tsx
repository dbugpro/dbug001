
import React from 'react';

interface StatusDisplayProps {
  lives: number;
  score: number;
}

const HeartIcon: React.FC<{ filled: boolean }> = ({ filled }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 md:h-8 md:w-8 transition-all duration-300 ${filled ? 'text-red-500' : 'text-slate-600'}`} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
    </svg>
);


const StatusDisplay: React.FC<StatusDisplayProps> = ({ lives, score }) => {
  return (
    <div className="w-full flex justify-between items-center mb-2 md:mb-10 p-2 md:p-4 bg-slate-800/50 rounded-xl">
      <div className="flex items-center">
        <span className="text-base md:text-xl font-bold text-slate-400 mr-2 md:mr-4">LIVES</span>
        <div className="flex space-x-1 md:space-x-2">
            {[...Array(4)].map((_, i) => <HeartIcon key={i} filled={i < lives} />)}
        </div>
      </div>
      <div className="flex items-center">
         <span className="text-base md:text-xl font-bold text-slate-400 mr-2 md:mr-4">SCORE</span>
         <span className="text-2xl md:text-4xl font-bold text-white tracking-wider">{score}</span>
      </div>
    </div>
  );
};

export default StatusDisplay;
