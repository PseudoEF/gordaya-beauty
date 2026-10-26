import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";

export default async function AdminIndexPage() {
  redirect((await requireAdmin()) ? "/admin/dashboard" : "/admin/login");
}
