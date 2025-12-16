
import React from 'react';

interface GameOverScreenProps {
  score: number;
  onRestart: () => void;
}

const GameOverScreen: React.FC<GameOverScreenProps> = ({ score, onRestart }) => {
  return (
    <div className="text-center flex flex-col items-center justify-center bg-slate-800/50 p-10 rounded-2xl shadow-2xl backdrop-blur-sm animate-fade-in">
      <h2 className="text-6xl font-bold text-red-500 mb-4 tracking-tighter">Game Over</h2>
      <p className="text-slate-300 text-2xl mb-2">Your final score is</p>
      <p className="text-7xl font-bold text-yellow-400 mb-8">{score}</p>
      <button
        onClick={onRestart}
        className="px-10 py-4 text-2xl font-bold text-white bg-green-600 rounded-lg hover:bg-green-500 transition-all duration-300 ease-in-out transform hover:scale-105 shadow-lg shadow-green-500/30"
      >
        Play Again
      </button>
    </div>
  );
};

export default GameOverScreen;
