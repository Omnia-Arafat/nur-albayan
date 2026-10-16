import { requireStaff } from "@/components/staff/access";
import { TeacherOverview } from "@/components/staff/teacher-overview";
import { classLeaderboard, leaderboardOn } from "@/modules/classroom/leaderboard";
import { classroomOverview, listClassrooms } from "@/modules/classroom/service";
import { settingsAt } from "@/modules/settings/service";

export default async function Page({ params, searchParams }: PageProps<"/[locale]/teacher">) {
  const { db, viewer } = await requireStaff((await params).locale, "classrooms.manage");
  const classes = await listClassrooms(db, viewer);
  const asked = (await searchParams).class;
  const current = classes.find((c) => c.id === asked) ?? classes[0];
  const [overview, settings, leaders] = current
    ? await Promise.all([
        classroomOverview(db, current.id),
        settingsAt(db, "classroom", current.id),
        leaderboardOn(db, current.id).then((on) => (on ? classLeaderboard(db, current.id) : null)),
      ])
    : [null, [], null];
  return (
    <TeacherOverview
      classes={classes.map((c) => ({ id: c.id, name: c.name, students: Number(c.students) }))}
      overview={overview}
      settings={settings.filter((x) => x.type === "boolean")}
      leaders={leaders}
    />
  );
}
