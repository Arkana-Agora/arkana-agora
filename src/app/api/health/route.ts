import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import pkg from "../../../../package.json";

export const dynamic = "force-dynamic";

const ok = { status: "ok" } as const;
const notConfigured = { status: "not-configured" } as const;

async function checkDatabase(): Promise<{ status: "ok" } | { status: "error" }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return ok;
  } catch {
    return { status: "error" };
  }
}

export async function GET() {
  const checks = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: pkg.version,
    services: {
      database: await checkDatabase(),
      redis: notConfigured,
      ai: notConfigured,
    },
  };

  const isHealthy = Object.values(checks.services).every((s) => s.status === "ok");
  return NextResponse.json(checks, { status: isHealthy ? 200 : 503 });
}