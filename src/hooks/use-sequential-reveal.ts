"use client"

import { useEffect, useRef } from "react"

interface UseSequentialRevealOptions {
  count: number
  enabled: boolean
  intervalMs: number
  onReveal: (index: number) => void
  // BR-TIR-003: cartas ja reveladas (ex.: usuario clicou antes, ou re-montagem
  // com progresso persistido) nao reiniciam a sequencia. O agendamento pula os
  // indices ja revelados e conta apenas os pendentes a partir do 1º intervalo.
  isRevealed?: ((index: number) => boolean) | undefined
}

// BR-TIR-003: as cartas sao reveladas uma a uma, na ordem do espalhamento,
// respeitando um intervalo fixo por carta. O usuario pode adiantar clicando
// numa carta (a sequencia continua para as demais). `index` e' zero-based na
// ordem das cartas sorteadas; o callback recebe o indice apos
// `(pendente + 1) * intervalMs` (sem timer de 0ms).
export function useSequentialReveal({
  count,
  enabled,
  intervalMs,
  onReveal,
  isRevealed,
}: UseSequentialRevealOptions): void {
  const onRevealRef = useRef(onReveal)
  const isRevealedRef = useRef(isRevealed)
  useEffect(() => {
    onRevealRef.current = onReveal
  }, [onReveal])
  useEffect(() => {
    isRevealedRef.current = isRevealed
  }, [isRevealed])

  useEffect(() => {
    if (!enabled || count <= 0) return

    const timers: Array<ReturnType<typeof setTimeout>> = []
    let slot = 0
    for (let index = 0; index < count; index += 1) {
      if (isRevealedRef.current?.(index)) continue
      slot += 1
      timers.push(
        setTimeout(() => {
          onRevealRef.current(index)
        }, slot * intervalMs),
      )
    }

    return () => {
      for (const timer of timers) clearTimeout(timer)
    }
  }, [enabled, count, intervalMs])
}
