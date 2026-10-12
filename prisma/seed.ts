/**
 * Seeds the explicitly labelled demo workspace with fictional sample data.
 * Real workspaces are never touched: only workspaces flagged `isDemo` are cleared and re-seeded.
 */
import { PrismaClient } from "@prisma/client";
import { seedDemoData } from "../src/lib/demo-data";
import { clearWorkspaceData } from "../src/lib/services/workspaces";

const prisma = new PrismaClient();

async function main() {
  let demo = await prisma.workspace.findFirst({ where: { isDemo: true } });
  if (demo) {
    await clearWorkspaceData(demo.id, prisma);
  } else {
    demo = await prisma.workspace.create({ data: { name: "Demo Studio (sample data)", isDemo: true, currency: "INR" } });
  }
  await seedDemoData(prisma, demo.id, demo.timezone);
  console.log(`Seeded demo workspace "${demo.name}" (${demo.id}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
