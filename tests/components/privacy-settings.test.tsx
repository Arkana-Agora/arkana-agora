import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react"

const myProfileMock = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
}))
const updatePrivacyMock = vi.hoisted(() => ({
  mutateAsync: vi.fn().mockResolvedValue({ message: "ok" }),
  isPending: false,
}))

vi.mock("@/hooks/use-profile", () => ({
  useMyProfile: () => myProfileMock,
  useUpdatePrivacy: () => updatePrivacyMock,
}))

import { PrivacySettings } from "@/components/profile/privacy-settings"

function getSelect(label: string): HTMLSelectElement {
  const el = screen
    .getByText(label)
    .parentElement?.querySelector("select") as HTMLSelectElement
  expect(el).toBeTruthy()
  return el
}

describe("PrivacySettings", () => {
  beforeEach(() => {
    cleanup()
    myProfileMock.data = undefined
    myProfileMock.isLoading = false
    updatePrivacyMock.mutateAsync.mockClear()
    updatePrivacyMock.isPending = false
  })

  it("renders privacy select fields", () => {
    render(<PrivacySettings />)
    expect(screen.getByText("Visibilidade do perfil")).toBeInTheDocument()
    expect(screen.getByText("Quem pode me seguir")).toBeInTheDocument()
    expect(screen.getByText("Quem pode comentar")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Salvar privacidade" }),
    ).toBeInTheDocument()
  })

  it("shows loading skeleton while fetching", () => {
    myProfileMock.isLoading = true
    const { container } = render(<PrivacySettings />)
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    )
  })

  it("loads profile privacy defaults when data arrives", async () => {
    myProfileMock.data = {
      id: "u1",
      name: "Maria",
      username: "maria_silva",
      bio: null,
      avatarUrl: null,
      plan: "FREE",
      email: "maria@test.com",
      displayName: "Maria",
      privacy: {
        profileVisibility: "private",
        whoCanFollow: "following",
        whoCanComment: "nobody",
      },
    }
    render(<PrivacySettings />)

    await waitFor(() => {
      expect(getSelect("Visibilidade do perfil").value).toBe("private")
    })
    expect(getSelect("Quem pode me seguir").value).toBe("following")
    expect(getSelect("Quem pode comentar").value).toBe("nobody")
  })

  it("saves changed settings", async () => {
    render(<PrivacySettings />)

    fireEvent.change(getSelect("Visibilidade do perfil"), {
      target: { value: "private" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Salvar privacidade" }))

    await waitFor(() => {
      expect(updatePrivacyMock.mutateAsync).toHaveBeenCalledOnce()
    })
    expect(updatePrivacyMock.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ profileVisibility: "private" }),
    )
  })
})
