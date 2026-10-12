import { requireStaff } from "@/components/staff/access";
import { TeacherGrade } from "@/components/staff/teacher-grade";
import { classroomStudents, listClassrooms } from "@/modules/classroom/service";

export default async function Page({ params, searchParams }: PageProps<"/[locale]/teacher/grade">) {
  const { db, viewer } = await requireStaff((await params).locale, "students.grade");
  const classes = await listClassrooms(db, viewer);
  const asked = (await searchParams).class;
  const current = classes.find((c) => c.id === asked) ?? classes[0];
  const students = current ? await classroomStudents(db, current.id) : [];
  return (
    <TeacherGrade
      classes={classes.map((c) => ({ id: c.id, name: c.name, students: Number(c.students) }))}
      current={current?.id ?? null}
      students={students.map((s) => ({ id: s.id, name: s.name, reachedPage: s.reachedPage }))}
    />
  );
}
