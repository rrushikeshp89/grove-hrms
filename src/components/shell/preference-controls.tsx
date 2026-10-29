"use client";

import { Monitor, Moon, Rows3, Rows4, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import * as React from "react";

import { SegmentedControl } from "@/components/ui/choice";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { useHtmlData } from "@/hooks/use-html-data";
import { setDensity, type Density, type ThemePref } from "@/lib/preferences";

export function ThemeMenu() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const Icon = resolvedTheme === "dark" ? Moon : Sun;
  return (
    <DropdownMenu>
      <Tooltip content="Theme">
        <DropdownMenuTrigger
          aria-label="Change theme"
          className="grid size-9 place-items-center rounded-control text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink data-[state=open]:bg-surface-hover"
        >
          <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent className="min-w-40">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemePref)}>
          <DropdownMenuRadioItem value="light">
            <Sun aria-hidden /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon aria-hidden /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor aria-hidden /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function useDensity() {
  const density: Density = useHtmlData("density") === "compact" ? "compact" : "comfortable";
  return { density, setDensity };
}

export function DensityToggle({ size = "sm" }: { size?: "sm" | "md" }) {
  const { density, setDensity } = useDensity();
  return (
    <SegmentedControl
      aria-label="Row density"
      size={size}
      value={density}
      onValueChange={setDensity}
      options={[
        { value: "comfortable", label: "Comfortable", icon: <Rows3 aria-hidden /> },
        { value: "compact", label: "Compact", icon: <Rows4 aria-hidden /> },
      ]}
    />
  );
}
