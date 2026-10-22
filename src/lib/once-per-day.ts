/**
 * True once per local day for a key (localStorage). The Hoy stub's «respiro» (FIL-I21-2)
 * and the ficha's swipe hint (FIL-I24-1) teach a gesture once, then stay still.
 * Private browsing or a blocked storage counts as «already seen»: never nag.
 */
export const claimOncePerDay = (key: string, now = new Date()) => {
  try {
    const today = now.toDateString();
    if (window.localStorage.getItem(key) === today) {
      return false;
    }
    window.localStorage.setItem(key, today);
    return true;
  } catch {
    return false;
  }
};
