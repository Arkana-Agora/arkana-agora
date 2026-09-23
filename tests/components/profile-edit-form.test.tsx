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
const updateProfileMock = vi.hoisted(() => ({
  mutateAsync: vi.fn().mockResolvedValue({ message: "ok" }),
  isPending: false,
}))

vi.mock("@/hooks/use-profile", () => ({
  useMyProfile: () => myProfileMock,
  useUpdateProfile: () => updateProfileMock,
}))

import { ProfileEditForm } from "@/components/profile/profile-edit-form"

function loadedProfile() {
  return {
    id: "u1",
    name: "Maria",
    username: "maria_silva",
    bio: null,
    avatarUrl: null,
    plan: "FREE",
    email: "maria@test.com",
    displayName: "Maria S.",
    birthDate: null,
    birthPlace: null,
    location: null,
    website: null,
  }
}

describe("ProfileEditForm", () => {
  beforeEach(() => {
    cleanup()
    myProfileMock.data = undefined
    myProfileMock.isLoading = false
    updateProfileMock.mutateAsync.mockClear()
    updateProfileMock.isPending = false
  })

  it("renders form fields", () => {
    render(<ProfileEditForm />)
    expect(screen.getByLabelText("Nome de exibição")).toBeInTheDocument()
    expect(screen.getByLabelText("Username")).toBeInTheDocument()
    expect(screen.getByLabelText("Bio")).toBeInTheDocument()
    expect(screen.getByLabelText("Data de nascimento")).toBeInTheDocument()
    expect(screen.getByLabelText("Local de nascimento")).toBeInTheDocument()
    expect(screen.getByLabelText("Localização")).toBeInTheDocument()
    expect(screen.getByLabelText("Website")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument()
  })

  it("shows loading skeleton while fetching profile", () => {
    myProfileMock.isLoading = true
    const { container } = render(<ProfileEditForm />)
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    )
  })

  it("resets form with profile values when loaded", async () => {
    myProfileMock.data = loadedProfile()
    render(<ProfileEditForm />)

    await waitFor(() => {
      const displayName = screen.getByLabelText(
        "Nome de exibição",
      ) as HTMLInputElement
      expect(displayName.value).toBe("Maria S.")
    })
    const username = screen.getByLabelText("Username") as HTMLInputElement
    expect(username.value).toBe("maria_silva")
  })

  it("disables save when form is not dirty", async () => {
    myProfileMock.data = loadedProfile()
    render(<ProfileEditForm />)

    await waitFor(() => {
      const btn = screen.getByRole("button", {
        name: "Salvar",
      }) as HTMLButtonElement
      expect(btn.disabled).toBe(true)
    })
  })

  it("submits dirty form and calls updateProfile", async () => {
    myProfileMock.data = loadedProfile()
    render(<ProfileEditForm />)

    await waitFor(() => {
      expect(
        (screen.getByLabelText("Nome de exibição") as HTMLInputElement).value,
      ).toBe("Maria S.")
    })

    const displayName = screen.getByLabelText("Nome de exibição")
    fireEvent.change(displayName, { target: { value: "Maria Souza" } })

    const btn = screen.getByRole("button", { name: "Salvar" })
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)

    await waitFor(() => {
      expect(updateProfileMock.mutateAsync).toHaveBeenCalledOnce()
    })
    expect(updateProfileMock.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Maria Souza" }),
    )
  })

  it("shows validation error for invalid website and does not submit", async () => {
    myProfileMock.data = loadedProfile()
    render(<ProfileEditForm />)

    await waitFor(() => {
      expect(
        (screen.getByLabelText("Nome de exibição") as HTMLInputElement).value,
      ).toBe("Maria S.")
    })

    const website = screen.getByLabelText("Website")
    fireEvent.change(website, { target: { value: "not-a-url" } })

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))

    await waitFor(() => {
      expect(screen.getByText("URL invalida")).toBeInTheDocument()
    })
    expect(updateProfileMock.mutateAsync).not.toHaveBeenCalled()
  })
})
