/** Confetti burst for level clear. Respects prefers-reduced-motion. */

const COLORS = ["#f0b429", "#2a9d8f", "#5b8def", "#9b7ede", "#e6e9e4"];

export function launchConfetti(): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const n = 48;
  for (let i = 0; i < n; i++) {
    const el = document.createElement("div");
    el.className = "confetti-piece";
    el.style.left = `${Math.random() * 100}vw`;
    el.style.background = COLORS[i % COLORS.length]!;
    el.style.transform = `rotate(${Math.random() * 360}deg)`;
    el.style.opacity = "0.9";
    document.body.appendChild(el);
    const dur = 1200 + Math.random() * 1400;
    const xDrift = (Math.random() - 0.5) * 120;
    el.animate(
      [
        { transform: `translate(0, 0) rotate(0deg)`, opacity: 1 },
        {
          transform: `translate(${xDrift}px, ${window.innerHeight + 40}px) rotate(${Math.random() * 720}deg)`,
          opacity: 0.2,
        },
      ],
      { duration: dur, easing: "cubic-bezier(.2,.7,.3,1)" },
    ).onfinish = () => el.remove();
  }
}

export function playFanfare(): void {
  // tiny WebAudio blip — optional
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = 660;
    g.gain.value = 0.04;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.18);
    o.stop(ctx.currentTime + 0.22);
  } catch {
    // audio not available
  }
}
