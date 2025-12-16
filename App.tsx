import React, { useState, useCallback, useEffect } from 'react';
import { GameState, KeyType } from './types';
import { TARGET_SEQUENCE, KEY_MAP } from './constants';
import StartScreen from './components/StartScreen';
import GameScreen from './components/GameScreen';
import GameOverScreen from './components/GameOverScreen';
import NewBugs from './components/NewBugs';
import NewBugA from './components/NewBugA';
import NewBugB from './components/NewBugB';
import NewBugC from './components/NewBugC';
import NewBugD from './components/NewBugD';
import BugBase000 from './components/BugBase000';
import { soundManager } from './utils/SoundManager';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.Idle);
  const [lives, setLives] = useState<number>(4);
  const [score, setScore] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [feedbackKey, setFeedbackKey] = useState<KeyType | null>(null);
  const [feedbackType, setFeedbackType] = useState<'correct' | 'incorrect' | null>(null);

  const resetGame = useCallback(() => {
    soundManager.init();
    soundManager.startBGM();
    setLives(4);
    setScore(0);
    setCurrentStep(0);
    setGameState(GameState.Playing);
  }, []);

  const handleManualNewBugs = useCallback(() => {
    soundManager.playUnlock();
    setGameState(GameState.NewBugs);
  }, []);

  const handleBackToNewBugs = useCallback(() => {
    setGameState(GameState.NewBugs);
  }, []);

  const handleUserInput = useCallback((key: KeyType) => {
    if (gameState !== GameState.Playing) return;

    if (key === TARGET_SEQUENCE[currentStep]) {
      soundManager.playCorrect();
      setFeedbackKey(key);
      setFeedbackType('correct');
      const nextStep = currentStep + 1;
      if (nextStep === TARGET_SEQUENCE.length) {
        soundManager.playSequenceComplete();
        
        const newScore = score + 10;
        setScore(newScore);
        setCurrentStep(0);

        if (newScore >= 100) {
          setTimeout(() => {
            soundManager.playUnlock();
            setGameState(GameState.NewBugs);
          }, 200);
        }
      } else {
        setCurrentStep(nextStep);
      }
    } else {
      soundManager.playIncorrect();
      setFeedbackKey(key);
      setFeedbackType('incorrect');
      const newLives = lives - 1;
      setLives(newLives);
      setCurrentStep(0);
      if (newLives <= 0) {
        soundManager.stopBGM();
        setGameState(GameState.GameOver);
      }
    }

    setTimeout(() => {
      setFeedbackKey(null);
      setFeedbackType(null);
    }, 300);
  }, [currentStep, lives, gameState, score]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Disable keyboard input for game controls if we aren't playing
      if (gameState !== GameState.Playing) return;
      
      const key = event.key.toUpperCase();
      if (KEY_MAP.hasOwnProperty(key)) {
        handleUserInput(KEY_MAP[key as keyof typeof KEY_MAP]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUserInput, gameState]);

  const renderContent = () => {
    switch (gameState) {
      case GameState.Playing:
        return (
          <GameScreen
            lives={lives}
            score={score}
            currentStep={currentStep}
            onKeyPress={handleUserInput}
            feedbackKey={feedbackKey}
            feedbackType={feedbackType}
            onEnterNewBugs={handleManualNewBugs}
          />
        );
      case GameState.GameOver:
        return <GameOverScreen score={score} onRestart={resetGame} />;
      case GameState.NewBugs:
        return (
          <NewBugs 
            onBack={resetGame} 
            onOpenA={() => setGameState(GameState.NewBugA)}
            onOpenB={() => setGameState(GameState.NewBugB)}
            onOpenC={() => setGameState(GameState.NewBugC)}
            onOpenD={() => setGameState(GameState.NewBugD)}
          />
        );
      case GameState.NewBugA:
        return <NewBugA onBack={handleBackToNewBugs} />;
      case GameState.NewBugB:
        return <NewBugB onBack={handleBackToNewBugs} />;
      case GameState.NewBugC:
        return <NewBugC onBack={handleBackToNewBugs} />;
      case GameState.NewBugD:
        return <NewBugD 
          onBack={handleBackToNewBugs} 
          onOpenBugBase={() => setGameState(GameState.BugBase000)}
        />;
      case GameState.BugBase000:
        return <BugBase000 onBack={handleBackToNewBugs} />;
      case GameState.Idle:
      default:
        return <StartScreen onStart={resetGame} />;
    }
  };

  return (
    <div className="min-h-screen text-white flex flex-col items-center justify-center p-4 font-sans">
      {renderContent()}
    </div>
  );
};

export default App;