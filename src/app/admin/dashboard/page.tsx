import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export default async function AdminDashboardPage() {
  if (!(await requireAdmin())) {
    redirect("/admin/login");
  }

  return <AdminDashboard />;
}
