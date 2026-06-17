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
      <div className="relative">
        <input
          {...props}
          ref={ref}
          type={isVisible ? "text" : "password"}
          className={cn(
            className,
            "w-full pr-12 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden",
          )}
        />
        <button
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={isVisible}
          onClick={() => setIsVisible((current) => !current)}
          className="absolute inset-y-0 right-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
