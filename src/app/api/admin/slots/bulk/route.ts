import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { bulkCreateSlotsSchema } from "@/lib/validators";
import { kyivLocalToUtc } from "@/lib/timezone";
import { DEFAULT_SLOT_DURATION_MIN } from "@/lib/constants";

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bulkCreateSlotsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { fromDate, toDate, daysOfWeek, startTimes, durationMin } = parsed.data;
  const duration = durationMin ?? DEFAULT_SLOT_DURATION_MIN;

  const from = new Date(`${fromDate}T00:00:00Z`);
  const to = new Date(`${toDate}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const daysOfWeekSet = new Set(daysOfWeek);
  const candidates: { startsAt: Date; endsAt: Date }[] = [];

  for (
    let cursor = new Date(from);
    cursor <= to;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60_000)
  ) {
    if (!daysOfWeekSet.has(cursor.getUTCDay())) continue;

    const dateStr = cursor.toISOString().slice(0, 10);
    for (const time of startTimes) {
      const startsAt = kyivLocalToUtc(`${dateStr}T${time}`);
      const endsAt = new Date(startsAt.getTime() + duration * 60_000);
      candidates.push({ startsAt, endsAt });
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({ created: 0, skipped: 0 });
  }

  candidates.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const existing = await prisma.slot.findMany({
    where: {
      startsAt: { lt: candidates[candidates.length - 1].endsAt },
      endsAt: { gt: candidates[0].startsAt },
    },
    select: { startsAt: true, endsAt: true },
  });

  function overlapsAny(
    candidate: { startsAt: Date; endsAt: Date },
    ranges: { startsAt: Date; endsAt: Date }[]
  ) {
    return ranges.some(
      (r) => candidate.startsAt < r.endsAt && candidate.endsAt > r.startsAt
    );
  }

  const toCreate: { startsAt: Date; endsAt: Date }[] = [];
  let skipped = 0;
  for (const candidate of candidates) {
    if (overlapsAny(candidate, existing) || overlapsAny(candidate, toCreate)) {
      skipped++;
      continue;
    }
    toCreate.push(candidate);
  }

  if (toCreate.length > 0) {
    await prisma.slot.createMany({
      data: toCreate.map((c) => ({ startsAt: c.startsAt, endsAt: c.endsAt })),
    });
  }

  return NextResponse.json({ created: toCreate.length, skipped });
}
