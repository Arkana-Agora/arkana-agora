"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"

interface HashtagCardProps {
  hashtag: {
    tag: string
    count: number
  }
}

export function HashtagCard({ hashtag }: HashtagCardProps) {
  return (
    <Button
      asChild
      variant="outline"
      className="w-full h-auto py-4 px-4 text-left transition-all hover:bg-primary/5 hover:border-primary/50"
      aria-label={`Ver posts com #${hashtag.tag} (${hashtag.count} posts)`}
    >
      <Link href={`/busca?q=%23${hashtag.tag}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-primary">#</span>
            <span className="font-medium text-lg">{hashtag.tag}</span>
          </div>
          <span className="text-sm text-muted-foreground font-medium">
            {hashtag.count} {hashtag.count === 1 ? "post" : "posts"}
          </span>
        </div>
      </Link>
    </Button>
  )
}
