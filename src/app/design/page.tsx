import {
  Bell,
  CalendarCheck,
  CalendarDays,
  ChartLine,
  Clock,
  FileText,
  Inbox,
  Network,
  PartyPopper,
  Search,
  Settings,
  ShieldCheck,
  Sprout,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

import { SpringDemo, Swatch } from "./_components/foundations-client";
import { Section, SectionStack, Specimen } from "./_components/showcase";

export const metadata: Metadata = { title: "Foundations" };

const colorGroups = [
  {
    title: "Surfaces",
    note: "Warm paper, not white. Depth comes from hairlines first, shadow second.",
    swatches: [
      { token: "bg", className: "bg-bg", usage: "App canvas" },
      { token: "surface", className: "bg-surface", usage: "Cards and panels" },
      { token: "surface-sunken", className: "bg-surface-sunken", usage: "Wells, table headers" },
      { token: "surface-hover", className: "bg-surface-hover", usage: "Row and item hover" },
      { token: "hairline", className: "bg-hairline", usage: "Default 1px borders" },
      { token: "border-input", className: "bg-border-input", usage: "Field outlines (3:1)" },
    ],
  },
  {
    title: "Ink",
    note: "Three steps of warm near-black. All pass AA on every surface.",
    swatches: [
      { token: "ink", className: "bg-ink", usage: "Primary text" },
      { token: "ink-muted", className: "bg-ink-muted", usage: "Secondary text" },
      { token: "ink-subtle", className: "bg-ink-subtle", usage: "Captions, placeholders" },
    ],
  },
  {
    title: "Brand and highlight",
    note: "Forest green for action and focus, used sparingly. Amber is saved for moments worth noticing.",
    swatches: [
      {
        token: "accent",
        className: "bg-accent",
        usage: "Primary actions, focus",
        fg: "text-accent-fg",
      },
      {
        token: "accent-subtle",
        className: "bg-accent-subtle",
        usage: "Selected states",
        fg: "text-accent",
      },
      {
        token: "highlight",
        className: "bg-highlight",
        usage: "Celebrations, badges",
        fg: "text-highlight-fg",
      },
      {
        token: "highlight-subtle",
        className: "bg-highlight-subtle",
        usage: "Milestone cards",
        fg: "text-highlight-ink",
      },
    ],
  },
  {
    title: "Semantic",
    note: "Desaturated so a screen full of statuses still feels calm.",
    swatches: [
      {
        token: "success",
        className: "bg-success-subtle",
        usage: "Approved, present",
        fg: "text-success",
      },
      {
        token: "warning",
        className: "bg-warning-subtle",
        usage: "Pending, late",
        fg: "text-warning",
      },
      {
        token: "danger",
        className: "bg-danger-subtle",
        usage: "Rejected, errors",
        fg: "text-danger",
      },
      { token: "info", className: "bg-info-subtle", usage: "Notices, onboarding", fg: "text-info" },
    ],
  },
  {
    title: "Charts",
    note: "Categorical order. Single-series charts use the accent alone.",
    swatches: [
      { token: "chart-1", className: "bg-chart-1", usage: "Forest" },
      { token: "chart-2", className: "bg-chart-2", usage: "Amber" },
      { token: "chart-3", className: "bg-chart-3", usage: "Terracotta" },
      { token: "chart-4", className: "bg-chart-4", usage: "Slate" },
      { token: "chart-5", className: "bg-chart-5", usage: "Sage" },
      { token: "chart-6", className: "bg-chart-6", usage: "Clay" },
    ],
  },
];

const typeScale = [
  {
    name: "display-xl",
    cls: "font-display-soft text-display-xl font-medium",
    sample: "128 people",
  },
  {
    name: "display",
    cls: "font-display-soft text-display font-medium",
    sample: "Good morning, Priya",
  },
  { name: "title", cls: "font-display-soft text-title font-medium", sample: "Leave requests" },
  { name: "heading", cls: "text-heading font-semibold", sample: "Team availability this week" },
  {
    name: "body",
    cls: "text-body",
    sample: "Anjali is out Thursday and Friday for a family wedding in Mysuru.",
  },
  {
    name: "small",
    cls: "text-small text-ink-muted",
    sample: "Requested 2 days ago · Waiting on Rahul",
  },
  { name: "caption", cls: "text-caption text-ink-subtle", sample: "Last synced 09:41" },
];

const radii = [
  { name: "xs · 4px", cls: "rounded-xs", use: "Keycaps" },
  { name: "sm · 6px", cls: "rounded-sm", use: "Menu items" },
  { name: "control · 8px", cls: "rounded-control", use: "Inputs, buttons" },
  { name: "card · 12px", cls: "rounded-card", use: "Cards" },
  { name: "overlay · 14px", cls: "rounded-overlay", use: "Dialogs, sheets" },
  { name: "full", cls: "rounded-full", use: "Tags, avatars" },
];

const shadows = [
  { name: "xs", cls: "shadow-xs", use: "Cards at rest" },
  { name: "sm", cls: "shadow-sm", use: "Hover lift" },
  { name: "md", cls: "shadow-md", use: "Menus, popovers" },
  { name: "lg", cls: "shadow-lg", use: "Dialogs" },
];

const icons = [
  Users,
  Network,
  Clock,
  CalendarDays,
  CalendarCheck,
  Inbox,
  Wallet,
  ChartLine,
  UserPlus,
  FileText,
  Bell,
  ShieldCheck,
  Settings,
  Search,
  PartyPopper,
  Sprout,
];

export default function FoundationsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Design system · Warm Calm"
        title="Foundations"
        description="Grove should feel like a well-made notebook: warm paper, confident ink, one green for action and a little amber for the moments worth celebrating."
      />

      <SectionStack>
        <Section
          id="color"
          title="Color"
          description="Every color is a token defined once in globals.css, with a light and a dark value. Components never use raw hex. Switch the theme in the top bar to see both."
        >
          <div className="flex flex-col gap-10">
            {colorGroups.map((g) => (
              <div key={g.title}>
                <div className="mb-4 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                  <h3 className="text-heading font-semibold text-ink">{g.title}</h3>
                  <p className="text-small text-ink-muted">{g.note}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  {g.swatches.map((s) => (
                    <Swatch key={s.token} {...s} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="type"
          title="Typography"
          description="Fraunces, softened, for titles and the numbers a screen is about. Geist for everything you read and use. Geist Mono for IDs and timestamps."
        >
          <Card className="divide-y divide-hairline">
            {typeScale.map((t) => (
              <div
                key={t.name}
                className="grid gap-2 px-5 py-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-baseline"
              >
                <span className="font-mono text-caption text-ink-subtle">{t.name}</span>
                <span className={cn("text-ink", t.cls)}>{t.sample}</span>
              </div>
            ))}
          </Card>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Specimen label="Tabular numerals line up in columns" bodyClassName="block">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="mb-2 text-caption text-ink-subtle">Proportional</p>
                  {["₹1,11,450", "₹88,900", "₹1,04,118"].map((n) => (
                    <p
                      key={n}
                      className="text-right text-body text-ink [font-variant-numeric:proportional-nums]"
                    >
                      {n}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-caption text-ink-subtle">Tabular (.num)</p>
                  {["₹1,11,450", "₹88,900", "₹1,04,118"].map((n) => (
                    <p key={n} className="text-right num text-body text-ink">
                      {n}
                    </p>
                  ))}
                </div>
              </div>
            </Specimen>
            <Specimen label="Mono for codes and times" bodyClassName="flex-col items-start gap-1.5">
              <p className="text-body text-ink">
                Employee <span className="font-mono num text-small">GRV-0042</span>
              </p>
              <p className="text-body text-ink">
                Clocked in at <span className="font-mono num text-small">09:12:47</span>
              </p>
              <p className="text-body text-ink">
                Request <span className="font-mono num text-small">LR-2026-1184</span>
              </p>
            </Specimen>
          </div>
        </Section>

        <Section
          id="space"
          title="Space and shape"
          description="A 4px grid with generous gaps. Radii grow with the size of the surface. Shadows are soft and tinted with warm ink."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <Specimen label="Spacing · 4px grid" bodyClassName="flex-col items-stretch gap-2">
              {[1, 2, 3, 4, 6, 8, 10, 12].map((n) => (
                <div key={n} className="flex items-center gap-3">
                  <span className="w-12 font-mono num text-caption text-ink-subtle">{n * 4}px</span>
                  <span className="h-2 rounded-full bg-accent/70" style={{ width: n * 4 * 2 }} />
                </div>
              ))}
            </Specimen>
            <Specimen label="Radius" bodyClassName="grid grid-cols-3 gap-4">
              {radii.map((r) => (
                <div key={r.name} className="flex flex-col items-center gap-2 text-center">
                  <span
                    className={cn("size-12 border border-border-strong bg-surface-sunken", r.cls)}
                  />
                  <span className="font-mono text-caption text-ink">{r.name}</span>
                  <span className="-mt-1.5 text-caption text-ink-subtle">{r.use}</span>
                </div>
              ))}
            </Specimen>
            <Specimen label="Elevation" bodyClassName="grid grid-cols-2 gap-5 bg-bg">
              {shadows.map((s) => (
                <div
                  key={s.name}
                  className={cn(
                    "flex h-16 flex-col justify-end rounded-card border border-hairline bg-surface p-3",
                    s.cls,
                  )}
                >
                  <span className="font-mono text-caption text-ink">shadow-{s.name}</span>
                  <span className="text-caption text-ink-subtle">{s.use}</span>
                </div>
              ))}
            </Specimen>
          </div>
        </Section>

        <Section
          id="motion"
          title="Motion"
          description="150–250ms, spring-based, always explaining a change. Every animation respects reduced motion."
        >
          <div className="grid gap-4 lg:grid-cols-[2fr_minmax(0,1fr)]">
            <Specimen label="Springs" bodyClassName="block">
              <SpringDemo />
            </Specimen>
            <Specimen label="Durations" bodyClassName="flex-col items-stretch gap-3">
              {[
                ["fast", "150ms", "Hover, color"],
                ["base", "200ms", "Fades, small moves"],
                ["slow", "250ms", "Page and panel entrances"],
              ].map(([n, d, u]) => (
                <div
                  key={n}
                  className="flex items-baseline justify-between gap-3 border-b border-hairline pb-2 last:border-0 last:pb-0"
                >
                  <span className="font-mono text-small text-ink">{n}</span>
                  <span className="text-small text-ink-muted">{u}</span>
                  <span className="font-mono num text-caption text-ink-subtle">{d}</span>
                </div>
              ))}
            </Specimen>
          </div>
        </Section>

        <Section
          id="icons"
          title="Iconography"
          description="Lucide only, at a 1.75 stroke. 16px in dense UI, 18–20px in navigation. Never emoji."
        >
          <Card className="grid grid-cols-4 gap-px overflow-hidden bg-hairline sm:grid-cols-8">
            {icons.map((Icon, i) => (
              <div key={i} className="grid aspect-square place-items-center bg-surface">
                <Icon className="size-5 text-ink-muted" strokeWidth={1.75} aria-hidden />
              </div>
            ))}
          </Card>
        </Section>

        <Section
          id="focus"
          title="Focus and contrast"
          description="Press Tab anywhere: every interactive element shows the same 2px accent ring with an offset. Text pairs are checked against WCAG AA in an automated test."
        >
          <Specimen
            label="Contrast ratios (light theme)"
            bodyClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {[
              ["Ink on canvas", "16.5 : 1", "bg-bg text-ink"],
              ["Muted on canvas", "7.2 : 1", "bg-bg text-ink-muted"],
              ["Subtle on surface", "5.2 : 1", "bg-surface text-ink-subtle"],
              ["Text on accent", "7.8 : 1", "bg-accent text-accent-fg"],
            ].map(([label, ratio, cls]) => (
              <div key={label} className={cn("rounded-control border border-hairline p-3", cls)}>
                <p className="text-body font-medium">{label}</p>
                <p className="font-mono num text-caption">{ratio}</p>
              </div>
            ))}
          </Specimen>
        </Section>
      </SectionStack>
    </PageContainer>
  );
}
