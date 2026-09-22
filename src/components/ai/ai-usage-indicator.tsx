"use client"

interface AIUsageIndicatorProps {
  used: number
  total: number
  tier?: string
  onUpgrade?: () => void
}

export function AIUsageIndicator({
  used,
  total,
  tier = "FREE",
  onUpgrade,
}: AIUsageIndicatorProps) {
  const remaining = Math.max(0, total - used)
  const percentage = total > 0 ? (remaining / total) * 100 : 0

  let colorClass = "text-green-600"
  if (percentage <= 25) colorClass = "text-red-600"
  else if (percentage <= 50) colorClass = "text-yellow-600"

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={colorClass}>
        {used}/{total}
      </span>
      <span className="text-muted-foreground">interpretacoes hoje</span>
      {remaining === 0 && tier === "FREE" && onUpgrade && (
        <button
          onClick={onUpgrade}
          className="text-xs font-medium text-primary hover:underline"
        >
          Upgrade
        </button>
      )}
    </div>
  )
}
