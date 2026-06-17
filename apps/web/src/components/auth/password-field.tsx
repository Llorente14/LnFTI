"use client";

import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { forwardRef, useState, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  visibilityLabel?: string;
};

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField({ className, visibilityLabel = "password", ...props }, ref) {
    const [isVisible, setIsVisible] = useState(false);
    const label = `${isVisible ? "Sembunyikan" : "Tampilkan"} ${visibilityLabel}`;

    return (
      <div className="flex items-stretch gap-2">
        <input
          {...props}
          ref={ref}
          type={isVisible ? "text" : "password"}
          className={cn(
            className,
            "min-w-0 flex-1 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden",
          )}
        />
        <button
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={isVisible}
          aria-controls={props.id}
          onClick={() => setIsVisible((current) => !current)}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border bg-surface text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {isVisible ? (
            <IconEyeOff size={20} stroke={1.8} aria-hidden="true" />
          ) : (
            <IconEye size={20} stroke={1.8} aria-hidden="true" />
          )}
        </button>
      </div>
    );
  },
);
