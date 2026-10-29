"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import {
  ArrowRight,
  Briefcase,
  CalendarPlus,
  Check,
  CircleCheck,
  Clock,
  Copy,
  Download,
  FileText,
  LogIn,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Badge, StatusPill, Tag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, DateRangePicker } from "@/components/ui/calendar";
import {
  Checkbox,
  RadioGroup,
  RadioItem,
  SegmentedControl,
  Slider,
  Switch,
} from "@/components/ui/choice";
import { Combobox } from "@/components/ui/combobox";
import { Field, Label } from "@/components/ui/field";
import { HoldButton } from "@/components/ui/hold-button";
import { Input, Textarea } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTrigger,
} from "@/components/ui/overlay";
import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  DescriptionList,
  Kbd,
} from "@/components/ui/primitives";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stat } from "@/components/ui/stat";
import { Timeline } from "@/components/ui/timeline";
import { toast } from "@/components/ui/toaster";
import { Tooltip } from "@/components/ui/tooltip";

import { CONFLICTS, HOLIDAYS, PEOPLE } from "../_data/sample";
import { Specimen } from "./showcase";

const holidays = HOLIDAYS.map((h) => ({ date: parseISO(h.date), label: h.label }));
const conflicts = CONFLICTS.map((c) => ({ date: parseISO(c.date), names: c.names }));

/* ─── Buttons ──────────────────────────────────────────────────────────── */

export function ButtonsDemo() {
  const [saving, setSaving] = React.useState(false);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Specimen label="Variants">
        <Button>
          <CalendarPlus aria-hidden /> Apply for leave
        </Button>
        <Button variant="secondary">Export CSV</Button>
        <Button variant="quiet">Save draft</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="destructive">
          <Trash2 aria-hidden /> Remove
        </Button>
        <Button variant="link">
          View all requests <ArrowRight aria-hidden />
        </Button>
      </Specimen>
      <Specimen label="Sizes, states and icon buttons">
        <Button size="sm">Small</Button>
        <Button>Medium</Button>
        <Button size="lg">Large</Button>
        <Button
          loading={saving}
          onClick={() => {
            setSaving(true);
            setTimeout(() => setSaving(false), 1400);
          }}
        >
          Save changes
        </Button>
        <Button disabled>Disabled</Button>
        <Tooltip content="Edit profile">
          <Button variant="secondary" size="icon" aria-label="Edit profile">
            <Pencil />
          </Button>
        </Tooltip>
        <Tooltip content="Copy employee ID">
          <Button variant="ghost" size="icon" aria-label="Copy employee ID">
            <Copy />
          </Button>
        </Tooltip>
      </Specimen>
    </div>
  );
}

/* ─── Form (React Hook Form + Zod) ─────────────────────────────────────── */

const leaveFormSchema = z.object({
  leaveType: z.string({ error: "Choose a leave type" }).min(1, "Choose a leave type"),
  range: z.object(
    { from: z.date(), to: z.date().optional() },
    { error: "Pick the days you'll be away" },
  ),
  halfDay: z.boolean(),
  approver: z
    .string({ error: "Choose who should approve this" })
    .min(1, "Choose who should approve this"),
  reason: z
    .string()
    .trim()
    .min(8, "Add a few words so your manager has context")
    .max(500, "Keep it under 500 characters"),
});

type LeaveForm = z.infer<typeof leaveFormSchema>;

const approverOptions = PEOPLE.filter((p) =>
  ["Engineering Manager", "Head of People", "Finance Manager", "Customer Success Lead"].includes(
    p.designation,
  ),
).map((p) => ({
  value: p.id,
  label: p.name,
  hint: p.designation,
  leading: <Avatar name={p.name} size="xs" />,
}));

export function FormDemo() {
  const form = useForm<LeaveForm>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: { leaveType: "", halfDay: false, approver: "", reason: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: LeaveForm) {
    await new Promise((r) => setTimeout(r, 700));
    const to = values.range.to ?? values.range.from;
    toast.success("Request sent", {
      description: `${format(values.range.from, "d MMM")}–${format(to, "d MMM")} is waiting on your approver.`,
    });
    form.reset();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      <Card>
        <CardHeader
          title="Request time off"
          description="A real form wired to a Zod schema. Submit it empty to see validation."
        />
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <Field label="Leave type" error={errors.leaveType?.message}>
              <Controller
                control={form.control}
                name="leaveType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger onBlur={field.onBlur}>
                      <SelectValue placeholder="Choose a type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casual">Casual leave · 6 left</SelectItem>
                      <SelectItem value="earned">Earned leave · 12 left</SelectItem>
                      <SelectItem value="sick">Sick leave · 7 left</SelectItem>
                      <SelectItem value="wfh">Work from home</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field
              label="Dates"
              hint="Dots mark holidays and teammates who are away."
              error={errors.range?.message ?? errors.range?.from?.message}
            >
              <Controller
                control={form.control}
                name="range"
                render={({ field }) => (
                  <DateRangePicker
                    value={field.value}
                    onChange={(r) => field.onChange(r?.from ? r : undefined)}
                    holidays={holidays}
                    conflicts={conflicts}
                    disabled={{ dayOfWeek: [0, 6] }}
                  />
                )}
              />
            </Field>
            <Field label="Approver" error={errors.approver?.message}>
              <Controller
                control={form.control}
                name="approver"
                render={({ field }) => (
                  <Combobox
                    value={field.value || null}
                    onChange={(v) => field.onChange(v ?? "")}
                    options={approverOptions}
                    placeholder="Search people"
                    searchPlaceholder="Search by name or role"
                  />
                )}
              />
            </Field>
            <div className="flex items-end">
              <Controller
                control={form.control}
                name="halfDay"
                render={({ field }) => (
                  <label className="flex h-9 items-center gap-3 text-body text-ink">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    Last day is a half day
                  </label>
                )}
              />
            </div>
            <Field
              label="Reason"
              hint="Visible to your approver and HR."
              error={errors.reason?.message}
              className="sm:col-span-2"
            >
              <Textarea placeholder="Family wedding in Mysuru" {...form.register("reason")} />
            </Field>
          </CardBody>
          <CardFooter className="justify-end">
            <Button type="button" variant="ghost" onClick={() => form.reset()}>
              Clear
            </Button>
            <Button type="submit" loading={isSubmitting}>
              <Send aria-hidden /> Send request
            </Button>
          </CardFooter>
        </form>
      </Card>

      <div className="flex flex-col gap-4">
        <Specimen label="Text inputs" bodyClassName="flex-col items-stretch gap-4">
          <Field label="Work email" hint="We'll send the welcome kit here.">
            <Input type="email" placeholder="name@northwindgrove.in" />
          </Field>
          <Field label="Search" optional>
            <Input leadingIcon={<Search />} placeholder="Name, ID or team" />
          </Field>
          <Field label="Employee ID" error="GRV-0042 already belongs to Fatima Shaikh">
            <Input defaultValue="GRV-0042" className="font-mono" />
          </Field>
        </Specimen>
      </div>
    </div>
  );
}

/* ─── Selection controls ───────────────────────────────────────────────── */

export function SelectionDemo() {
  const [view, setView] = React.useState<"grid" | "table">("grid");
  const [range, setRange] = React.useState<"30d" | "90d" | "12m">("90d");
  const [checks, setChecks] = React.useState({ email: true, slack: false, digest: true });
  const all = Object.values(checks).every(Boolean);
  const some = Object.values(checks).some(Boolean);
  const [notice, setNotice] = React.useState([30]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Specimen label="Checkboxes" bodyClassName="flex-col items-start gap-3">
        <label className="flex items-center gap-2.5 text-body font-medium text-ink">
          <Checkbox
            checked={all ? true : some ? "indeterminate" : false}
            onCheckedChange={(v) => setChecks({ email: !!v, slack: !!v, digest: !!v })}
          />
          All notifications
        </label>
        {(
          [
            ["email", "Email me about approvals"],
            ["slack", "Send Slack reminders"],
            ["digest", "Weekly team digest"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="ml-7 flex items-center gap-2.5 text-body text-ink">
            <Checkbox
              checked={checks[k]}
              onCheckedChange={(v) => setChecks((c) => ({ ...c, [k]: !!v }))}
            />
            {label}
          </label>
        ))}
      </Specimen>
      <Specimen label="Radio and switch" bodyClassName="flex-col items-start gap-4">
        <RadioGroup defaultValue="manager" aria-label="Approval chain">
          {[
            ["manager", "Manager only"],
            ["manager-hr", "Manager, then HR"],
            ["auto", "Auto-approve under 2 days"],
          ].map(([v, l]) => (
            <label key={v} className="flex items-center gap-2.5 text-body text-ink">
              <RadioItem value={v!} /> {l}
            </label>
          ))}
        </RadioGroup>
        <label className="flex items-center gap-3 text-body text-ink">
          <Switch defaultChecked /> Require a reason for sick leave
        </label>
      </Specimen>
      <Specimen label="Segmented control and slider" bodyClassName="flex-col items-start gap-5">
        <SegmentedControl
          aria-label="Directory view"
          value={view}
          onValueChange={setView}
          options={[
            { value: "grid", label: "Grid" },
            { value: "table", label: "Table" },
          ]}
        />
        <SegmentedControl
          aria-label="Date range"
          size="sm"
          value={range}
          onValueChange={setRange}
          options={[
            { value: "30d", label: "30 days" },
            { value: "90d", label: "90 days" },
            { value: "12m", label: "12 months" },
          ]}
        />
        <div className="w-full">
          <div className="mb-2 flex items-baseline justify-between">
            <Label>Notice period</Label>
            <span className="num text-small text-ink-muted">{notice[0]} days</span>
          </div>
          <Slider
            aria-label="Notice period"
            value={notice}
            onValueChange={setNotice}
            min={0}
            max={90}
            step={15}
          />
        </div>
      </Specimen>
    </div>
  );
}

/* ─── Display ──────────────────────────────────────────────────────────── */

export function DisplayDemo() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Specimen label="Status pills" bodyClassName="gap-2">
        <StatusPill tone="warning">Pending</StatusPill>
        <StatusPill tone="success">Approved</StatusPill>
        <StatusPill tone="danger">Rejected</StatusPill>
        <StatusPill tone="info">Onboarding</StatusPill>
        <StatusPill tone="highlight">On leave</StatusPill>
        <StatusPill>Exited</StatusPill>
      </Specimen>
      <Specimen label="Badges and tags" bodyClassName="gap-2">
        <Badge tone="accent">3 new</Badge>
        <Badge tone="highlight">5 years</Badge>
        <Badge>Contract</Badge>
        <Badge tone="info" size="md">
          <MapPin aria-hidden /> Bengaluru
        </Badge>
        <Tag>React</Tag>
        <Tag>Hiring panel</Tag>
        <Tag>Kannada</Tag>
      </Specimen>
      <Specimen label="Avatars" bodyClassName="gap-4">
        <Avatar name="Priya Raman" size="xl" labelled />
        <Avatar name="Arjun Mehta" size="lg" labelled />
        <Avatar name="Ananya Iyer" size="md" labelled />
        <Avatar name="Rahul Deshpande" size="sm" labelled />
        <Avatar name="Fatima Shaikh" size="xs" labelled />
        <AvatarStack people={PEOPLE.slice(0, 7)} />
      </Specimen>
      <Specimen label="Keyboard" bodyClassName="gap-4 text-body text-ink-muted">
        <span className="inline-flex items-center gap-2">
          Search <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
        <span className="inline-flex items-center gap-2">
          Shortcuts <Kbd>?</Kbd>
        </span>
        <span className="inline-flex items-center gap-2">
          Go to components <Kbd>G</Kbd> then <Kbd>C</Kbd>
        </span>
      </Specimen>
    </div>
  );
}

/* ─── Overlays ─────────────────────────────────────────────────────────── */

export function OverlaysDemo() {
  const person = PEOPLE[1]!;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Specimen label="Dialog, sheet and popover">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Approve requests</Button>
          </DialogTrigger>
          <DialogContent size="sm">
            <DialogHeader
              title="Approve 3 requests?"
              description="Arjun, Fatima and Daniel will be notified right away. You can still revoke an approval before the leave starts."
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Not yet</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  onClick={() =>
                    toast.success("3 requests approved", {
                      description: "Everyone has been notified.",
                    })
                  }
                >
                  <Check aria-hidden /> Approve all
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">
              <UserRound aria-hidden /> Preview profile
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader title={person.name} description={person.designation} />
            <SheetBody className="flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <Avatar name={person.name} size="lg" />
                <div className="flex flex-col gap-1.5">
                  <StatusPill tone="success">Active</StatusPill>
                  <span className="font-mono num text-small text-ink-muted">{person.code}</span>
                </div>
              </div>
              <DescriptionList
                columns={1}
                items={[
                  { term: "Department", detail: person.department },
                  { term: "Reports to", detail: "Priya Raman" },
                  { term: "Location", detail: person.location },
                  { term: "Joined", detail: format(parseISO(person.joined), "d MMMM yyyy") },
                  { term: "Leave balance", detail: `${person.leaveBalance} days` },
                ]}
              />
            </SheetBody>
            <SheetFooter>
              <Button variant="secondary" className="flex-1 sm:flex-none">
                <MessageSquare aria-hidden /> Message
              </Button>
              <Button className="flex-1 sm:flex-none">
                Open full profile <ArrowRight aria-hidden />
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary">
              <Clock aria-hidden /> Shift details
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <p className="text-heading font-semibold text-ink">General shift</p>
            <p className="mt-1 font-mono num text-small text-ink-muted">
              09:30 – 18:30 · 15 min grace
            </p>
            <p className="mt-3 text-small text-ink-muted">
              Arriving after 09:45 marks the day late. Three late days in a month count as half a
              day.
            </p>
          </PopoverContent>
        </Popover>
      </Specimen>

      <Specimen label="Menus and toasts">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="Row actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Arjun Mehta</DropdownMenuLabel>
            <DropdownMenuItem>
              <UserRound aria-hidden /> View profile
            </DropdownMenuItem>
            <DropdownMenuItem shortcut="E">
              <Pencil aria-hidden /> Edit details
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Download aria-hidden /> Download payslip
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem tone="danger">
              <LogIn aria-hidden className="rotate-180" /> Start offboarding
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="secondary"
          onClick={() =>
            toast.success("Leave approved", {
              description: "Arjun has been notified.",
              action: { label: "Undo", onClick: () => toast("Approval withdrawn") },
            })
          }
        >
          Success toast
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast.error("Couldn't save the policy", {
              description: "The connection dropped. Your changes are still here; try again.",
            })
          }
        >
          Error toast
        </Button>
      </Specimen>
    </div>
  );
}

/* ─── Navigation and content ───────────────────────────────────────────── */

export function ContentDemo() {
  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      <Card>
        <CardBody>
          <Tabs defaultValue="job">
            <TabsList aria-label="Profile sections">
              <TabsTrigger value="job">
                <Briefcase aria-hidden /> Job
              </TabsTrigger>
              <TabsTrigger value="activity">
                <Clock aria-hidden /> Activity
              </TabsTrigger>
              <TabsTrigger value="documents">
                <FileText aria-hidden /> Documents
              </TabsTrigger>
            </TabsList>
            <TabsContent value="job">
              <DescriptionList
                items={[
                  { term: "Designation", detail: "Senior Frontend Engineer" },
                  { term: "Department", detail: "Engineering · Platform" },
                  { term: "Employment", detail: "Full time" },
                  { term: "Employee ID", detail: "GRV-0018", mono: true },
                  { term: "Work location", detail: "Bengaluru office" },
                  { term: "Shift", detail: "General · 09:30–18:30" },
                ]}
              />
            </TabsContent>
            <TabsContent value="activity">
              <Timeline
                items={[
                  {
                    id: "1",
                    icon: CircleCheck,
                    tone: "success",
                    title: (
                      <>
                        Priya Raman <span className="text-ink-muted">approved</span> 2 days of
                        casual leave
                      </>
                    ),
                    at: "2026-10-27T10:42:00+05:30",
                    atLabel: "27 Oct 10:42",
                  },
                  {
                    id: "2",
                    icon: Send,
                    tone: "accent",
                    title: (
                      <>
                        Arjun <span className="text-ink-muted">requested</span> 4–5 Nov off
                      </>
                    ),
                    body: "Family wedding in Mysuru",
                    at: "2026-10-26T18:05:00+05:30",
                    atLabel: "26 Oct 18:05",
                  },
                  {
                    id: "3",
                    icon: Pencil,
                    title: (
                      <>
                        Rahul Deshpande <span className="text-ink-muted">updated</span> designation
                      </>
                    ),
                    body: "Frontend Engineer → Senior Frontend Engineer",
                    at: "2026-04-01T09:00:00+05:30",
                    atLabel: "1 Apr 09:00",
                  },
                ]}
              />
            </TabsContent>
            <TabsContent value="documents">
              <ul className="flex flex-col divide-y divide-hairline">
                {[
                  ["Offer letter.pdf", "Contract · 184 KB"],
                  ["Aadhaar (masked).pdf", "ID proof · 92 KB"],
                  ["Payslip – September 2026.pdf", "Payslip · 61 KB"],
                ].map(([name, meta]) => (
                  <li key={name} className="flex items-center gap-3 py-3">
                    <span className="grid size-9 place-items-center rounded-control bg-surface-sunken text-ink-muted">
                      <FileText className="size-4" aria-hidden />
                    </span>
                    <span className="flex-1">
                      <span className="block text-body text-ink">{name}</span>
                      <span className="block text-caption text-ink-subtle">{meta}</span>
                    </span>
                    <Button variant="ghost" size="icon-sm" aria-label={`Download ${name}`}>
                      <Download />
                    </Button>
                  </li>
                ))}
              </ul>
            </TabsContent>
          </Tabs>
        </CardBody>
      </Card>
      <Card className="flex flex-col">
        <CardHeader title="Calendar" description="Holidays in amber, teammates away in slate." />
        <CardBody className="flex justify-center">
          <Calendar
            mode="single"
            defaultMonth={new Date(2026, 10, 1)}
            holidays={holidays}
            conflicts={conflicts}
          />
        </CardBody>
      </Card>
    </div>
  );
}

/* ─── Progress, stats, tactile ─────────────────────────────────────────── */

export function ProgressDemo() {
  const [clockedIn, setClockedIn] = React.useState<Date | null>(null);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Specimen label="Stats" bodyClassName="flex-col items-start gap-6">
        <Stat
          variant="hero"
          label="Headcount"
          value={106}
          trend={{ direction: "up", label: "+4", good: true }}
          context="since July"
        />
        <div className="grid w-full grid-cols-2 gap-4">
          <Stat label="Open roles" value={7} />
          <Stat
            label="Attrition"
            value={8.4}
            format={(n) => n.toFixed(1)}
            suffix="%"
            trend={{ direction: "down", label: "1.2 pts", good: true }}
          />
        </div>
      </Specimen>
      <Specimen label="Progress" bodyClassName="flex-col items-stretch gap-5">
        <div className="flex items-center gap-5">
          <ProgressRing value={72} label="Onboarding 72% complete" size={72}>
            <span className="num text-small font-semibold text-ink">72%</span>
          </ProgressRing>
          <div>
            <p className="text-body font-medium text-ink">Rohan&apos;s onboarding</p>
            <p className="text-small text-ink-muted">13 of 18 tasks done · IT has 2 left</p>
          </div>
        </div>
        {[
          ["Casual leave", 4, 12, "accent"],
          ["Sick leave", 5, 7, "highlight"],
          ["Q4 hiring goal", 6, 9, "success"],
        ].map(([label, used, total, tone]) => (
          <div key={label as string}>
            <div className="mb-1.5 flex justify-between text-small">
              <span className="text-ink">{label}</span>
              <span className="num text-ink-muted">
                {used} of {total}
              </span>
            </div>
            <ProgressBar
              label={`${label}: ${used} of ${total}`}
              value={((used as number) / (total as number)) * 100}
              tone={tone as "accent" | "highlight" | "success"}
            />
          </div>
        ))}
      </Specimen>
      <Specimen
        label="Hold to confirm (clock in)"
        bodyClassName="flex-col justify-center gap-4 py-8"
      >
        <HoldButton
          label={clockedIn ? "Clock out" : "Clock in"}
          sublabel={clockedIn ? `since ${format(clockedIn, "HH:mm")}` : "Hold"}
          icon={clockedIn ? <X aria-hidden /> : <Plus aria-hidden />}
          tone={clockedIn ? "neutral" : "accent"}
          onConfirm={() => {
            const now = new Date();
            if (clockedIn) {
              toast.success(`Clocked out at ${format(now, "HH:mm")}`, {
                description: "Have a good evening.",
              });
              setClockedIn(null);
            } else {
              toast.success(`Clocked in at ${format(now, "HH:mm")}`, {
                description: "General shift · 09:30–18:30",
              });
              setClockedIn(now);
            }
          }}
        />
        <p className="max-w-56 text-center text-small text-ink-muted">
          Press and hold, or focus it and press Enter. Letting go early rewinds the ring.
        </p>
      </Specimen>
    </div>
  );
}
