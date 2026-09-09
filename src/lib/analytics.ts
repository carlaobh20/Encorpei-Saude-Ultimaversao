/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Product Analytics — standardized event tracking layer.
 * 
 * Taxonomy: docs/ANALYTICS_TAXONOMY.md
 * 
 * Performance: events are batched in localStorage and flushed every 30s or when
 * the page unloads — reducing Supabase INSERT load from 1/pageview to ~1/30s per user.
 * At 5k users this reduces writes by ~95%.
 */

import { supabase } from "@/integrations/supabase/client";

const TRACKED_FIRST_EVENTS = new Set<string>();
const BATCH_KEY = "encorpei_event_batch";
const FLUSH_INTERVAL = 30_000; // 30 seconds

interface QueuedEvent {
  event_name: string;
  metadata?: Record<string, unknown>;
  ts: number;
}

// ─── Batch Queue ─────────────────────────────────────────────
function enqueueEvent(eventName: string, metadata?: Record<string, unknown>) {
  try {
    const raw = localStorage.getItem(BATCH_KEY);
    const queue: QueuedEvent[] = raw ? JSON.parse(raw) : [];
    queue.push({ event_name: eventName, metadata, ts: Date.now() });
    // Cap queue at 200 events to prevent localStorage bloat
    if (queue.length > 200) queue.splice(0, queue.length - 200);
    localStorage.setItem(BATCH_KEY, JSON.stringify(queue));
  } catch {
    // localStorage might be full or unavailable — silent fail
  }
}

async function flushEventQueue() {
  try {
    const raw = localStorage.getItem(BATCH_KEY);
    if (!raw) return;
    const queue: QueuedEvent[] = JSON.parse(raw);
    if (!queue.length) return;

    // Clear queue immediately to prevent duplicate sends on concurrent flushes
    localStorage.removeItem(BATCH_KEY);

    const { data: { user } } = await supabase.auth.getUser();
    const rows = queue.map(e => ({
      event_name: e.event_name,
      user_id: user?.id ?? null,
      metadata: (e.metadata as any) ?? null,
    }));

    // Insert batch — one round trip for up to 200 events
    await (supabase as any).from("beta_events").insert(rows);
  } catch {
    // Silent fail — analytics must never break UX
  }
}

// ─── Auto-flush setup ────────────────────────────────────────
let flushTimer: ReturnType<typeof setInterval> | null = null;

function ensureFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(flushEventQueue, FLUSH_INTERVAL);
  // Also flush on page unload
  window.addEventListener("beforeunload", flushEventQueue, { once: false });
}

// Start timer immediately when module loads
if (typeof window !== "undefined") ensureFlushTimer();

/** Fire-and-forget event tracking. Never blocks UI. */
export function trackEvent(
  eventName: string,
  metadata?: Record<string, unknown>
) {
  // Activation and conversion events flush immediately — too important to lose
  const IMMEDIATE_EVENTS = new Set([
    "onboarding_completed", "checkout_completed", "checkout_started",
    "first_weight",
  ]);

  if (IMMEDIATE_EVENTS.has(eventName)) {
    queueMicrotask(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await (supabase as any).from("beta_events").insert([{
          event_name: eventName,
          user_id: user?.id ?? null,
          metadata: (metadata as any) ?? null,
        }]);
      } catch { /* silent */ }
    });
  } else {
    // All other events go to batch queue
    enqueueEvent(eventName, metadata);
  }
}

/** Track activation milestone — fires once per session. */
export function trackFirstEvent(
  eventName: string,
  metadata?: Record<string, unknown>
) {
  if (TRACKED_FIRST_EVENTS.has(eventName)) return;
  TRACKED_FIRST_EVENTS.add(eventName);
  trackEvent(eventName, metadata);
}

/** Track day return — call once on app mount. */
export function trackDayReturn() {
  const key = "encorpei_last_active";
  const today = new Date().toISOString().slice(0, 10);
  const last = localStorage.getItem(key);
  
  if (last && last !== today) {
    const daysDiff = Math.floor(
      (new Date(today).getTime() - new Date(last).getTime()) / 86400000
    );
    trackEvent("day_return", { days_away: daysDiff, consecutive: daysDiff === 1 });
  }
  
  localStorage.setItem(key, today);
}

// ─── Convenience helpers for common events ───

export const analytics = {
  // Onboarding
  onboardingStarted: () => trackEvent("onboarding_started"),
  onboardingStep: (step: number, stepId: string, answer?: unknown) =>
    trackEvent("onboarding_step_completed", { step, step_id: stepId, answer }),
  onboardingCompleted: (meta: Record<string, unknown>) =>
    trackEvent("onboarding_completed", meta),

  // Activation (first-time — deduplicated per session via trackFirstEvent)
  firstWeight: (kg: number) => trackFirstEvent("first_weight", { weight_kg: kg }),
  firstMeal: (type: string) => trackFirstEvent("first_meal", { meal_type: type }),
  firstWaterGoal: (ml: number) => trackFirstEvent("first_water_goal", { ml }),

  // Engagement
  dashboardViewed: (dailyScore: number) =>
    trackEvent("dashboard_viewed", { daily_score: dailyScore }),
  missionCompleted: (type: string, priority: number) =>
    trackEvent("mission_completed", { mission_type: type, priority }),
  missionSkipped: (type: string) =>
    trackEvent("mission_skipped", { mission_type: type }),
  welcomeFirstStep: (action: string) =>
    trackEvent("welcome_first_step", { action }),
  pageViewed: (page: string, route: string) =>
    trackEvent("page_viewed", { page, route }),

  // Professional (B2B)
  proOnboardingCompleted: (specialty: string) =>
    trackEvent("pro_onboarding_completed", { specialty }),
  proPatientViewed: () => trackEvent("pro_patient_viewed"),
  proPrescriptionCreated: (type: string) =>
    trackEvent("pro_prescription_created", { type }),
  proDashboardViewed: (patientCount: number) =>
    trackEvent("pro_dashboard_viewed", { patient_count: patientCount }),

  // Commercial
  planPageViewed: () => trackEvent("plan_page_viewed"),
  planSelected: (plan: string, price: number) =>
    trackEvent("plan_selected", { plan, price }),
  checkoutStarted: (plan: string) =>
    trackEvent("checkout_started", { plan }),
  checkoutCompleted: (plan: string) =>
    trackEvent("checkout_completed", { plan }),
  b2bInterestClicked: (source: string) =>
    trackEvent("b2b_interest_clicked", { source }),
  upgradeClicked: (source: string, feature?: string) =>
    trackEvent("upgrade_clicked", { source, feature }),

  // Treatment
  treatmentSetupStarted: () => trackEvent("treatment_setup_started"),
  treatmentSetupCompleted: (name: string, frequency: string) =>
    trackEvent("treatment_setup_completed", { name, frequency }),
  treatmentDoseLogged: (name: string) =>
    trackEvent("treatment_dose_logged", { treatment: name }),
  treatmentDoseSkipped: (name: string) =>
    trackEvent("treatment_dose_skipped", { treatment: name }),
  treatmentCheckinLogged: (name: string) =>
    trackEvent("treatment_checkin_logged", { treatment: name }),
  treatmentPaused: (name: string) =>
    trackEvent("treatment_paused", { treatment: name }),
  treatmentCompleted: (name: string) =>
    trackEvent("treatment_completed", { treatment: name }),
  treatmentPageViewed: () => trackEvent("treatment_page_viewed"),
  proTreatmentViewed: () => trackEvent("pro_treatment_viewed"),
} as const;
