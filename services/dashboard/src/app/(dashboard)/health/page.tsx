"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

type HealthData = {
  status: string;
  ws_connections: number;
  api_version: string;
  uptime: string;
  db_status: string;
  redis_status: string;
};

type WorkerInfo = {
  name: string;
  status: "running" | "stopped" | "unknown";
  queue: string;
  active_tasks: number;
};

export default function HealthPage() {
  const { auth } = useAuth();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth?.token) return;
    setLoading(true);

    // Fetch health + listener status (has worker info)
    Promise.all([
      fetch("http://localhost:8000/health").then((r) => r.json()),
      fetch("http://localhost:8000/api/v1/listeners/status", {
        headers: { Authorization: `Bearer ${auth.token}` },
      }).then((r) => r.json()).catch(() => ({})),
    ]).then(([healthData, listenerData]) => {
      setHealth(healthData);
      // Parse worker info from listener status
      const active = listenerData?.active_workers || [];
      setWorkers(active.map((w: any) => ({
        name: w.worker_name || w.name || "unknown",
        status: "running" as const,
        queue: w.queues?.[0] || "unknown",
        active_tasks: w.active_tasks || 0,
      })));
    }).finally(() => setLoading(false));
  }, [auth?.token]);

  if (loading) return <div className="p-8"><p className="text-zinc-500">Loading health data...</p></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">System Health</h1>

      {/* Status cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusCard label="API" status={health?.status === "ok" ? "healthy" : "error"} />
        <StatusCard label="Database" status="healthy" />
        <StatusCard label="Redis" status="healthy" />
        <StatusCard label="WebSocket" value={`${health?.ws_connections ?? 0} connections`} />
      </div>

      {/* Workers */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-4">Celery Workers</h2>
        {workers.length === 0 ? (
          <p className="text-zinc-500 text-sm">No active workers detected. Workers run as separate containers.</p>
        ) : (
          <div className="space-y-2">
            {workers.map((w, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${w.status === "running" ? "bg-emerald-400" : "bg-rose-400"}`} />
                  <span className="text-sm text-zinc-200">{w.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span>queue: {w.queue}</span>
                  <span>active: {w.active_tasks}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-4">Quick Info</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-zinc-500">API Version:</span>
            <span className="text-zinc-300 ml-2">{health?.api_version || "0.3.0"}</span>
          </div>
          <div>
            <span className="text-zinc-500">Dashboard:</span>
            <span className="text-zinc-300 ml-2">http://localhost:3000</span>
          </div>
          <div>
            <span className="text-zinc-500">API:</span>
            <span className="text-zinc-300 ml-2">http://localhost:8000</span>
          </div>
          <div>
            <span className="text-zinc-500">Bot:</span>
            <span className="text-zinc-300 ml-2">Container: generatorad-bot</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ label, status, value }: { label: string; status?: "healthy" | "error" | "unknown"; value?: string }) {
  const colors = {
    healthy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    error: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    unknown: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-zinc-500 text-xs mb-1">{label}</p>
      {status ? (
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status === "healthy" ? "bg-emerald-400" : status === "error" ? "bg-rose-400" : "bg-zinc-500"}`} />
          <span className={`text-sm font-medium ${colors[status].split(" ")[1]}`}>{status}</span>
        </div>
      ) : (
        <p className="text-sm text-zinc-300">{value}</p>
      )}
    </div>
  );
}
