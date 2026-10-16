import { requireStaff } from "@/components/staff/access";
import { TeacherClasses } from "@/components/staff/teacher-classes";
import { listClassrooms } from "@/modules/classroom/service";

export default async function Page({ params }: PageProps<"/[locale]/teacher/classes">) {
  const { db, viewer } = await requireStaff((await params).locale, "classrooms.manage");
  const classes = await listClassrooms(db, viewer);
  return (
    <TeacherClasses
      classes={classes.map((c) => ({ id: c.id, name: c.name, joinCode: c.joinCode, students: Number(c.students) }))}
    />
  );
}
