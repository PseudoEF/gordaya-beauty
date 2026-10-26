import { cookies } from "next/headers";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";

export interface SessionData {
  isAdmin?: boolean;
}

const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 32) {
  throw new Error(
    "SESSION_SECRET is missing or too short. Set a random string of at least 32 characters in .env"
  );
}

export const sessionOptions: SessionOptions = {
  password: secret,
  cookieName: "gordaya_admin_session",
  cookieOptions: {
    // Флаг Secure запрещает браузеру сохранять куку, если страница открыта
    // не по HTTPS, — тогда вход «проходит», но сессия теряется и админку
    // выбрасывает обратно на логин без всякой ошибки. Поэтому флаг
    // включается явно через переменную окружения: для локальной раздачи
    // по HTTP оставляем false, а при публикации за HTTPS выставляем true.
    secure: process.env.SESSION_COOKIE_SECURE === "true",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: "lax",
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function requireAdmin(): Promise<boolean> {
  const session = await getSession();
  return session.isAdmin === true;
}
