"use client";

import { Check, Copy } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";

export type ProfileTab = { value: string; label: string; content: React.ReactNode };

/** Tabs that remember themselves in the URL without a server round trip. */
export function ProfileTabs({ tabs, initial }: { tabs: ProfileTab[]; initial: string }) {
  const [value, setValue] = React.useState(
    tabs.some((t) => t.value === initial) ? initial : tabs[0]!.value,
  );
  return (
    <Tabs
      value={value}
      onValueChange={(v) => {
        setValue(v);
        const url = new URL(window.location.href);
        if (v === tabs[0]!.value) url.searchParams.delete("tab");
        else url.searchParams.set("tab", v);
        window.history.replaceState(window.history.state, "", url);
      }}
    >
      <TabsList aria-label="Profile sections">
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value}>
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Tooltip content={copied ? "Copied" : label}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="text-success" /> : <Copy />}
      </Button>
    </Tooltip>
  );
}
