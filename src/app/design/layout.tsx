import { AppShell } from "@/components/shell/app-shell";

import { Providers } from "../providers";

export default function DesignLayout({ children }: LayoutProps<"/design">) {
  return (
    <Providers>
      <AppShell variant="design">{children}</AppShell>
    </Providers>
  );
}
