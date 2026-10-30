import { AdminPanel } from "@/components/admin/AdminPanel";
import { requireAdmin } from "@/lib/admin";
import { loadAdminUsers, loadApiUsage } from "@/lib/admin-stats";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin", robots: { index: false, follow: false } } as const;

/** FIL-I37 · /admin: only `ADMIN_EMAILS` get here, everyone else a 404. Not in nav. */
export default async function AdminPage() {
  await requireAdmin();
  const now = new Date();
  const [usage, users] = await Promise.all([loadApiUsage(now), loadAdminUsers()]);
  return <AdminPanel usage={usage} users={users} now={now} />;
}
