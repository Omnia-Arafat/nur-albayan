import { requireStaff } from "@/components/staff/access";
import { type NavEntry, StaffShell } from "@/components/staff/shell";

const NAV: NavEntry[] = [
  { group: "staff.groupClass" },
  { path: "/teacher", label: "staff.overview", icon: "journey" },
  { path: "/teacher/students", label: "staff.students", icon: "profile" },
  { path: "/teacher/grade", label: "staff.grade", icon: "check" },
  { path: "/teacher/classes", label: "staff.classes", icon: "grid-3" },
];

export default async function TeacherLayout({ children, params }: LayoutProps<"/[locale]/teacher">) {
  const { viewer, roleLabel } = await requireStaff((await params).locale, "classrooms.manage");
  const nav = viewer.permissions.includes("content.edit")
    ? [...NAV, { group: "staff.groupContent" }, { path: "/admin", label: "staff.pages", icon: "book" }]
    : NAV;
  return (
    <StaffShell title="staff.teacher" viewer={{ displayName: viewer.displayName, roleLabel }} nav={nav}>
      {children}
    </StaffShell>
  );
}
