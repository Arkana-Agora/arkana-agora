import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns 503 while services are not configured", async () => {
    const res = await GET();
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.version).toBe("0.1.0");
    expect(["ok", "error"]).toContain(body.services.database.status);
    expect(body.services.redis).toEqual({ status: "not-configured" });
  });
});