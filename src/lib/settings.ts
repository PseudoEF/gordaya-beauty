import { prisma } from "@/lib/prisma";

/**
 * Настройки приложения хранятся в таблице AppSetting как пары ключ/значение.
 * Миграционного движка в проекте нет, поэтому значение по умолчанию
 * применяется лениво: если ключа ещё нет — он пишется дефолтом.
 */

export const SETTING_BOOKING_CUTOFF_MINUTES = "bookingCutoffMinutes";

/**
 * Сколько минут до начала окна запись уже недоступна.
 * По умолчанию 120 (два часа) — мастеру нужно время на подготовку,
 * и клиент не должен выбирать окно, которое скоро начнётся.
 */
export const DEFAULT_BOOKING_CUTOFF_MINUTES = 120;

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function getNumberSetting(
  key: string,
  fallback: number
): Promise<number> {
  const raw = await getSetting(key);
  if (raw === null) {
    await setSetting(key, String(fallback));
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const existing = await prisma.appSetting.findUnique({ where: { key } });
  if (existing) {
    await prisma.appSetting.update({ where: { key }, data: { value } });
  } else {
    await prisma.appSetting.create({ data: { key, value } });
  }
}

/**
 * Момент, раньше которого окно записывать нельзя: сейчас минус отсечка.
 * Окно с началом раньше этого момента клиенту не показывается.
 */
export async function bookingThreshold(): Promise<Date> {
  const minutes = await getNumberSetting(
    SETTING_BOOKING_CUTOFF_MINUTES,
    DEFAULT_BOOKING_CUTOFF_MINUTES
  );
  return new Date(Date.now() + minutes * 60_000);
}