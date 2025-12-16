
import React from 'react';

interface StartScreenProps {
  onStart: () => void;
}

const HeartIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 inline-block text-red-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
    </svg>
);


const StartScreen: React.FC<StartScreenProps> = ({ onStart }) => {
  return (
    <div className="text-center flex flex-col items-center justify-center bg-slate-800/50 p-8 rounded-2xl shadow-2xl backdrop-blur-sm">
      <h1 className="text-5xl md:text-6xl font-bold tracking-tighter mb-2 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500">
        Sequence Heartbeat
      </h1>
      <p className="text-slate-300 text-lg mb-6">Match the sequence: D B A C</p>
      <div className="flex space-x-2 text-3xl mb-8">
        <HeartIcon />
        <HeartIcon />
        <HeartIcon />
        <HeartIcon />
      </div>
      <button
        onClick={onStart}
        className="px-10 py-4 text-2xl font-bold text-white bg-violet-600 rounded-lg hover:bg-violet-500 transition-all duration-300 ease-in-out transform hover:scale-105 shadow-lg shadow-violet-500/30"
      >
        Start Game
      </button>
    </div>
  );
};

export default StartScreen;
