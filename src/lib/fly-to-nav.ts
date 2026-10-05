/**
 * «Vi esto» → the poster shrinks and flies into the Perfil tab (where Tu diario
 * lives); the tab pulses on arrival. Pure DOM + Web Animations, reduced-motion aware.
 */

const RECEIVE_CLASS = "nav-receive";
const FLY_MS = 620;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const findProfileNavTarget = () =>
  (document.querySelector('[data-nav="profile"]') as HTMLElement | null) ??
  (document.querySelector('a[href="/perfil"]') as HTMLElement | null);

export const pulseProfileNav = (target = findProfileNavTarget()) => {
  if (!target) {
    return;
  }
  target.classList.add(RECEIVE_CLASS);
  window.setTimeout(() => target.classList.remove(RECEIVE_CLASS), 900);
};

/** Returns a promise that resolves when the poster has landed (or immediately). */
export const flyPosterToProfile = (card: HTMLElement | null, posterSrc: string | null) =>
  new Promise<void>((resolve) => {
    const target = findProfileNavTarget();
    if (!card || !target || prefersReducedMotion() || typeof card.animate !== "function") {
      pulseProfileNav(target ?? undefined);
      resolve();
      return;
    }

    const from = card.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const ghost = document.createElement("div");
    ghost.setAttribute("aria-hidden", "true");
    ghost.className = "fly-poster";
    ghost.style.left = `${from.left}px`;
    ghost.style.top = `${from.top}px`;
    ghost.style.width = `${from.width}px`;
    ghost.style.height = `${from.height}px`;
    if (posterSrc) {
      ghost.style.backgroundImage = `url("${posterSrc}")`;
    }
    document.body.appendChild(ghost);

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const scale = Math.max(0.08, Math.min(0.14, (to.width * 0.9) / from.width));

    const animation = ghost.animate(
      [
        { transform: "translate3d(0,0,0) scale(1) rotate(0deg)", opacity: 1, offset: 0 },
        { transform: `translate3d(${dx * 0.35}px, ${dy * 0.18}px, 0) scale(0.55) rotate(-4deg)`, opacity: 0.95, offset: 0.45 },
        { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale}) rotate(-2deg)`, opacity: 0.2, offset: 1 },
      ],
      { duration: FLY_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
    );

    const finish = () => {
      ghost.remove();
      pulseProfileNav(target);
      resolve();
    };
    animation.addEventListener("finish", finish, { once: true });
    animation.addEventListener("cancel", finish, { once: true });
  });
