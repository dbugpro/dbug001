
export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private isPlayingBgm: boolean = false;
  private nextNoteTime: number = 0;
  private timerID: number | undefined;
  private sequenceIndex: number = 0;
  private tempo: number = 110;

  // Bass notes for D, B, A, C pattern (Low octave)
  // D2 (73.42), B1 (61.74), A1 (55.00), C2 (65.41)
  private readonly bassNotes = [73.42, 61.74, 55.00, 65.41];

  init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playCorrect() {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t); // A5
    osc.frequency.exponentialRampToValueAtTime(1760, t + 0.1); // Jump up octave

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  playIncorrect() {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.linearRampToValueAtTime(100, t + 0.3);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  playSequenceComplete() {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    // Nice Major 7th arpeggio
    const notes = [523.25, 659.25, 783.99, 987.77]; // C, E, G, B
    
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = 'triangle';
      osc.frequency.value = freq;
      
      const startTime = t + i * 0.06;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }

  playUnlock() {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, t); // C5
    osc.frequency.linearRampToValueAtTime(1046.5, t + 0.4); // C6

    gain.gain.setValueAtTime(0.1, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.4);
  }

  startBGM() {
    this.init();
    if (this.isPlayingBgm) return;
    this.isPlayingBgm = true;
    this.sequenceIndex = 0;
    
    if (this.ctx) {
        this.nextNoteTime = this.ctx.currentTime + 0.1;
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = 0.3;
        this.bgmGain.connect(this.masterGain!);
        this.scheduler();
    }
  }

  stopBGM() {
    this.isPlayingBgm = false;
    if (this.timerID) window.clearTimeout(this.timerID);
    
    if (this.bgmGain && this.ctx) {
      const t = this.ctx.currentTime;
      this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, t);
      this.bgmGain.gain.linearRampToValueAtTime(0, t + 0.5);
      setTimeout(() => {
        if (this.bgmGain) {
            this.bgmGain.disconnect();
            this.bgmGain = null;
        }
      }, 500);
    }
  }

  private scheduler() {
    if (!this.isPlayingBgm || !this.ctx) return;

    // Lookahead: Schedule notes for the next 100ms
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      this.scheduleNote(this.nextNoteTime);
      this.advanceNote();
    }
    
    this.timerID = window.setTimeout(() => this.scheduler(), 25);
  }

  private scheduleNote(time: number) {
    if (!this.ctx || !this.bgmGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // Simple bass pluck
    osc.type = 'square';
    // Pattern: D, B, A, C looping
    osc.frequency.value = this.bassNotes[this.sequenceIndex % 4];

    // Filter to make it sound more like a synth bass
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value = 1;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);

    // Percussive envelope
    const beatLen = 60 / this.tempo;
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + beatLen * 0.5);

    osc.start(time);
    osc.stop(time + beatLen);
  }

  private advanceNote() {
    const secondsPerBeat = 60.0 / this.tempo;
    this.nextNoteTime += secondsPerBeat;
    this.sequenceIndex++;
  }
}

export const soundManager = new SoundManager();
