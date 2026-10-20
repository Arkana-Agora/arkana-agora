// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSequentialReveal } from "@/hooks/use-sequential-reveal"

describe("useSequentialReveal (BR-TIR-003)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("revela uma carta por vez, na ordem, a cada intervalo", () => {
    const onReveal = vi.fn()
    renderHook(() =>
      useSequentialReveal({
        count: 3,
        enabled: true,
        intervalMs: 1500,
        onReveal,
      }),
    )

    expect(onReveal).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(onReveal).toHaveBeenCalledTimes(1)
    expect(onReveal).toHaveBeenLastCalledWith(0)

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(onReveal).toHaveBeenCalledTimes(2)
    expect(onReveal).toHaveBeenLastCalledWith(1)

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(onReveal).toHaveBeenCalledTimes(3)
    expect(onReveal).toHaveBeenLastCalledWith(2)
  })

  it("nao revela nada quando desabilitado", () => {
    const onReveal = vi.fn()
    renderHook(() =>
      useSequentialReveal({
        count: 3,
        enabled: false,
        intervalMs: 1500,
        onReveal,
      }),
    )

    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(onReveal).not.toHaveBeenCalled()
  })

  it("cancela os timers no unmount", () => {
    const onReveal = vi.fn()
    const { unmount } = renderHook(() =>
      useSequentialReveal({
        count: 3,
        enabled: true,
        intervalMs: 1500,
        onReveal,
      }),
    )

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(onReveal).toHaveBeenCalledTimes(1)

    unmount()

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(onReveal).toHaveBeenCalledTimes(1)
  })

  it("pula indices ja revelados (isRevealed) ao agendar", () => {
    const onReveal = vi.fn()
    renderHook(() =>
      useSequentialReveal({
        count: 3,
        enabled: true,
        intervalMs: 1500,
        onReveal,
        isRevealed: (index) => index === 0,
      }),
    )

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(onReveal).toHaveBeenCalledTimes(1)
    expect(onReveal).toHaveBeenLastCalledWith(1)

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(onReveal).toHaveBeenCalledTimes(2)
    expect(onReveal).toHaveBeenLastCalledWith(2)
  })

  it("re-arma a sequencia ao (re)habilitar", () => {
    const onReveal = vi.fn()
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useSequentialReveal({
          count: 3,
          enabled,
          intervalMs: 1500,
          onReveal,
        }),
      { initialProps: { enabled: false } },
    )

    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(onReveal).not.toHaveBeenCalled()

    rerender({ enabled: true })

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(onReveal).toHaveBeenCalledTimes(1)
    expect(onReveal).toHaveBeenLastCalledWith(0)
  })
})
