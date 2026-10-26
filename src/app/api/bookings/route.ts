import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createBookingSchema } from "@/lib/validators";
import { bookingThreshold } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { slotId, serviceId, clientName, phone, telegram, instagram, comment } =
    parsed.data;

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const [slot, service] = await Promise.all([
        tx.slot.findUnique({ where: { id: slotId } }),
        tx.service.findUnique({ where: { id: serviceId } }),
      ]);
      if (!slot || slot.status !== "AVAILABLE") {
        throw new Error("SLOT_TAKEN");
      }
      if (!service || !service.active) {
        throw new Error("SERVICE_NOT_FOUND");
      }
      // Повторная проверка на сервере: список окон скрывает слишком
      // близкие, но клиент может отправить id напрямую.
      if (slot.startsAt < (await bookingThreshold())) {
        throw new Error("SLOT_TOO_SOON");
      }

      await tx.slot.update({
        where: { id: slotId },
        data: { status: "BOOKED" },
      });

      return tx.booking.create({
        data: {
          slotId,
          serviceId,
          clientName,
          phone,
          telegram: telegram || null,
          instagram: instagram || null,
          comment: comment || null,
        },
      });
    });

    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "SLOT_TAKEN") {
      return NextResponse.json({ error: "SLOT_TAKEN" }, { status: 409 });
    }
    if (err instanceof Error && err.message === "SERVICE_NOT_FOUND") {
      return NextResponse.json({ error: "SERVICE_NOT_FOUND" }, { status: 404 });
    }
    if (err instanceof Error && err.message === "SLOT_TOO_SOON") {
      return NextResponse.json({ error: "SLOT_TOO_SOON" }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
