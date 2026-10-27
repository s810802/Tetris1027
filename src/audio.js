/**
 * Web Audio API Sound Generator for Arcade Tetris
 * Synthesizes retro chiptune sounds on-demand without external audio files.
 */

class SoundController {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('tetris_muted') === 'true';
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('tetris_muted', String(this.muted));
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  playTone(freq, duration = 0.08, type = 'square', gainValue = 0.1, decay = true) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainValue, this.ctx.currentTime);
      if (decay) {
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      }

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // AudioContext autoplay restrictions or inactive tab
    }
  }

  playMove() {
    this.playTone(260, 0.04, 'square', 0.06);
  }

  playRotate() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(540, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch {}
  }

  playSoftDrop() {
    this.playTone(180, 0.03, 'sine', 0.05);
  }

  playHardDrop() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch {}
  }

  playHold() {
    this.playTone(440, 0.06, 'triangle', 0.09);
  }

  playLineClear(lines = 1) {
    if (this.muted) return;
    if (lines >= 4) {
      this.playTetris();
      return;
    }
    const notes = [440, 554, 659, 880];
    const count = Math.min(lines + 1, 4);
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        this.playTone(notes[i], 0.1, 'square', 0.12);
      }, i * 50);
    }
  }

  playTetris() {
    if (this.muted) return;
    // Ascending celebratory fanfare: C5, E5, G5, C6
    const fanfare = [523.25, 659.25, 783.99, 1046.5];
    fanfare.forEach((f, i) => {
      setTimeout(() => {
        this.playTone(f, 0.18, 'triangle', 0.18);
      }, i * 70);
    });
  }

  playLevelUp() {
    if (this.muted) return;
    const notes = [392, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this.playTone(f, 0.15, 'sine', 0.15);
      }, i * 60);
    });
  }

  playGameOver() {
    if (this.muted) return;
    const notes = [400, 350, 300, 250, 200, 150];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this.playTone(f, 0.12, 'sawtooth', 0.15);
      }, i * 90);
    });
  }
}

export const sound = new SoundController();
