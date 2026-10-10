/**
 * Web Audio API synthesizer for Tactical Radio, EAS Evacuation Siren, and SOS Alerts.
 * 100% self-contained: No external audio files needed!
 */

class SoundEffectsEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Tactical Motorola/Apollo style Roger Beep on mic release
   */
  playRogerBeep() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      // Tone 1: 1200 Hz for 70ms
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1200, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.08);

      // Tone 2: 1800 Hz for 80ms
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1800, now + 0.08);
      gain2.gain.setValueAtTime(0.18, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.17);
    } catch (e) {
      console.warn('Audio playback not permitted yet:', e);
    }
  }

  /**
   * Radio Key-Up Squelch Burst (Mic button pressed)
   */
  playSquelchBurst() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      // Buffer with white noise
      const bufferSize = ctx.sampleRate * 0.06;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      // Bandpass filter for radio crackle
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2400, now);
      filter.Q.setValueAtTime(2.5, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
    } catch (e) {
      console.warn('Audio squelch error:', e);
    }
  }

  /**
   * Emergency Alert System (EAS) Dual-Tone Evacuation Siren
   */
  playEvacuationSiren(durationSeconds: number = 2.5) {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      // Dual tones: 853 Hz and 960 Hz (Standard EAS Header tones)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(853, now);

      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(960, now);

      gain.gain.setValueAtTime(0.12, now);
      // Pulsing siren envelope
      for (let i = 0; i < durationSeconds; i += 0.4) {
        gain.gain.setValueAtTime(0.14, now + i);
        gain.gain.setValueAtTime(0.03, now + i + 0.2);
      }
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + durationSeconds);
      osc2.stop(now + durationSeconds);
    } catch (e) {
      console.warn('Evacuation siren error:', e);
    }
  }

  /**
   * High-priority SOS Notification Ping
   */
  playAlertPing() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.15); // E6

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn('Alert ping error:', e);
    }
  }
}

export const soundFx = new SoundEffectsEngine();
