/**
 * WebSocket hook for real-time updates from the LeadGen backend.
 *
 * Falls back to HTTP polling when WebSocket is unavailable (e.g. Vercel).
 *
 * Usage:
 *   const { connected, lastEvent } = useWebSocket(tenantId);
 *   // lastEvent = { type: "lead_created", data: {...} }
 */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const getWsUrl = () => {
  if (typeof window === "undefined") return "ws://localhost:8000";
  if (window.location.hostname === "localhost") return "ws://localhost:8000";
  // On Vercel: use same host with ws protocol
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}`;
};
const WS_URL = getWsUrl();

export interface WsEvent {
  type: string;
  data: any;
  timestamp?: number;
}

function detectWebSocketSupport(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const test = new WebSocket(`${WS_URL}/ws/__probe`);
      const timer = setTimeout(() => {
        test.close();
        resolve(false);
      }, 2000);
      test.onopen = () => { clearTimeout(timer); test.close(); resolve(true); };
      test.onerror = () => { clearTimeout(timer); resolve(false); };
    } catch {
      resolve(false);
    }
  });
}

function getApiUrl() {
  if (typeof window === "undefined") return "http://localhost:8000";
  if (window.location.hostname === "localhost") return "http://localhost:8000";
  return ""; // relative URLs on Vercel
}

export function useWebSocket(tenantId: string | null) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const pollTimer = useRef<NodeJS.Timeout | null>(null);
  const sinceRef = useRef<number>(0);
  const modeRef = useRef<"ws" | "poll" | "detecting">("detecting");

  // ── Polling fallback ──────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (modeRef.current === "poll") return;
    modeRef.current = "poll";
    setConnected(true); // optimistic

    const poll = async () => {
      if (!tenantId) return;
      try {
        const res = await fetch(
          `${getApiUrl()}/api/v1/events/poll?tenant_id=${tenantId}&since=${sinceRef.current}`,
        );
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
      pollTimer.current = setTimeout(poll, 1000); // poll every 1s
    };
    poll();
  }, [tenantId]);

  // ── WebSocket mode ────────────────────────────────────────────────
  const connectWs = useCallback(() => {
    if (!tenantId || modeRef.current !== "detecting") return;

    try {
      const ws = new WebSocket(`${WS_URL}/ws/${tenantId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        modeRef.current = "ws";
        setConnected(true);
      };
      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // If WS disconnected quickly, fall back to polling
        if (modeRef.current === "ws") {
          modeRef.current = "detecting";
          startPolling();
        }
      };
      ws.onerror = () => ws.close();
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
  }, [tenantId, startPolling]);

  // ── Init: detect WS support, connect or poll ──────────────────────
  useEffect(() => {
    if (!tenantId) return;

    modeRef.current = "detecting";
    detectWebSocketSupport().then((wsOk) => {
      if (wsOk) {
        connectWs();
      } else {
        startPolling();
      }
    });

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (pollTimer.current) clearTimeout(pollTimer.current);
      wsRef.current?.close();
    };
  }, [tenantId, connectWs, startPolling]);

  return { connected, lastEvent };
}
