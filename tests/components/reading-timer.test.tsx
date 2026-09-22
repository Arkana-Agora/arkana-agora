// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, act, cleanup } from "@testing-library/react"

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }))

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe("ReadingTimer", () => {
  async function importComponent() {
    return await import("@/components/tarot/reading-timer")
  }

  it("starts at 00:00", async () => {
    const { ReadingTimer } = await importComponent()
    render(<ReadingTimer paused={false} />)
    expect(screen.getByText("00:00")).toBeDefined()
  })

  it("increments every second", async () => {
    const { ReadingTimer } = await importComponent()
    render(<ReadingTimer paused={false} />)
    act(() => vi.advanceTimersByTime(3000))
    expect(screen.getByText("00:03")).toBeDefined()
  })

  it("pauses when paused prop is true", async () => {
    const { ReadingTimer } = await importComponent()
    render(<ReadingTimer paused={true} />)
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.getByText("00:00")).toBeDefined()
  })

  it("resumes after unpause", async () => {
    const { ReadingTimer } = await importComponent()
    const { rerender } = render(<ReadingTimer paused={true} />)
    act(() => vi.advanceTimersByTime(3000))
    rerender(<ReadingTimer paused={false} />)
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.getByText("00:02")).toBeDefined()
  })

  it("formats minutes and seconds correctly", async () => {
    const { ReadingTimer } = await importComponent()
    render(<ReadingTimer paused={false} />)
    act(() => vi.advanceTimersByTime(125_000))
    expect(screen.getByText("02:05")).toBeDefined()
  })

  it("calls onElapsed when provided", async () => {
    const onElapsed = vi.fn()
    const { ReadingTimer } = await importComponent()
    render(<ReadingTimer paused={false} onElapsed={onElapsed} />)
    act(() => vi.advanceTimersByTime(1000))
    expect(onElapsed).toHaveBeenCalledWith(1)
    act(() => vi.advanceTimersByTime(1000))
    expect(onElapsed).toHaveBeenCalledWith(2)
  })
})
