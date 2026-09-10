"use client";

import { useEffect, useRef, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";

/* ── Glassmorphism color palette ──────────────────────────────────── */
const GLASS = {
  emerald: { main: "#10b981", light: "rgba(16,185,129,0.35)", glow: "rgba(16,185,129,0.15)", depth: "rgba(16,185,129,0.12)" },
  rose:    { main: "#f43f5e", light: "rgba(244,63,94,0.35)",  glow: "rgba(244,63,94,0.15)",  depth: "rgba(244,63,94,0.12)" },
  sky:     { main: "#0ea5e9", light: "rgba(14,165,233,0.35)",  glow: "rgba(14,165,233,0.15)",  depth: "rgba(14,165,233,0.12)" },
  amber:   { main: "#f59e0b", light: "rgba(245,158,11,0.35)", glow: "rgba(245,158,11,0.15)", glow2: "rgba(245,158,11,0.12)" },
  slate:   { main: "#94a3b8", light: "rgba(148,163,184,0.25)", glow: "rgba(148,163,184,0.10)", depth: "rgba(148,163,184,0.08)" },
  violet:  { main: "#8b5cf6", light: "rgba(139,92,246,0.35)", glow: "rgba(139,92,246,0.15)", depth: "rgba(139,92,246,0.12)" },
};

/* ── Animated wrapper ─────────────────────────────────────────────── */
function GlassContainer({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref}
      className={`bg-zinc-900/80 border border-zinc-800/60 rounded-2xl p-6 backdrop-blur-sm transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"} ${className}`}
      style={{ perspective: "800px" }}>
      {children}
    </div>
  );
}

/* ── Glass tooltip ────────────────────────────────────────────────── */
function GlassTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="backdrop-blur-xl bg-zinc-900/90 border border-zinc-700/50 rounded-xl px-4 py-3 shadow-2xl"
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
      <p className="text-xs text-zinc-400 mb-1.5 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
          <span className="text-zinc-300">{p.name}:</span>
          <span className="font-semibold text-zinc-100">{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

/* ── SVG defs for glass gradients + filters ───────────────────────── */
function GlassDefs() {
  return (
    <defs>
      {/* Gradient fills */}
      <linearGradient id="glass-emerald" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={GLASS.emerald.main} stopOpacity={0.5} />
        <stop offset="100%" stopColor={GLASS.emerald.main} stopOpacity={0.08} />
      </linearGradient>
      <linearGradient id="glass-rose" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={GLASS.rose.main} stopOpacity={0.5} />
        <stop offset="100%" stopColor={GLASS.rose.main} stopOpacity={0.08} />
      </linearGradient>
      <linearGradient id="glass-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={GLASS.sky.main} stopOpacity={0.5} />
        <stop offset="100%" stopColor={GLASS.sky.main} stopOpacity={0.08} />
      </linearGradient>
      <linearGradient id="glass-amber" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={GLASS.amber.main} stopOpacity={0.5} />
        <stop offset="100%" stopColor={GLASS.amber.main} stopOpacity={0.08} />
      </linearGradient>
      <linearGradient id="glass-slate" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={GLASS.slate.main} stopOpacity={0.35} />
        <stop offset="100%" stopColor={GLASS.slate.main} stopOpacity={0.05} />
      </linearGradient>
      <linearGradient id="glass-violet" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={GLASS.violet.main} stopOpacity={0.5} />
        <stop offset="100%" stopColor={GLASS.violet.main} stopOpacity={0.08} />
      </linearGradient>
      {/* Area gradient (horizontal fade) */}
      <linearGradient id="glass-area-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={GLASS.sky.main} stopOpacity={0.4} />
        <stop offset="100%" stopColor={GLASS.sky.main} stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="glass-area-emerald" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={GLASS.emerald.main} stopOpacity={0.4} />
        <stop offset="100%" stopColor={GLASS.emerald.main} stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="glass-area-rose" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={GLASS.rose.main} stopOpacity={0.3} />
        <stop offset="100%" stopColor={GLASS.rose.main} stopOpacity={0.02} />
      </linearGradient>
      {/* Glow filter */}
      <filter id="glass-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glass-glow-strong" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

/* ── Custom 3D Bar shape ──────────────────────────────────────────── */
function GlassBar3D(props: any) {
  const { x, y, width, height, fill, index } = props;
  if (!height || height <= 0) return null;
  const depth = 6;
  const sidePath = `M${x + width},${y} L${x + width + depth},${y - depth} L${x + width + depth},${y - depth + height} L${x + width},${y + height} Z`;
  const topPath = `M${x},${y} L${x + depth},${y - depth} L${x + width + depth},${y - depth} L${x + width},${y} Z`;

  return (
    <g className="glass-bar-group" style={{ transition: "transform 0.3s ease" }}>
      {/* Shadow */}
      <rect x={x + 2} y={y + 2} width={width} height={height} rx={4} fill="rgba(0,0,0,0.2)" style={{ filter: "blur(4px)" }} />
      {/* Side face */}
      <path d={sidePath} fill={fill} opacity={0.3} />
      {/* Top face */}
      <path d={topPath} fill={fill} opacity={0.45} />
      {/* Front face with gradient */}
      <rect x={x} y={y} width={width} height={height} rx={4} fill={fill} opacity={0.85} />
      {/* Glass highlight */}
      <rect x={x + 2} y={y + 2} width={width - 4} height={Math.min(height * 0.4, 20)} rx={3} fill="rgba(255,255,255,0.08)" />
    </g>
  );
}

/* ── Custom 3D horizontal Bar shape ───────────────────────────────── */
function GlassBar3DHorizontal(props: any) {
  const { x, y, width, height, fill } = props;
  if (!width || width <= 0) return null;
  const depth = 5;
  const topPath = `M${x},${y} L${x + depth},${y - depth} L${x + width + depth},${y - depth} L${x + width},${y} Z`;
  const sidePath = `M${x + width},${y} L${x + width + depth},${y - depth} L${x + width + depth},${y - depth + height} L${x + width},${y + height} Z`;

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4} fill={fill} opacity={0.85} />
      <path d={topPath} fill={fill} opacity={0.35} />
      <path d={sidePath} fill={fill} opacity={0.25} />
      <rect x={x + 2} y={y + 2} width={Math.min(width * 0.4, 16)} height={height - 4} rx={3} fill="rgba(255,255,255,0.06)" />
    </g>
  );
}

/* ── Custom 3D Pie slice ──────────────────────────────────────────── */
function GlassPie3D(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, index } = props;
  const RADIAN = Math.PI / 180;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const extrude = 8;

  // Main slice
  const mainPath = describeArc(cx, cy, outerRadius, startAngle, endAngle);
  const innerPath = innerRadius > 0 ? describeArc(cx, cy, innerRadius, startAngle, endAngle) : "";

  // 3D extrude path (bottom face)
  const extrudePath = describeArc(cx, cy + extrude, outerRadius, startAngle, endAngle);

  return (
    <g>
      {/* Extrude shadow */}
      <path d={extrudePath} fill={fill} opacity={0.15} />
      {/* Main slice */}
      <path d={mainPath} fill={fill} opacity={0.85} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
      {/* Glass highlight */}
      <path d={describeArc(cx, cy, outerRadius * 0.85, startAngle, Math.min(startAngle + (endAngle - startAngle) * 0.4, endAngle))}
        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} strokeLinecap="round" />
    </g>
  );
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const RADIAN = Math.PI / 180;
  const start = { x: cx + r * Math.cos(-RADIAN * startAngle), y: cy + r * Math.sin(-RADIAN * startAngle) };
  const end = { x: cx + r * Math.cos(-RADIAN * endAngle), y: cy + r * Math.sin(-RADIAN * endAngle) };
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

/* ════════════════════════════════════════════════════════════════════
   EXPORTED CHART COMPONENTS
   ════════════════════════════════════════════════════════════════════ */

/* ── Glass Area Chart ─────────────────────────────────────────────── */
export function GlassAreaChart({ data, series, height = 260 }: {
  data: any[];
  series: { key: string; name: string; color: string; dashed?: boolean }[];
  height?: number;
}) {
  return (
    <GlassContainer>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
          <GlassDefs />
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(v: string) => v?.slice(5)} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<GlassTooltip />} />
          <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12, color: "#a1a1aa" }} />
          {series.map((s) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.name}
              stroke={s.color} fill={`url(#glass-area-${s.key === "leads" ? "sky" : s.key === "hot_leads" ? "rose" : "emerald"})`}
              strokeWidth={2.5} strokeDasharray={s.dashed ? "6 4" : undefined}
              dot={false} activeDot={{ r: 5, stroke: s.color, strokeWidth: 2, fill: "#18181b" }}
              animationDuration={1200} animationEasing="ease-out" />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </GlassContainer>
  );
}

/* ── Glass Bar Chart (vertical, 3D) ──────────────────────────────── */
export function GlassBarChart({ data, bars, height = 260, horizontal = false }: {
  data: any[];
  bars: { key: string; name: string; color: string; gradient?: string }[];
  height?: number;
  horizontal?: boolean;
}) {
  const BarShape = horizontal ? GlassBar3DHorizontal : GlassBar3D;
  return (
    <GlassContainer>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 5, right: 5, left: horizontal ? 10 : -10, bottom: 0 }}>
          <GlassDefs />
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={!horizontal} vertical={horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
            </>
          )}
          <Tooltip content={<GlassTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          {bars.length > 1 && <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12, color: "#a1a1aa" }} />}
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.gradient || `url(#glass-${b.color})`}
              shape={<BarShape />}
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              animationDuration={1000} animationEasing="ease-out" />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </GlassContainer>
  );
}

/* ── Glass Pie Chart (3D extrude) ─────────────────────────────────── */
export function GlassPieChart({ data, height = 260 }: {
  data: { name: string; value: number; color: string }[];
  height?: number;
}) {
  return (
    <GlassContainer>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <GlassDefs />
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
            outerRadius={85} innerRadius={40}
            activeShape={(props: any) => <GlassPie3D {...props} />}
            animationDuration={1200} animationEasing="ease-out"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<GlassTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </GlassContainer>
  );
}

/* ── Export for campaigns page ────────────────────────────────────── */
export function GlassBarStatic({ data, height = 64 }: {
  data: { date: string; count: number }[];
  height?: number;
}) {
  const maxCount = Math.max(...data.map((x) => x.count), 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d) => {
        const h = Math.max(4, (d.count / maxCount) * 100);
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
            <span className="text-[10px] text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">{d.count}</span>
            <div className="w-full rounded-md transition-all duration-500 ease-out group-hover:scale-y-105 origin-bottom"
              style={{
                height: `${h}%`,
                background: `linear-gradient(180deg, rgba(16,185,129,0.55) 0%, rgba(16,185,129,0.12) 100%)`,
                boxShadow: "0 2px 8px rgba(16,185,129,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
              }} />
            <span className="text-[10px] text-zinc-600">{d.date.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}
