import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/utils/tailwind";
import React from "react";

interface AuthProviderButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  loading?: boolean;
  showLastUsedBadge?: boolean;
}

export function AuthProviderButton({
  icon,
  label,
  onClick,
  loading = false,
  showLastUsedBadge = false,
}: AuthProviderButtonProps) {
  return (
    // grows to fill the row, so a single provider reads as the primary action
    <div className="min-w-40 flex-1">
      <Button
        onClick={onClick}
        variant="secondary"
        size="lg"
        loading={loading}
        className="w-full rounded-full transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
      >
        {icon}
        {label}
      </Button>
      <div
        className={cn(
          "text-muted-foreground mt-0.5 text-center text-xs",
          showLastUsedBadge ? "visible" : "invisible",
        )}
      >
        Last used
      </div>
    </div>
  );
}
