import { handleFollowList } from "@/app/api/v1/users/_follow-list"
import { newReqId } from "@/lib/logger"

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
): Promise<Response> {
  const reqId = newReqId()
  const { username } = await params
  return handleFollowList(request, username, "followers", reqId)
}
