import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react"

const presignMock = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}))
const confirmMock = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}))
const deleteMock = vi.hoisted(() => ({
  mutateAsync: vi.fn().mockResolvedValue({ message: "ok" }),
  isPending: false,
}))

vi.mock("@/hooks/use-profile", () => ({
  useAvatarPresign: () => presignMock,
  useAvatarConfirm: () => confirmMock,
  useAvatarDelete: () => deleteMock,
}))

import { AvatarUpload } from "@/components/profile/avatar-upload"

function getFileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  expect(input).toBeTruthy()
  return input
}

describe("AvatarUpload", () => {
  beforeEach(() => {
    cleanup()
    presignMock.mutateAsync.mockReset()
    confirmMock.mutateAsync.mockReset()
    deleteMock.mutateAsync.mockClear()
    presignMock.isPending = false
    confirmMock.isPending = false
    deleteMock.isPending = false
  })

  it("renders upload dropzone and initials fallback", () => {
    render(<AvatarUpload userName="Maria Silva" />)
    expect(
      screen.getByText("Arraste ou clique para enviar"),
    ).toBeInTheDocument()
    expect(screen.getByText("MS")).toBeInTheDocument()
  })

  it("does not show delete button when no current avatar", () => {
    render(<AvatarUpload userName="Maria" />)
    expect(
      screen.queryByRole("button", { name: "Remover avatar" }),
    ).not.toBeInTheDocument()
  })

  it("shows delete button when current avatar exists", () => {
    render(
      <AvatarUpload
        currentAvatarUrl="https://r2.test/avatars/u1/1.webp"
        userName="Maria"
      />,
    )
    expect(
      screen.getByRole("button", { name: "Remover avatar" }),
    ).toBeInTheDocument()
  })

  it("rejects unsupported file type", async () => {
    render(<AvatarUpload userName="Maria" />)
    const input = getFileInput()
    const file = new File(["hello"], "doc.pdf", { type: "application/pdf" })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(
        screen.getByText("Formato não suportado. Use JPEG, PNG ou WebP."),
      ).toBeInTheDocument()
    })
    expect(presignMock.mutateAsync).not.toHaveBeenCalled()
  })

  it("rejects file larger than 5MB", async () => {
    render(<AvatarUpload userName="Maria" />)
    const input = getFileInput()
    const bigFile = new File(
      [new ArrayBuffer(5 * 1024 * 1024 + 1)],
      "big.png",
      {
        type: "image/png",
      },
    )

    fireEvent.change(input, { target: { files: [bigFile] } })

    await waitFor(() => {
      expect(
        screen.getByText("Arquivo muito grande. Máximo 5MB."),
      ).toBeInTheDocument()
    })
    expect(presignMock.mutateAsync).not.toHaveBeenCalled()
  })

  it("accepts valid image and runs presign → upload → confirm flow", async () => {
    presignMock.mutateAsync.mockResolvedValue({
      uploadUrl: "https://r2.test/upload",
      key: "avatars/u1/123.png",
    })
    confirmMock.mutateAsync.mockResolvedValue({
      avatarUrl: "https://r2.test/avatars/u1/123-400.webp",
    })
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as never

    render(<AvatarUpload userName="Maria" />)
    const input = getFileInput()
    const file = new File([new Uint8Array([137, 80, 78, 71])], "avatar.png", {
      type: "image/png",
    })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(presignMock.mutateAsync).toHaveBeenCalledWith("image/png")
    })
    await waitFor(() => {
      expect(confirmMock.mutateAsync).toHaveBeenCalledWith("avatars/u1/123.png")
    })
  })

  it("calls delete mutation when remove button clicked", async () => {
    render(
      <AvatarUpload
        currentAvatarUrl="https://r2.test/avatars/u1/1.webp"
        userName="Maria"
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Remover avatar" }))

    await waitFor(() => {
      expect(deleteMock.mutateAsync).toHaveBeenCalledOnce()
    })
  })

  it("shows error when upload fails", async () => {
    presignMock.mutateAsync.mockRejectedValue(new Error("presign failed"))

    render(<AvatarUpload userName="Maria" />)
    const input = getFileInput()
    const file = new File([new Uint8Array([1, 2, 3])], "a.png", {
      type: "image/png",
    })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(
        screen.getByText("Falha no upload. Tente novamente."),
      ).toBeInTheDocument()
    })
  })
})
