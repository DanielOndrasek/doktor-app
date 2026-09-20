import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Kompaktní pill-checkbox, jednotný napříč formuláři nemovitosti
 * (Příslušenství, Vybavení, Infrastruktura a sítě atd.). Šetří místo proti
 * klasickému Switch/Checkbox + Label rozložení a vrací jasnou barevnou indikaci
 * stavu.
 */
export interface ToggleChipProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  size?: "sm" | "md";
}

export const ToggleChip = React.forwardRef<HTMLButtonElement, ToggleChipProps>(
  ({ checked, onCheckedChange, size = "sm", className, children, disabled, type, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        role="checkbox"
        aria-checked={checked}
        data-state={checked ? "checked" : "unchecked"}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-full border font-medium transition-colors select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          size === "sm" ? "h-7 px-3 text-xs" : "h-8 px-3.5 text-sm",
          checked
            ? "border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:bg-accent/50 hover:text-foreground",
          "disabled:opacity-50 disabled:pointer-events-none",
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
ToggleChip.displayName = "ToggleChip";

/**
 * Skupina chipů pro multi-select (např. Topení = více možností). Položky se
 * automaticky zalamují (`flex flex-wrap`), takže zaberou jen tolik místa,
 * kolik potřebují.
 */
export interface ToggleChipGroupOption {
  value: string;
  label: string;
}

export interface ToggleChipGroupProps {
  options: ToggleChipGroupOption[];
  value: string[];
  onChange: (value: string[]) => void;
  size?: "sm" | "md";
  className?: string;
}

export function ToggleChipGroup({ options, value, onChange, size = "sm", className }: ToggleChipGroupProps) {
  const toggle = (optionValue: string) => {
    onChange(
      value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue],
    );
  };
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((opt) => (
        <ToggleChip
          key={opt.value}
          size={size}
          checked={value.includes(opt.value)}
          onCheckedChange={() => toggle(opt.value)}
        >
          {opt.label}
        </ToggleChip>
      ))}
    </div>
  );
}
