import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { createSlotSchema } from "@/lib/validators";
import { kyivLocalToUtc } from "@/lib/timezone";
import { DEFAULT_SLOT_DURATION_MIN } from "@/lib/constants";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slots = await prisma.slot.findMany({
    orderBy: { startsAt: "asc" },
    include: { booking: { include: { service: true } } },
  });

  return NextResponse.json({ slots });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSlotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const durationMin = parsed.data.durationMin ?? DEFAULT_SLOT_DURATION_MIN;
  const startsAt = kyivLocalToUtc(parsed.data.startsAt);
  const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);

  const overlapping = await prisma.slot.findFirst({
    where: { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
  });
  if (overlapping) {
    return NextResponse.json({ error: "OVERLAPS_EXISTING" }, { status: 409 });
  }

  const slot = await prisma.slot.create({ data: { startsAt, endsAt } });

  return NextResponse.json({ slot }, { status: 201 });
}
