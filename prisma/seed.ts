import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@arkanaagora.dev";
const TEST_EMAIL = "test@arkanaagora.dev";

export async function seed(): Promise<void> {
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      name: "Admin",
      displayName: "Admin",
      provider: "EMAIL",
      providerId: ADMIN_EMAIL,
      role: "ADMIN",
      emailVerified: new Date(),
      profile: { create: {} },
    },
  });

  const test = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {},
    create: {
      email: TEST_EMAIL,
      name: "Test User",
      displayName: "Test User",
      provider: "EMAIL",
      providerId: TEST_EMAIL,
      role: "USER",
      emailVerified: new Date(),
      profile: { create: {} },
    },
  });

  console.log(
    `Seed ok: admin=${admin.email} (id ${admin.id}) | test=${test.email} (id ${test.id})`,
  );
}

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
