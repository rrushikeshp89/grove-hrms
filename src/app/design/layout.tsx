import { AppShell } from "@/components/shell/app-shell";

export default function DesignLayout({ children }: LayoutProps<"/design">) {
  return <AppShell>{children}</AppShell>;
}
