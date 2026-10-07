import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-linear-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/25 hover:brightness-110 hover:shadow-fuchsia-500/40",
  secondary: "bg-white/[0.06] text-zinc-100 ring-1 ring-inset ring-white/15 hover:bg-white/10 hover:ring-white/25",
  ghost: "text-zinc-300 hover:bg-white/5 hover:text-white",
  danger: "bg-rose-500/10 text-rose-200 ring-1 ring-inset ring-rose-400/30 hover:bg-rose-500/20",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-14 px-7 text-base",
};

interface ButtonStyleProps {
  variant?: Variant;
  size?: Size;
  className?: string;
}

export function buttonClasses({ variant = "primary", size = "md", className }: ButtonStyleProps = {}) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-2xl font-semibold whitespace-nowrap transition duration-150",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80",
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  loading = false,
  disabled,
  children,
  type = "button",
  ...props
}: ComponentProps<"button"> & ButtonStyleProps & { loading?: boolean }) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & ButtonStyleProps) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}
