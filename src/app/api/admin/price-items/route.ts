import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { createPriceItemSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createPriceItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const service = await prisma.service.findUnique({
    where: { id: parsed.data.serviceId },
  });
  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const last = await prisma.priceItem.findFirst({
    where: { serviceId: parsed.data.serviceId },
    orderBy: { sortOrder: "desc" },
  });

  const item = await prisma.priceItem.create({
    data: {
      serviceId: parsed.data.serviceId,
      labelUa: parsed.data.labelUa,
      labelRu: parsed.data.labelRu,
      amount: parsed.data.amount,
      isSurcharge: parsed.data.isSurcharge ?? false,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
