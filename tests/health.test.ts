import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
import { APP_VERSION } from "@/lib/version";

type HealthBody = {
  status: "ok" | "degraded";
  version: string;
  services: {
    database: { status: "ok" | "error" };
  };
};

describe("GET /api/health", () => {
  it("returns a coherent envelope for the current DB state", async () => {
    const res = await GET();
    const body = (await res.json()) as HealthBody;

    expect(body.version).toBe(APP_VERSION);
    expect(body.services.database.status).toMatch(/^(ok|error)$/);

    if (body.services.database.status === "ok") {
      expect(res.status).toBe(200);
      expect(body.status).toBe("ok");
    } else {
      expect(res.status).toBe(503);
      expect(body.status).toBe("degraded");
    }
  });
});
