/**
 * WebSocket hook for real-time updates from the LeadGen backend.
 *
 * Falls back to HTTP polling when WebSocket is unavailable (e.g. Vercel).
 *
 * Usage:
 *   const { connected, lastEvent } = useWebSocket(tenantId, token);
 *   // lastEvent = { type: "lead_created", data: {...} }
 */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

function getWsUrl() {
  if (typeof window === "undefined") return "wss://api.24go.site";
  if (window.location.hostname === "localhost") return "ws://localhost:8000";
  return "wss://api.24go.site"; // ponytail: hardcoded, same as getApiBase
}

function getApiUrl() {
  if (typeof window === "undefined") return "https://api.24go.site";
  if (window.location.hostname === "localhost") return "http://localhost:8000";
  return "https://api.24go.site"; // ponytail: hardcoded
}

export interface WsEvent {
  type: string;
  data: any;
  timestamp?: number;
}

export function useWebSocket(tenantId: string | null, token: string | null = null) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pollTimer = useRef<NodeJS.Timeout | null>(null);
  const sinceRef = useRef<number>(0);
  const modeRef = useRef<"ws" | "poll" | "detecting">("detecting");

  const wsBase = getWsUrl();
  const apiBase = getApiUrl();

  // ── Polling fallback ──────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (modeRef.current === "poll") return;
    modeRef.current = "poll";
    setConnected(true);

    const poll = async () => {
      if (!tenantId || !token) return;
      try {
        const res = await fetch(
          `${apiBase}/api/v1/events/poll?since=${sinceRef.current}&token=${encodeURIComponent(token)}`,
        );
        if (res.status === 401) {
          // ponytail: token expired, stop polling to avoid spam
          setConnected(false);
          modeRef.current = "detecting";
          return;
        }
        const data = await res.json();
        if (data.events?.length) {
          for (const ev of data.events) {
            setLastEvent(ev);
            if (ev.timestamp && ev.timestamp > sinceRef.current) {
              sinceRef.current = ev.timestamp;
            }
          }
        }
      } catch { /* ignore */ }
      pollTimer.current = setTimeout(poll, 2000); // ponytail: 2s not 1s
    };
    poll();
  }, [tenantId, token, apiBase]);

  // ── WebSocket mode ────────────────────────────────────────────────
  const connectWs = useCallback(() => {
    if (!tenantId || !token || modeRef.current !== "detecting") return;

    try {
      const ws = new WebSocket(`${wsBase}/ws/${tenantId}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      // ponytail: no probe — just try the real WS; if it fails, fall back to polling
      const fallbackTimer = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
        }
      }, 3000);

      ws.onopen = () => {
        clearTimeout(fallbackTimer);
        modeRef.current = "ws";
        setConnected(true);
      };
      ws.onclose = () => {
        clearTimeout(fallbackTimer);
        setConnected(false);
        wsRef.current = null;
        if (modeRef.current === "ws") {
          modeRef.current = "detecting";
          startPolling();
        }
      };
      ws.onerror = () => { clearTimeout(fallbackTimer); ws.close(); };
      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as WsEvent;
          setLastEvent(event);
          if (event.timestamp && event.timestamp > sinceRef.current) {
            sinceRef.current = event.timestamp;
          }
        } catch { /* ignore malformed */ }
      };
    } catch {
      startPolling();
    }
  }, [tenantId, token, wsBase, startPolling]);

  // ── Init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId || !token) return;

    modeRef.current = "detecting";
    connectWs();

    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
      wsRef.current?.close();
    };
  }, [tenantId, token, connectWs]);

  return { connected, lastEvent };
}
