import { notFound } from "next/navigation";

import { requireStaff } from "@/components/staff/access";
import { StudentDetail } from "@/components/staff/student-detail";
import { studentReport } from "@/modules/classroom/report";
import { isMember, listClassrooms } from "@/modules/classroom/service";

export default async function Page({ params, searchParams }: PageProps<"/[locale]/teacher/students/[studentId]">) {
  const { locale, studentId } = await params;
  const { db, viewer } = await requireStaff(locale, "classrooms.manage");
  if (!/^[0-9a-f-]{36}$/.test(studentId)) notFound();
  const classes = await listClassrooms(db, viewer);
  const asked = (await searchParams).class;
  // The class in the link, or else the first of the teacher's classes the student is in.
  let room = classes.find((c) => c.id === asked);
  if (!room || !(await isMember(db, room.id, studentId))) {
    room = undefined;
    for (const c of classes)
      if (await isMember(db, c.id, studentId)) {
        room = c;
        break;
      }
  }
  const report = room && (await studentReport(db, room.id, studentId, locale));
  if (!report) notFound();
  return <StudentDetail report={report} />;
}
