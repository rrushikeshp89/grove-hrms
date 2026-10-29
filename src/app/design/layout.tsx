import { AppShell } from "@/components/shell/app-shell";

export default function DesignLayout({ children }: LayoutProps<"/design">) {
  return <AppShell variant="design">{children}</AppShell>;
}
