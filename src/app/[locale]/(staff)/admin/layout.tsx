import { requireStaff } from "@/components/staff/access";
import { type NavEntry, StaffShell } from "@/components/staff/shell";

const NAV: NavEntry[] = [
  { group: "staff.groupPlatform" },
  { path: "/admin/overview", label: "staff.overview", icon: "journey" },
  { group: "staff.groupContent" },
  { path: "/admin", label: "staff.pages", icon: "book" },
  { path: "/admin/texts", label: "staff.texts", icon: "cards" },
  { path: "/admin/rewards", label: "staff.rewards", icon: "trophy" },
  { group: "staff.groupPeople" },
  { path: "/admin/people", label: "staff.people", icon: "profile" },
  { path: "/admin/settings", label: "staff.platformSettings", icon: "level" },
  { group: "staff.groupClass" },
  { path: "/teacher", label: "staff.teacher", icon: "journey" },
];

export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]/admin">) {
  const { viewer, roleLabel } = await requireStaff((await params).locale, "content.edit");
  return (
    <StaffShell title="staff.admin" viewer={{ displayName: viewer.displayName, roleLabel }} nav={NAV}>
      {children}
    </StaffShell>
  );
}
