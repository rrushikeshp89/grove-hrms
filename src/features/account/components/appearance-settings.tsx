"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { DensityToggle } from "@/components/shell/preference-controls";
import { SegmentedControl } from "@/components/ui/choice";
import { useTheme } from "@/hooks/use-theme";
import type { ThemePref } from "@/lib/preferences";

/** Changes apply instantly and are saved to your account by PreferenceSync. */
export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex flex-col divide-y divide-hairline">
      <div className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-body font-medium text-ink">Theme</p>
          <p className="text-small text-ink-muted">System follows your device&apos;s setting.</p>
        </div>
        <SegmentedControl<ThemePref>
          aria-label="Theme"
          value={theme ?? "system"}
          onValueChange={setTheme}
          options={[
            { value: "system", label: "System", icon: <Monitor aria-hidden /> },
            { value: "light", label: "Light", icon: <Sun aria-hidden /> },
            { value: "dark", label: "Dark", icon: <Moon aria-hidden /> },
          ]}
        />
      </div>
      <div className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-body font-medium text-ink">Density</p>
          <p className="text-small text-ink-muted">Compact fits more rows in tables and lists.</p>
        </div>
        <DensityToggle size="md" />
      </div>
    </div>
  );
}
