import React from 'react';
import { KeyType } from '../types';
import { TARGET_SEQUENCE } from '../constants';
import GameButton from './GameButton';
import StatusDisplay from './StatusDisplay';

interface GameScreenProps {
  lives: number;
  score: number;
  currentStep: number;
  onKeyPress: (key: KeyType) => void;
  feedbackKey: KeyType | null;
  feedbackType: 'correct' | 'incorrect' | null;
  onEnterNewBugs: () => void;
}

const SequenceDisplay: React.FC<{ currentStep: number }> = ({ currentStep }) => (
  <div className="flex justify-center space-x-3 md:space-x-4 mb-6 md:mb-10">
    {TARGET_SEQUENCE.map((key, index) => (
      <div
        key={index}
        className={`w-14 h-14 md:w-20 md:h-20 flex items-center justify-center text-3xl md:text-4xl font-bold rounded-lg border-4 transition-all duration-200 ${
          index === currentStep
            ? 'border-yellow-400 text-yellow-400 scale-110 shadow-lg shadow-yellow-400/30'
            : 'border-slate-600 text-slate-500'
        }`}
      >
        {key}
      </div>
    ))}
  </div>
);

const GameScreen: React.FC<GameScreenProps> = ({
  lives,
  score,
  currentStep,
  onKeyPress,
  feedbackKey,
  feedbackType,
  onEnterNewBugs,
}) => {
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center py-2">
      <StatusDisplay lives={lives} score={score} />
      <SequenceDisplay currentStep={currentStep} />
      
      <div className="grid grid-cols-2 gap-3 md:gap-6 w-full max-w-md mb-6 md:mb-10">
        {TARGET_SEQUENCE.map((key) => (
          <GameButton
            key={key}
            label={key}
            onClick={() => onKeyPress(key)}
            isCorrect={feedbackKey === key && feedbackType === 'correct'}
            isIncorrect={feedbackKey === key && feedbackType === 'incorrect'}
          />
        ))}
      </div>
      
      <div 
        onClick={onEnterNewBugs}
        className="text-lg md:text-xl font-bold font-mono tracking-widest text-slate-600 py-3 px-6 mt-4 select-none cursor-pointer"
      >
        SCORE 100 TO ENTER
      </div>
    </div>
  );
};

export default GameScreen;