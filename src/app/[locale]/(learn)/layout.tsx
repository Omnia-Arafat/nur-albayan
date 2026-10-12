import { Header } from "@/components/app/header";

/** The learner's screens share the book header with its section tabs. */
export default function LearnLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}
