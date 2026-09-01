"use client";

interface AnimatedToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export function AnimatedToggle({ enabled, onChange, label, description, disabled }: AnimatedToggleProps) {
  return (
    <div className="flex items-center justify-between">
      {(label || description) && (
        <div>
          {label && <p className="text-sm font-medium text-zinc-200">{label}</p>}
          {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
        </div>
      )}
      <button
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
          enabled ? "bg-emerald-500" : "bg-zinc-700"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        role="switch"
        aria-checked={enabled}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-300 ease-in-out ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
