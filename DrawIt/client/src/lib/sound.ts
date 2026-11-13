// Tiny WebAudio blips: no audio files to load or host.
let ctx: AudioContext | null = null;

type Blip = "correct" | "tick" | "turn" | "end" | "join";

const NOTES: Record<Blip, number[]> = {
  correct: [660, 880, 1175],
  tick: [880],
  turn: [523, 659],
  end: [440, 330],
  join: [700],
};

export function playSound(kind: Blip, muted: boolean) {
  if (muted || typeof window === "undefined") return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ||= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    NOTES[kind].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.12, t0 + i * 0.09 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.09 + 0.16);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t0 + i * 0.09);
      osc.stop(t0 + i * 0.09 + 0.18);
    });
  } catch {
    /* audio is a nicety; never break the game for it */
  }
}
