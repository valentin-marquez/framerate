import { type Hand, HandSchema } from "@framerate/contracts";

const HAND = "framerate.hand";
const DISMISSED = "framerate.mouse-fit.dismissed";
const REPORTED = "framerate.mouse-fit.reported";

// El navegador puede bloquear el almacenamiento: nada de esto debe romper la categoría.
function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

export function storedHand(): Hand | null {
  try {
    const parsed = HandSchema.safeParse(JSON.parse(read(HAND) ?? "null"));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const storeHand = (hand: Hand | null) => write(HAND, hand && JSON.stringify(hand));
export const promptDismissed = () => read(DISMISSED) !== null;
export const dismissPrompt = () => write(DISMISSED, "1");
export const alreadyReported = () => read(REPORTED) !== null;
export const markReported = () => write(REPORTED, "1");
