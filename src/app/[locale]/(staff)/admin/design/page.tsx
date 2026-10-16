import { requireStaff } from "@/components/staff/access";
import { AdminDesign } from "@/components/staff/admin-design";
import { themeColours } from "@/modules/admin/service";
import { getLesson, listLessons } from "@/modules/content/service";

/** How many of the book's words the colour preview shows. */
const SAMPLE_WORDS = 3;

export default async function Page({ params }: PageProps<"/[locale]/admin/design">) {
  const locale = (await params).locale;
  const { db } = await requireStaff(locale, "theme.edit");
  // The preview paints real words from the book: the first page that has words to read.
  const lessons = await listLessons(db, locale);
  let sample: { text: string; role: string }[][] = [];
  for (const l of lessons) {
    const lesson = await getLesson(db, l.bookPage, locale);
    const words = lesson?.sections.flatMap((s) => s.items.filter((i) => i.isDrillable)) ?? [];
    if (words.length >= SAMPLE_WORDS) {
      sample = words.slice(0, SAMPLE_WORDS).map((w) => w.segments);
      break;
    }
  }
  return <AdminDesign themes={await themeColours(db)} sample={sample} />;
}
