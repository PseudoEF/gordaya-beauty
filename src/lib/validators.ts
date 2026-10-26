import { z } from "zod";

export const createBookingSchema = z.object({
  slotId: z.string().min(1),
  serviceId: z.string().min(1),
  clientName: z.string().trim().min(2, "Name is too short").max(100),
  phone: z.string().trim().min(6, "Phone is too short").max(30),
  telegram: z.string().trim().max(60).optional().or(z.literal("")),
  instagram: z.string().trim().max(60).optional().or(z.literal("")),
  comment: z.string().trim().max(500).optional().or(z.literal("")),
});

export const createSlotSchema = z.object({
  startsAt: z.string().min(1), // "YYYY-MM-DDTHH:mm" in Kyiv local time
  durationMin: z.number().int().min(15).max(720).optional(),
});

export const bulkCreateSlotsSchema = z.object({
  fromDate: z.string().min(1), // "YYYY-MM-DD"
  toDate: z.string().min(1), // "YYYY-MM-DD"
  daysOfWeek: z.array(z.number().min(0).max(6)).min(1),
  startTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1),
  durationMin: z.number().int().min(15).max(720).optional(),
});

export const loginSchema = z.object({
  password: z.string().min(1),
});

export const updateServiceSchema = z.object({
  nameUa: z.string().trim().min(1).max(100),
  nameRu: z.string().trim().min(1).max(100),
  durationMin: z.number().int().min(15).max(720),
  priceFrom: z.number().int().min(0).max(1_000_000).nullable(),
  noteUa: z.string().trim().max(500).nullable(),
  noteRu: z.string().trim().max(500).nullable(),
  active: z.boolean(),
});

export const createPriceItemSchema = z.object({
  serviceId: z.string().min(1),
  labelUa: z.string().trim().min(1).max(150),
  labelRu: z.string().trim().min(1).max(150),
  amount: z.number().int().min(0).max(1_000_000),
  isSurcharge: z.boolean().optional(),
});

export const updatePriceItemSchema = z.object({
  labelUa: z.string().trim().min(1).max(150),
  labelRu: z.string().trim().min(1).max(150),
  amount: z.number().int().min(0).max(1_000_000),
  isSurcharge: z.boolean(),
});

// Общие настройки админки. Отсечка 0 означает «запись доступна до самого
// начала окна»; верхняя граница защищает от опечаток вроде 100000 минут.
export const updateSettingsSchema = z.object({
  bookingCutoffMinutes: z.number().int().min(0).max(10080),
});
