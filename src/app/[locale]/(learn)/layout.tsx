import { Header } from "@/components/app/header";
import { ShortcutsHelp } from "@/components/app/keys";
import { ProgressSync } from "@/components/app/sync";

/**
 * The learner's screens share the book header with its section tabs, keep a linked profile saved,
 * and open the keyboard shortcut sheet on "?".
 */
export default function LearnLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <Header />
      <ProgressSync />
      <ShortcutsHelp />
      {children}
    </>
  );
}
