"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SeparatorProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: "horizontal" | "vertical"
  decorative?: boolean
  className?: string
}

export const Separator = React.forwardRef<HTMLHRElement, SeparatorProps>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref,
  ) => {
    return (
      <hr
        ref={ref}
        className={cn(
          "shrink-0 bg-border",
          orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
          className,
        )}
        aria-orientation={orientation}
        aria-hidden={decorative}
        {...props}
      />
    )
  },
)

Separator.displayName = "Separator"
