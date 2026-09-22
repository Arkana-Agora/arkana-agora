"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface DailyLimitBannerProps {
  limit: number
  remaining: number
  tier: string
  onUpgrade?: () => void
}

export function DailyLimitBanner({
  limit,
  remaining,
  tier,
  onUpgrade,
}: DailyLimitBannerProps) {
  if (remaining > 0) {
    return (
      <Alert variant="default">
        <AlertDescription>
          {remaining} restante{remaining !== 1 ? "s" : ""} hoje
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert variant="destructive">
      <AlertTitle>Limite diário atingido</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>
          Você usou todas as {limit} tiragens de hoje ({tier}).
        </span>
        {onUpgrade && (
          <Button size="sm" onClick={onUpgrade}>
            Upgrade
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
