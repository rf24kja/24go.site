/**
 * Custom SVG icon library for 24GO leadgen platform.
 * Ponytail: inline SVGs, no external deps, 20x20 default, stroke-based.
 */
import React from "react";

export type IconProps = {
  className?: string;
  size?: number;
};

const S = ({ className = "w-5 h-5", size, ...props }: IconProps & React.SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={size ? `w-[${size}px] h-[${size}px]` : className}
    {...props}
  />
);

// ── Sidebar / nav ────────────────────────────────────────────────

export const ChartBar = (p: IconProps) => (
  <S {...p}>
    <rect x="3" y="12" width="4" height="9" rx="1" />
    <rect x="10" y="7" width="4" height="14" rx="1" />
    <rect x="17" y="3" width="4" height="18" rx="1" />
  </S>
);

export const Crosshair = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="2" x2="12" y2="7" />
    <line x1="12" y1="17" x2="12" y2="22" />
    <line x1="2" y1="12" x2="7" y2="12" />
    <line x1="17" y1="12" x2="22" y2="12" />
    <circle cx="12" cy="12" r="2.5" />
  </S>
);

export const Scales = (p: IconProps) => (
  <S {...p}>
    <line x1="12" y1="3" x2="12" y2="21" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="4" y1="7" x2="12" y2="7" />
    <line x1="12" y1="7" x2="20" y2="7" />
    <path d="M4 7v4a4 4 0 004 4" />
    <path d="M20 7v4a4 4 0 01-4 4" />
    <circle cx="6" cy="15" r="1" fill="currentColor" stroke="none" />
    <circle cx="18" cy="15" r="1" fill="currentColor" stroke="none" />
  </S>
);

export const Radar = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <line x1="12" y1="3" x2="12" y2="12" />
  </S>
);

export const Radio = (p: IconProps) => (
  <S {...p}>
    <path d="M8 18a4 4 0 118 0" />
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    <line x1="12" y1="2" x2="12" y2="10" />
    <line x1="12" y1="22" x2="12" y2="14" />
  </S>
);

export const UserCircle = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
  </S>
);

export const Megaphone = (p: IconProps) => (
  <S {...p}>
    <path d="M5 14l11-4V6a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h0" />
    <path d="M16 10l3.5-1.3a1 1 0 011.3.7V14.6a1 1 0 01-1.3.7L16 14" />
    <path d="M5 14a3 3 0 003 3h1" />
  </S>
);

export const CreditCard = (p: IconProps) => (
  <S {...p}>
    <rect x="2" y="5" width="20" height="14" rx="3" />
    <line x1="2" y1="10" x2="22" y2="10" />
    <line x1="6" y1="15" x2="10" y2="15" />
  </S>
);

export const UsersGroup = (p: IconProps) => (
  <S {...p}>
    <circle cx="9" cy="7" r="3" />
    <circle cx="17" cy="7" r="2.5" />
    <path d="M3 20c0-3 2.5-5.5 6-5.5s6 2.5 6 5.5" />
    <path d="M17 14.5c2.5 0 4.5 1.5 4.5 3.5" />
  </S>
);

export const FileText = (p: IconProps) => (
  <S {...p}>
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <line x1="8" y1="7" x2="16" y2="7" />
    <line x1="8" y1="11" x2="16" y2="11" />
    <line x1="8" y1="15" x2="12" y2="15" />
  </S>
);

export const Heartbeat = (p: IconProps) => (
  <S {...p}>
    <path d="M3 12h4l2-5 3 10 2-5h7" />
  </S>
);

export const Cog = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2m0 18v2m-9.5-13l1.7 1m13.6-1l-1.7 1M4.2 19.8l1.4-1.4m12.8 0l1.4 1.4M1 12h2m18 0h2M4.2 4.2l1.4 1.4m12.8 0l1.4-1.4" />
  </S>
);

export const LogOut = (p: IconProps) => (
  <S {...p}>
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </S>
);

// ── Settings sections ────────────────────────────────────────────

export const BrainCircuit = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="8" r="5" />
    <path d="M10 8h4" />
    <path d="M12 6v4" />
    <path d="M8 13l-2 3" />
    <path d="M16 13l2 3" />
    <path d="M8 16l-2 2m10-2l2 2" />
    <path d="M10 13v3l-1 2" />
    <path d="M14 13v3l1 2" />
  </S>
);

export const Flame = (p: IconProps) => (
  <S {...p}>
    <path d="M12 2c1 4-2 6-2 10a4 4 0 108 0c0-4-3-6-2-10-1 3-3 3-4 0z" />
    <path d="M12 18a2 2 0 002-2c0-2-2-3-2-5-0 2-2 3-2 5a2 2 0 002 2z" />
  </S>
);

export const Send = (p: IconProps) => (
  <S {...p}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </S>
);

export const Bell = (p: IconProps) => (
  <S {...p}>
    <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </S>
);

// ── Landing / feature icons ──────────────────────────────────────

export const Search = (p: IconProps) => (
  <S {...p}>
    <circle cx="11" cy="11" r="7" />
    <line x1="16" y1="16" x2="22" y2="22" />
  </S>
);

export const Bot = (p: IconProps) => (
  <S {...p}>
    <rect x="5" y="10" width="14" height="12" rx="3" />
    <circle cx="9" cy="15" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="15" cy="15" r="1.5" fill="currentColor" stroke="none" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <circle cx="12" cy="2" r="1" fill="currentColor" stroke="none" />
    <line x1="9" y1="22" x2="9" y2="24" />
    <line x1="15" y1="22" x2="15" y2="24" />
  </S>
);

export const Zap = (p: IconProps) => (
  <S {...p}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </S>
);

// ── Onboarding / misc ────────────────────────────────────────────

export const Plane = (p: IconProps) => (
  <S {...p}>
    <path d="M22 2L11 13" />
    <path d="M22 2l-7 20-4-9-9-4 20-7z" />
  </S>
);

export const CheckCircle = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <polyline points="8 12 11 15 16 9" />
  </S>
);

export const Cross = (p: IconProps) => (
  <S {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </S>
);

export const Eye = (p: IconProps) => (
  <S {...p}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </S>
);

export const MessageSquare = (p: IconProps) => (
  <S {...p}>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </S>
);

export const Menu = (p: IconProps) => (
  <S {...p}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </S>
);

export const ChevronUp = (p: IconProps) => (
  <S {...p}>
    <polyline points="18 15 12 9 6 15" />
  </S>
);

export const ChevronDown = (p: IconProps) => (
  <S {...p}>
    <polyline points="6 9 12 15 18 9" />
  </S>
);

export const Pen = (p: IconProps) => (
  <S {...p}>
    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </S>
);

export const HelpCircle = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </S>
);

export const Shield = (p: IconProps) => (
  <S {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </S>
);

export const Database = (p: IconProps) => (
  <S {...p}>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </S>
);

// ── Additional icons ────────────────────────────────────────────

export const Telegram = (p: IconProps) => (
  <S {...p}>
    <path d="M22 2L11 13" />
    <path d="M22 2l-7 20-4-9-9-4 20-7z" />
  </S>
);

export const Vk = (p: IconProps) => (
  <S {...p}>
    <path d="M3 7h4l2 7-3 8" />
    <path d="M21 7c0 0-4 5-6 7" />
    <path d="M15 7c0 0 2 7 0 7" />
  </S>
);

export const Upload = (p: IconProps) => (
  <S {...p}>
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </S>
);

export const Star = (p: IconProps) => (
  <S {...p}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </S>
);

export const ExternalLink = (p: IconProps) => (
  <S {...p}>
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </S>
);

export const X = (p: IconProps) => (
  <S {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </S>
);

export const Building = (p: IconProps) => (
  <S {...p}>
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <line x1="9" y1="22" x2="9" y2="2" />
    <line x1="15" y1="22" x2="15" y2="2" />
    <line x1="4" y1="7" x2="20" y2="7" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="17" x2="20" y2="17" />
  </S>
);

export const Code = (p: IconProps) => (
  <S {...p}>
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </S>
);

export const TrendingUp = (p: IconProps) => (
  <S {...p}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </S>
);
