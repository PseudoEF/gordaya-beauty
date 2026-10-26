import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { kyivLocalToUtc } from "@/lib/timezone";

const patchSchema = z
  .object({
    status: z.enum(["AVAILABLE", "BLOCKED"]).optional(),
    startsAt: z.string().min(1).optional(), // "YYYY-MM-DDTHH:mm" in Kyiv local time
    durationMin: z.number().int().min(15).max(720).optional(),
  })
  .refine(
    (data) =>
      data.status !== undefined ||
      data.startsAt !== undefined ||
      data.durationMin !== undefined,
    { message: "Nothing to update" }
  );

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const slot = await prisma.slot.findUnique({ where: { id } });
  if (!slot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const wantsReschedule =
    parsed.data.startsAt !== undefined || parsed.data.durationMin !== undefined;

  if (slot.status === "BOOKED") {
    return NextResponse.json(
      { error: "Cannot change a booked slot directly, cancel the booking instead" },
      { status: 409 }
    );
  }

  const data: { status?: string; startsAt?: Date; endsAt?: Date } = {};

  if (parsed.data.status !== undefined) {
    data.status = parsed.data.status;
  }

  if (wantsReschedule) {
    const currentDurationMs = slot.endsAt.getTime() - slot.startsAt.getTime();
    const newStartsAt = parsed.data.startsAt
      ? kyivLocalToUtc(parsed.data.startsAt)
      : slot.startsAt;
    const newDurationMs = parsed.data.durationMin
      ? parsed.data.durationMin * 60_000
      : currentDurationMs;
    const newEndsAt = new Date(newStartsAt.getTime() + newDurationMs);

    const overlapping = await prisma.slot.findFirst({
      where: {
        id: { not: id },
        startsAt: { lt: newEndsAt },
        endsAt: { gt: newStartsAt },
      },
    });
    if (overlapping) {
      return NextResponse.json({ error: "OVERLAPS_EXISTING" }, { status: 409 });
    }

    data.startsAt = newStartsAt;
    data.endsAt = newEndsAt;
  }

  const updated = await prisma.slot.update({ where: { id }, data });

  return NextResponse.json({ slot: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.slot.delete({ where: { id } }).catch(() => null);

  return NextResponse.json({ ok: true });
}
