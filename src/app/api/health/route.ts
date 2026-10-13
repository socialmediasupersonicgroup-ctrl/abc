import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + database check for the hosting platform. Exposes no data. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
