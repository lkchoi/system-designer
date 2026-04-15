import { record } from "rrweb";
import { ulid } from "ulid";

const ENDPOINT = import.meta.env.VITE_REPLAY_ENDPOINT ?? "http://localhost:3000";
const BATCH_INTERVAL_MS = 5_000;
const MAX_BATCH_SIZE = 50;

interface ReplayEvent {
  type: number;
  timestamp: number;
  data: Record<string, unknown>;
  delay?: number;
}

let sessionId: string;
let buffer: ReplayEvent[] = [];
let sequenceNumber = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function getOrCreateSession(): string {
  const key = "__sr_sid";
  const timeout = 30 * 60 * 1000;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const stored = JSON.parse(raw);
      if (Date.now() - stored.lastActivity < timeout) {
        sessionStorage.setItem(key, JSON.stringify({ ...stored, lastActivity: Date.now() }));
        return stored.id;
      }
    }
  } catch {}
  const id = ulid();
  sessionStorage.setItem(key, JSON.stringify({ id, lastActivity: Date.now() }));
  return id;
}

async function sendBatch(events: ReplayEvent[], useBeacon = false) {
  const payload = {
    sessionId,
    sequenceNumber: sequenceNumber++,
    events,
    sentAt: Date.now(),
  };

  if (useBeacon) {
    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    navigator.sendBeacon(`${ENDPOINT}/api/v1/events`, blob);
    return;
  }

  try {
    await fetch(`${ENDPOINT}/api/v1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {}
}

function flush() {
  if (buffer.length === 0) return;
  const events = buffer.splice(0);
  sendBatch(events);
}

function flushSync() {
  if (buffer.length === 0) return;
  const events = buffer.splice(0);
  sendBatch(events, true);
}

export function initReplay() {
  sessionId = getOrCreateSession();

  // Register session with server
  fetch(`${ENDPOINT}/api/v1/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      url: window.location.href,
      userAgent: navigator.userAgent,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      startedAt: Date.now(),
    }),
  }).catch(() => {});

  // Start recording
  const stopFn = record({
    emit: (event) => {
      buffer.push(event as unknown as ReplayEvent);
      if (buffer.length >= MAX_BATCH_SIZE) flush();
    },
    maskAllInputs: true,
    blockClass: "rr-block",
    checkoutEveryNms: 120_000,
    recordCrossOriginIframes: false,
    inlineImages: false,
    inlineStylesheet: true,
    collectFonts: false,
  });

  // Periodic flush
  timer = setInterval(flush, BATCH_INTERVAL_MS);

  // Flush on page hide/unload
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSync();
  });
  window.addEventListener("beforeunload", flushSync);

  // Capture errors and report to server
  window.addEventListener("error", (event) => {
    record.addCustomEvent("error", {
      message: event.message,
      stack: event.error?.stack,
    });
    fetch(`${ENDPOINT}/api/v1/errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        message: event.message,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  });

  window.addEventListener("unhandledrejection", (event) => {
    const msg = String(event.reason?.message ?? event.reason);
    record.addCustomEvent("error", { message: msg, stack: event.reason?.stack });
    fetch(`${ENDPOINT}/api/v1/errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        message: msg,
        stack: event.reason?.stack,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  });

  console.log(`[session-replay] Recording session ${sessionId}`);

  return {
    getSessionId: () => sessionId,
    stop: () => {
      stopFn?.();
      if (timer) clearInterval(timer);
      flushSync();
    },
  };
}
