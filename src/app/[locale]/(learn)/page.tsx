import { Home } from "@/components/screens/home";
import { pageParam } from "@/lib/api";

/** ?page=N opens the whole-book reader on that page (the reader keeps it in the address as you turn). */
export default async function Page(props: PageProps<"/[locale]">) {
  const { page } = await props.searchParams;
  const n = pageParam.safeParse(page);
  return <Home initialPage={n.success ? n.data : undefined} />;
}
