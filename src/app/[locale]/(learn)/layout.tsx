import { Header } from "@/components/app/header";
import { ProgressSync } from "@/components/app/sync";

/** The learner's screens share the book header with its section tabs, and keep a linked profile saved. */
export default function LearnLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <Header />
      <ProgressSync />
      {children}
    </>
  );
}
