import { Ladder } from "@/components/screens/ladder";

export default async function Page(props: PageProps<"/[locale]/games/ladder">) {
  const q = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const from = one(q.from) ?? "";
  return <Ladder from={from === "bank" || /^\d+$/.test(from) ? from : "1"} />;
}
