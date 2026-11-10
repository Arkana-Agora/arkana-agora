"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("scrollarea", className)} {...props}>
        <div className="scrollarea-content">{children}</div>
      </div>
    )
  },
)

ScrollArea.displayName = "ScrollArea"
