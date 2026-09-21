import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ProfileHeader } from "@/components/profile/profile-header"
import { ProfileStats } from "@/components/profile/profile-stats"
import { ProfileAstrology } from "@/components/profile/profile-astrology"

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }))

const mockProfile = {
  id: "u1",
  name: "Maria Silva",
  username: "maria_silva",
  bio: "Apaixonada por tarot",
  avatarUrl: null,
  plan: "FREE",
  location: "São Paulo",
}

describe("ProfileHeader", () => {
  it("renders name and username", () => {
    render(<ProfileHeader profile={mockProfile} />)
    expect(
      screen.getByRole("heading", { name: "Maria Silva" }),
    ).toBeInTheDocument()
    expect(screen.getByText("@maria_silva")).toBeInTheDocument()
  })

  it("renders bio when present", () => {
    render(<ProfileHeader profile={mockProfile} />)
    const bios = screen.getAllByText("Apaixonada por tarot")
    expect(bios.length).toBeGreaterThanOrEqual(1)
  })

  it("shows edit button when isOwn and onEdit provided", () => {
    const onEdit = vi.fn()
    render(<ProfileHeader profile={mockProfile} isOwn onEdit={onEdit} />)
    const btn = screen.getByRole("button", { name: "Editar perfil" })
    expect(btn).toBeInTheDocument()
    btn.click()
    expect(onEdit).toHaveBeenCalledOnce()
  })

  it("hides edit button when not own profile", () => {
    const { container } = render(<ProfileHeader profile={mockProfile} />)
    const buttons = container.querySelectorAll("button")
    const editButtons = Array.from(buttons).filter((b) =>
      b.textContent?.includes("Editar perfil"),
    )
    expect(editButtons).toHaveLength(0)
  })
})

describe("ProfileStats", () => {
  it("renders three stat columns", () => {
    render(
      <ProfileStats readingsCount={10} followersCount={5} followingCount={3} />,
    )
    expect(screen.getByText("10")).toBeInTheDocument()
    expect(screen.getByText("5")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("Tiragens")).toBeInTheDocument()
    expect(screen.getByText("Seguidores")).toBeInTheDocument()
    expect(screen.getByText("Seguindo")).toBeInTheDocument()
  })

  it("formats large numbers with locale", () => {
    render(<ProfileStats readingsCount={1234} />)
    expect(screen.getByText("1.234")).toBeInTheDocument()
  })

  it("defaults to zero", () => {
    const { container } = render(<ProfileStats />)
    expect(container.textContent).toContain("Tiragens")
    expect(container.textContent).toContain("Seguidores")
    expect(container.textContent).toContain("Seguindo")
  })
})

describe("ProfileAstrology", () => {
  it("renders nothing when no data", () => {
    const { container } = render(<ProfileAstrology />)
    expect(container.firstChild).toBeNull()
  })

  it("renders sun sign", () => {
    render(<ProfileAstrology sunSign="Áries" />)
    expect(screen.getByText("Áries")).toBeInTheDocument()
    expect(screen.getByText("Signo solar")).toBeInTheDocument()
  })

  it("renders personal arcana with name", () => {
    render(<ProfileAstrology personalArcana={5} />)
    expect(screen.getByText("5 — O Hierofante")).toBeInTheDocument()
  })

  it("renders kin maya", () => {
    render(<ProfileAstrology kinMaya="123" />)
    expect(screen.getByText("123")).toBeInTheDocument()
  })

  it("renders all three together", () => {
    render(
      <ProfileAstrology sunSign="Gêmeos" personalArcana={17} kinMaya="45" />,
    )
    expect(screen.getByText("Gêmeos")).toBeInTheDocument()
    expect(screen.getByText("17 — A Estrela")).toBeInTheDocument()
    expect(screen.getByText("45")).toBeInTheDocument()
  })
})
