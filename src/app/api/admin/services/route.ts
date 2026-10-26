import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const services = await prisma.service.findMany({
    orderBy: { sortOrder: "asc" },
    include: { priceItems: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json({ services });
}
