/**
 * Web Audio API Synthesizer for Call Tones
 * Generates dial tones, ringtones, connect chimes, and hangup sounds
 * purely in-browser with zero external asset dependencies.
 */

class CallAudioManager {
  private ctx: AudioContext | null = null;
  private ringOscillator1: OscillatorNode | null = null;
  private ringOscillator2: OscillatorNode | null = null;
  private ringGain: GainNode | null = null;
  private ringInterval: NodeJS.Timeout | null = null;

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Incoming call ringtone (Dual-tone repeating chime)
   */
  startIncomingRingtone() {
    this.stopAll();
    try {
      const playChime = () => {
        try {
          const ctx = this.getContext();
          const now = ctx.currentTime;

          // Note 1: E5 (659.25 Hz)
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(659.25, now);
          gain1.gain.setValueAtTime(0.15, now);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.45);

          // Note 2: G#5 (830.61 Hz)
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(830.61, now + 0.15);
          gain2.gain.setValueAtTime(0.18, now + 0.15);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.15);
          osc2.stop(now + 0.7);

          // Note 3: B5 (987.77 Hz)
          const osc3 = ctx.createOscillator();
          const gain3 = ctx.createGain();
          osc3.type = 'sine';
          osc3.frequency.setValueAtTime(987.77, now + 0.35);
          gain3.gain.setValueAtTime(0.2, now + 0.35);
          gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
          osc3.connect(gain3);
          gain3.connect(ctx.destination);
          osc3.start(now + 0.35);
          osc3.stop(now + 1.0);
        } catch {}
      };

      playChime();
      this.ringInterval = setInterval(playChime, 2500);
    } catch {}
  }

  /**
   * Outgoing calling tone (Standard soft ringing pulse)
   */
  startOutgoingRingtone() {
    this.stopAll();
    try {
      const playPulse = () => {
        try {
          const ctx = this.getContext();
          const now = ctx.currentTime;

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.setValueAtTime(0.08, now + 1.2);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 1.35);
        } catch {}
      };

      playPulse();
      this.ringInterval = setInterval(playPulse, 3200);
    } catch {}
  }

  /**
   * Call connected pleasant confirmation sound
   */
  playConnectChime() {
    this.stopAll();
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.18); // G5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.38);
    } catch {}
  }

  /**
   * Call ended descending chime
   */
  playEndChime() {
    this.stopAll();
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.25);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.32);
    } catch {}
  }

  stopAll() {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
    try {
      if (this.ringOscillator1) {
        this.ringOscillator1.stop();
        this.ringOscillator1.disconnect();
        this.ringOscillator1 = null;
      }
      if (this.ringOscillator2) {
        this.ringOscillator2.stop();
        this.ringOscillator2.disconnect();
        this.ringOscillator2 = null;
      }
    } catch {}
  }
}

export const callAudio = new CallAudioManager();
