import { Games } from "@/components/screens/games";

export default async function Page(props: PageProps<"/[locale]/games">) {
  const { page } = await props.searchParams;
  const n = Number(Array.isArray(page) ? page[0] : page);
  return <Games page={Number.isInteger(n) && n > 0 ? n : null} />;
}
