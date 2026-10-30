import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { PDF } from "@/lib/pdf-theme";

import { clockLabel } from "./logic/metrics";
import type { AttendanceReport, HiringReport, LeaveReport, PeopleReport } from "./queries";

const pct = (r: number, d = 1) => `${(r * 100).toFixed(d)}%`;
const days = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const s = StyleSheet.create({
  page: { padding: 44, fontFamily: "Helvetica", fontSize: 9.5, color: PDF.ink },
  eyebrow: { fontSize: 8, color: PDF.inkSubtle, textTransform: "uppercase", letterSpacing: 1 },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 3 },
  sub: { fontSize: 10, color: PDF.inkMuted, marginTop: 4 },
  tiles: { flexDirection: "row", gap: 10, marginTop: 18 },
  tile: { flex: 1, backgroundColor: PDF.surfaceSunken, borderRadius: 6, padding: 10 },
  tileValue: { fontSize: 17, fontFamily: "Helvetica-Bold", color: PDF.accent, marginTop: 3 },
  h2: { fontSize: 12.5, fontFamily: "Helvetica-Bold", marginTop: 22, marginBottom: 6 },
  note: { fontSize: 8.5, color: PDF.inkMuted, marginBottom: 6 },
  th: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: PDF.ink,
    paddingBottom: 4,
    fontSize: 7.5,
    color: PDF.inkSubtle,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 3.5,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF.hairline,
  },
  c1: { flex: 2 },
  c: { flex: 1, textAlign: "right" },
  foot: {
    position: "absolute",
    bottom: 26,
    left: 44,
    right: 44,
    fontSize: 7.5,
    color: PDF.inkSubtle,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <View>
      <View style={s.th}>
        {head.map((h, i) => (
          <Text key={h} style={i === 0 ? s.c1 : s.c}>
            {h}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={s.row} wrap={false}>
          {r.map((v, j) => (
            <Text key={j} style={j === 0 ? s.c1 : s.c}>
              {String(v)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.tile}>
      <Text style={s.eyebrow}>{label}</Text>
      <Text style={s.tileValue}>{value}</Text>
    </View>
  );
}

export function ReportDocument({
  company,
  scope,
  period,
  people,
  leave,
  attendance,
  hiring,
}: {
  company: string;
  scope: string;
  period: string;
  people: PeopleReport;
  leave: LeaveReport;
  attendance: AttendanceReport;
  hiring: HiringReport;
}) {
  const a = people.attrition;
  return (
    <Document title={`People report, ${period}`} author={company}>
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>{company}</Text>
        <Text style={s.title}>People report</Text>
        <Text style={s.sub}>
          {period} · {scope}
        </Text>

        <View style={s.tiles}>
          <Tile label="Headcount" value={String(a.closing)} />
          <Tile label="Joined" value={String(people.joiners)} />
          <Tile label="Left" value={String(a.leavers)} />
          <Tile label="Attrition, annualized" value={pct(a.annualized)} />
        </View>

        <Text style={s.h2}>Headcount</Text>
        <Table
          head={["Period", "Headcount", "Joined", "Left"]}
          rows={people.series.map((p) => [p.label, p.headcount, p.joiners, p.leavers])}
        />

        <Text style={s.h2}>By department</Text>
        <Table
          head={["Department", "People"]}
          rows={people.departments.map((d) => [d.key, d.value])}
        />

        {people.reasons.length > 0 && (
          <>
            <Text style={s.h2}>Why people left</Text>
            <Table head={["Reason", "People"]} rows={people.reasons.map((r) => [r.reason, r.n])} />
          </>
        )}

        <Text style={s.h2}>Time off</Text>
        <Text style={s.note}>
          {days(leave.total)} approved working days across {leave.people} people.
        </Text>
        <Table
          head={["Leave type", "Days"]}
          rows={leave.types.map((t) => [t.name, days(t.days)])}
        />

        <Text style={s.h2}>Attendance</Text>
        <Table
          head={["Measure", "Value"]}
          rows={[
            ["Days worked", attendance.days],
            ["On time", pct(attendance.onTime)],
            [
              "Typical arrival",
              attendance.averageArrival == null ? "n/a" : clockLabel(attendance.averageArrival),
            ],
            [
              "Average day",
              attendance.averageHours == null ? "n/a" : `${attendance.averageHours.toFixed(1)} h`,
            ],
          ]}
        />

        <Text style={s.h2}>Hiring</Text>
        <Text style={s.note}>
          {hiring.hires} hired · {hiring.openRoles} open roles ({hiring.openings} seats) ·{" "}
          {hiring.daysToHire == null
            ? "no hires to time"
            : `typical time to hire ${Math.round(hiring.daysToHire)} days`}
        </Text>
        <Table
          head={["Stage", "Candidates", "From previous"]}
          rows={hiring.funnel.map((f) => [
            f.stage[0] + f.stage.slice(1).toLowerCase(),
            f.count,
            f.conversion == null ? "" : pct(f.conversion, 0),
          ])}
        />

        <View style={s.foot} fixed>
          <Text>Generated by Grove from demo data.</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
