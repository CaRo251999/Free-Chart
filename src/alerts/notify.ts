import { toast } from '../ui/toast';

let ctx: AudioContext | null = null;

/** Short two-tone beep generated with WebAudio (no audio files, so no licensing). */
export function playBeep() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    [880, 1175].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.17);
    });
  } catch {
    /* audio blocked until the user interacts with the page */
  }
}

export function notificationsSupported() {
  return typeof Notification !== 'undefined';
}

/** Must be called from a user gesture (e.g. creating the first alert). Resolves to the permission. */
export async function ensurePermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission === 'default') return Notification.requestPermission();
  return Notification.permission;
}

export function fireAlert(message: string) {
  toast(`🔔 ${message}`, 8000);
  playBeep();
  if (notificationsSupported() && Notification.permission === 'granted') {
    try {
      new Notification('Free Chart', { body: message, tag: message });
    } catch {
      /* some browsers only allow notifications from a service worker */
    }
  }
}
