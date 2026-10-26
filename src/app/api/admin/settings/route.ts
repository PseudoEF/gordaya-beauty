import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { updateSettingsSchema } from "@/lib/validators";
import {
  SETTING_BOOKING_CUTOFF_MINUTES,
  DEFAULT_BOOKING_CUTOFF_MINUTES,
  getNumberSetting,
  setSetting,
} from "@/lib/settings";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bookingCutoffMinutes = await getNumberSetting(
    SETTING_BOOKING_CUTOFF_MINUTES,
    DEFAULT_BOOKING_CUTOFF_MINUTES
  );

  return NextResponse.json({
    bookingCutoffMinutes,
    defaultBookingCutoffMinutes: DEFAULT_BOOKING_CUTOFF_MINUTES,
  });
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  await setSetting(
    SETTING_BOOKING_CUTOFF_MINUTES,
    String(parsed.data.bookingCutoffMinutes)
  );

  return NextResponse.json({
    ok: true,
    bookingCutoffMinutes: parsed.data.bookingCutoffMinutes,
  });
}