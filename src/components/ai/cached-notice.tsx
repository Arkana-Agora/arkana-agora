"use client"

interface CachedInterpretationNoticeProps {
  className?: string
}

export function CachedInterpretationNotice({
  className = "",
}: CachedInterpretationNoticeProps) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground ${className}`}
    >
      <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
      Esta interpretacao foi gerada anteriormente para a mesma combinacao de
      cartas.
    </div>
  )
}
