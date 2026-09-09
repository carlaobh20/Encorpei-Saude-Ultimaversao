/**
 * ENCORPEI Push Notification System
 *
 * Suporta:
 * 1. Web Notification API (in-session, enquanto o app está aberto)
 * 2. Service Worker Push (requer backend — Firebase/web-push)
 * 3. Background Sync para operações offline
 *
 * Para notificações reais em background:
 * - Configure Firebase Cloud Messaging (FCM) ou web-push
 * - Adicione VAPID_PUBLIC_KEY nas variáveis de ambiente
 * - Backend deve chamar /api/push/send com o subscription do usuário
 */

const PERMISSION_KEY = "encorpei_notification_perm";
const SUBSCRIPTION_KEY = "encorpei_push_subscription";

// ─── Permission ──────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") {
    localStorage.setItem(PERMISSION_KEY, "granted");
    return true;
  }
  if (Notification.permission === "denied") {
    localStorage.setItem(PERMISSION_KEY, "denied");
    return false;
  }
  const result = await Notification.requestPermission();
  localStorage.setItem(PERMISSION_KEY, result);
  return result === "granted";
}

export function isNotificationPermitted(): boolean {
  if (!("Notification" in window)) return false;
  return Notification.permission === "granted";
}

// ─── Service Worker Push Registration ────────────────────────

export async function registerPushSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  if (!isNotificationPermitted()) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) return existing;

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) return null; // Push requires VAPID key — skip silently

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(subscription));
    return subscription;
  } catch (e) {
    // Fail silently — push is enhancement, not required
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// ─── In-session timer-based reminders (fallback) ─────────────

let reminderTimers: ReturnType<typeof setTimeout>[] = [];

export function scheduleReminder(hour: number, minute: number, title: string, body: string): void {
  if (!isNotificationPermitted()) return;
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const delay = target.getTime() - now.getTime();
  if (delay > 86_400_000) return;

  const timer = setTimeout(() => {
    try {
      if (isNotificationPermitted()) {
        new Notification(title, { body, icon: "/pwa-192.png", badge: "/pwa-192.png", tag: `encorpei-${hour}-${minute}` });
      }
    } catch { /* silent */ }
  }, delay);
  reminderTimers.push(timer);
}

export function cancelReminders(): void {
  reminderTimers.forEach(clearTimeout);
  reminderTimers = [];
}

export function setupDailyReminders(): void {
  cancelReminders();
  scheduleReminder(7, 0,  "Bom dia! ☀️",  "Registre seu peso e comece o dia no Encorpei.");
  scheduleReminder(12, 30, "Hora do almoço! 🍽️", "Não esqueça de registrar sua refeição.");
  scheduleReminder(21, 0, "Boa noite! 🌙", "Complete seu registro diário — 1 minuto transforma.");
}

// ─── Background Sync (offline queue) ─────────────────────────

export async function queueOfflineRequest(request: Request): Promise<void> {
  if (!("serviceWorker" in navigator) || !("SyncManager" in window)) return;
  try {
    const cache = await caches.open("encorpei-offline-queue");
    await cache.put(request, new Response("queued"));
    const registration = await navigator.serviceWorker.ready;
    await (registration as any).sync?.register("sync-offline-records");
  } catch { /* silent */ }
}
