import { createContext, useContext } from 'react';

/**
 * Small interface sounds, synthesised with the Web Audio API (no sound files to download).
 * Browsers only allow sound after the user has clicked or pressed a key, so nothing plays on page load.
 */
export type SoundName = 'click' | 'toggle' | 'filter' | 'success' | 'error' | 'whoosh';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number, endFreq?: number) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function play(name: SoundName) {
  switch (name) {
    case 'click':
      return tone(880, 0, 0.06, 'triangle', 0.05);
    case 'filter':
      return tone(620, 0, 0.09, 'sine', 0.06, 940);
    case 'toggle':
      tone(520, 0, 0.07, 'sine', 0.05);
      return tone(780, 0.06, 0.09, 'sine', 0.05);
    case 'success':
      tone(660, 0, 0.12, 'sine', 0.06);
      tone(880, 0.1, 0.12, 'sine', 0.06);
      return tone(1320, 0.2, 0.22, 'sine', 0.05);
    case 'error':
      tone(300, 0, 0.14, 'sawtooth', 0.03);
      return tone(220, 0.12, 0.2, 'sawtooth', 0.03);
    case 'whoosh':
      return tone(220, 0, 0.25, 'sine', 0.035, 900);
  }
}

export type SoundApi = { enabled: boolean; setEnabled: (on: boolean) => void; play: (n: SoundName) => void };
export const SoundContext = createContext<SoundApi>({ enabled: false, setEnabled: () => {}, play: () => {} });
export const useSound = () => useContext(SoundContext);
