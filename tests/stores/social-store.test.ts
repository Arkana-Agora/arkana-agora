import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"

const emitPendingPostMock = vi.hoisted(() => vi.fn())

vi.mock("@/hooks/use-feed", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  return { ...original, emitPendingPost: emitPendingPostMock }
})

type SocialStoreModule = typeof import("@/stores/social-store")

async function importStore() {
  const mod = await import("@/stores/social-store")
  mod.useSocialStore.setState(mod.useSocialStore.getInitialState())
  return mod
}

describe("SocialStore (T087)", () => {
  let mod: SocialStoreModule

  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it("starts with initial state and does NOT hold feedPosts", async () => {
    mod = await importStore()
    const { result } = renderHook(() => mod.useSocialStore())

    expect(result.current.postLikes).toEqual({})
    expect(result.current.commentLikes).toEqual({})
    expect(result.current.postComments).toEqual({})
    expect("feedPosts" in result.current).toBe(false)
    expect("unreadCount" in result.current).toBe(false)
    expect("notifications" in result.current).toBe(false)
  })

  it("updatePostLike grava overlay otimista por postId", async () => {
    mod = await importStore()
    const { result } = renderHook(() => mod.useSocialStore())

    act(() => result.current.updatePostLike("post_1", true, 6))
    expect(result.current.postLikes["post_1"]).toEqual({
      liked: true,
      likeCount: 6,
    })

    act(() => result.current.updatePostLike("post_2", true, 1))
    expect(result.current.postLikes["post_2"]).toEqual({
      liked: true,
      likeCount: 1,
    })

    act(() => result.current.updatePostLike("post_1", false, 5))
    expect(result.current.postLikes["post_1"]).toEqual({
      liked: false,
      likeCount: 5,
    })
  })

  it("updateCommentLike grava overlay otimista por commentId", async () => {
    mod = await importStore()
    const { result } = renderHook(() => mod.useSocialStore())

    act(() => result.current.updateCommentLike("cmt_1", true, 3))
    expect(result.current.commentLikes["cmt_1"]).toEqual({
      liked: true,
      likeCount: 3,
    })

    act(() => result.current.updateCommentLike("cmt_2", false, 0))
    expect(result.current.commentLikes["cmt_2"]).toEqual({
      liked: false,
      likeCount: 0,
    })
  })

  it("addCommentToPost anota comentário novo com dedup por id", async () => {
    mod = await importStore()
    const { result } = renderHook(() => mod.useSocialStore())

    const comment = {
      id: "cmt_1",
      postId: "post_1",
      content: "ola",
      likeCount: 0,
      parentCommentId: null,
      createdAt: "2026-10-05T10:00:00Z",
      author: {
        id: "usr_2",
        name: "Comentarista",
        displayName: null,
        avatar: null,
      },
    }

    act(() => result.current.addCommentToPost("post_1", comment))
    expect(result.current.postComments["post_1"]).toHaveLength(1)

    act(() => result.current.addCommentToPost("post_1", comment))
    expect(result.current.postComments["post_1"]).toHaveLength(1)

    act(() =>
      result.current.addCommentToPost("post_1", {
        ...comment,
        id: "cmt_2",
        parentCommentId: "cmt_1",
      }),
    )
    expect(result.current.postComments["post_1"]).toHaveLength(2)

    act(() =>
      result.current.addCommentToPost("post_2", { ...comment, id: "cmt_3" }),
    )
    expect(result.current.postComments["post_2"]).toHaveLength(1)
    expect(result.current.postComments["post_1"]).toHaveLength(2)
  })

  it("estado é JSON-serializable (sem Date nem funções)", async () => {
    mod = await importStore()
    const { result } = renderHook(() => mod.useSocialStore())

    act(() => {
      result.current.updatePostLike("post_1", true, 3)
      result.current.updateCommentLike("cmt_1", true, 2)
      result.current.addCommentToPost("post_1", {
        id: "cmt_1",
        postId: "post_1",
        content: "ola",
        likeCount: 0,
        parentCommentId: null,
        createdAt: "2026-10-05T10:00:00Z",
        author: {
          id: "usr_2",
          name: "Comentarista",
          displayName: null,
          avatar: null,
        },
      })
    })

    const snapshot = JSON.parse(JSON.stringify(result.current.postLikes))
    expect(snapshot).toEqual({
      post_1: { liked: true, likeCount: 3 },
    })
    expect(JSON.parse(JSON.stringify(result.current.commentLikes))).toEqual(
      result.current.commentLikes,
    )
    expect(JSON.parse(JSON.stringify(result.current.postComments))).toEqual(
      result.current.postComments,
    )
  })
})
