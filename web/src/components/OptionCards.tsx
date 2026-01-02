"use client";

/**
 * OptionCards - Touch-friendly cards for voice mode options
 * Displays options returned by Claude with large, accessible tap targets
 */

import { VoiceOption } from "@/types/voice";

export interface OptionCardsProps {
  options: VoiceOption[];
  onSelect: (optionId: string) => void;
  disabled?: boolean;
}

export function OptionCards({ options, onSelect, disabled = false }: OptionCardsProps) {
  if (options.length === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-3 p-4">
      <p className="text-sm text-text-secondary mb-3">Choose an option:</p>
      <div className="grid gap-3">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => onSelect(option.id)}
            disabled={disabled}
            className="w-full min-h-[48px] px-4 py-3 text-left rounded-xl
                     bg-bg-secondary border border-border
                     text-text-primary font-medium
                     hover:bg-border hover:border-accent
                     active:scale-[0.98] active:bg-accent/10
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-bg-secondary
                     transition-all duration-150 ease-out
                     focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg-primary"
            aria-label={`Select option: ${option.label}`}
          >
            <span className="block text-base leading-snug">{option.label}</span>
            {option.action && option.action !== option.label && (
              <span className="block text-sm text-text-secondary mt-1">
                {option.action}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default OptionCards;
