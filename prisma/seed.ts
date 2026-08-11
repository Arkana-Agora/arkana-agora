import { PrismaClient } from "@prisma/client";

export async function seed(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    console.log("Seed module scaffolded — nothing to seed yet. See docs/03-database/migrations.md §6.");
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});