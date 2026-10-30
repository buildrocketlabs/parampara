import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

// shadcn Button restyled as the ChunkyButton (DESIGN §4): solid fill on a 4 px lip, sinks on press.
// No opacity hovers on clay-cta (it would drop below 4.5:1); hover lifts instead.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-button font-display font-bold whitespace-nowrap transition-[translate,box-shadow] duration-100 outline-none select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-clay-cta focus-visible:outline-solid disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        clay: "bg-clay-cta text-white lip-clay hover:-translate-y-px active:translate-y-1 active:shadow-none disabled:bg-sage disabled:text-ink-3 disabled:shadow-none",
        ink: "bg-ink text-white lip-ink hover:-translate-y-px active:translate-y-1 active:shadow-none disabled:bg-sage disabled:text-ink-3 disabled:shadow-none",
        paper:
          "border border-border bg-paper text-ink lip-paper hover:-translate-y-px active:translate-y-1 active:shadow-none disabled:opacity-60",
        ghost: "text-ink hover:bg-sage active:bg-sage disabled:opacity-50",
        link: "h-auto px-0 text-clay-cta underline-offset-4 hover:underline disabled:opacity-50",
      },
      size: {
        lg: "h-14 px-7 text-lg",
        md: "h-12 px-5 text-base",
        icon: "size-12",
      },
    },
    defaultVariants: {
      variant: "clay",
      size: "lg",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
