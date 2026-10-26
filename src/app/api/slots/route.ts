import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bookingThreshold } from "@/lib/settings";

// The master works alone, so free windows are shared across every service —
// this returns the same pool regardless of which service the client is
// booking; the chosen service is recorded on the booking itself.
export async function GET() {
  // Окна, которые начнутся раньше порога (сейчас минус настройка
  // «за сколько часов до начала запись закрыта»), клиенту не показываем.
  const threshold = await bookingThreshold();

  const slots = await prisma.slot.findMany({
    where: {
      status: "AVAILABLE",
      startsAt: { gte: threshold },
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, startsAt: true, endsAt: true },
  });

  return NextResponse.json({ slots });
}