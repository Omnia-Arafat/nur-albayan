import { requireStaff } from "@/components/staff/access";
import { TeacherStudents } from "@/components/staff/teacher-students";
import { classroomStudents, listClassrooms } from "@/modules/classroom/service";

export default async function Page({ params, searchParams }: PageProps<"/[locale]/teacher/students">) {
  const { db, viewer } = await requireStaff((await params).locale, "classrooms.manage");
  const classes = await listClassrooms(db, viewer);
  const asked = (await searchParams).class;
  const current = classes.find((c) => c.id === asked) ?? classes[0];
  const students = current ? await classroomStudents(db, current.id) : [];
  return (
    <TeacherStudents
      classes={classes.map((c) => ({ id: c.id, name: c.name, students: Number(c.students) }))}
      current={current?.id ?? null}
      students={students}
    />
  );
}
