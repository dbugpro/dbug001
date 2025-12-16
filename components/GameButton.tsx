
import React from 'react';
import { KeyType } from '../types';
import { KEY_COLORS, KEY_SHADOWS } from '../constants';

interface GameButtonProps {
  label: KeyType;
  onClick: () => void;
  isCorrect: boolean;
  isIncorrect: boolean;
}

const GameButton: React.FC<GameButtonProps> = ({ label, onClick, isCorrect, isIncorrect }) => {
  // Reduced height on mobile from h-24 to h-20 to save space
  const baseClasses = 'w-full h-20 md:h-32 rounded-2xl text-5xl font-bold text-white flex items-center justify-center transition-all duration-100 ease-in-out focus:outline-none';
  const colorClass = KEY_COLORS[label];
  const shadowClass = KEY_SHADOWS[label];

  let stateClasses = 'active:translate-y-1 active:shadow-none';
  if (isCorrect) {
    stateClasses = 'transform scale-110 ring-4 ring-green-400 shadow-lg shadow-green-400/50';
  } else if (isIncorrect) {
    stateClasses = 'transform scale-90 ring-4 ring-red-500 shadow-lg shadow-red-500/50 animate-shake';
  }
  
  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${colorClass} ${shadowClass} ${stateClasses}`}
    >
      {label}
    </button>
  );
};

export default GameButton;
