import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { PDF } from "@/lib/pdf-theme";

import type { PayslipDetail } from "./queries";

/**
 * Standard PDF fonts have no rupee sign, so amounts read "INR 1,00,000"
 * rather than showing a missing-glyph box.
 */
const inr = (minor: number) =>
  `INR ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(minor / 100)}`;

const s = StyleSheet.create({
  page: { padding: 44, fontFamily: "Helvetica", fontSize: 10, color: PDF.ink },
  banner: {
    backgroundColor: PDF.highlightSubtle,
    color: PDF.highlightInk,
    padding: 6,
    borderRadius: 4,
    fontSize: 8.5,
    marginBottom: 22,
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontSize: 20, fontFamily: "Helvetica-Bold", color: PDF.accent },
  company: { fontSize: 8.5, color: PDF.inkMuted, marginTop: 3 },
  title: { fontSize: 9, color: PDF.inkSubtle, textTransform: "uppercase", letterSpacing: 1 },
  period: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 3, textAlign: "right" },
  who: {
    marginTop: 26,
    backgroundColor: PDF.surfaceSunken,
    borderRadius: 6,
    padding: 14,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: { width: "33%", marginBottom: 9 },
  label: { fontSize: 8, color: PDF.inkSubtle, textTransform: "uppercase", letterSpacing: 0.6 },
  value: { marginTop: 2, fontSize: 10.5 },
  tables: { marginTop: 24, flexDirection: "row", gap: 22 },
  table: { flex: 1 },
  th: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: PDF.ink,
    paddingBottom: 5,
    fontSize: 8,
    color: PDF.inkSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF.hairline,
  },
  muted: { color: PDF.inkSubtle, fontSize: 8, marginTop: 1 },
  total: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 7,
    fontFamily: "Helvetica-Bold",
  },
  net: {
    marginTop: 26,
    backgroundColor: PDF.accent,
    color: PDF.white,
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  netValue: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  foot: {
    position: "absolute",
    bottom: 30,
    left: 44,
    right: 44,
    fontSize: 8,
    color: PDF.inkSubtle,
  },
});

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.cell}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

export function PayslipDocument({ slip }: { slip: PayslipDetail }) {
  const earnings = slip.lines.filter((l) => l.kind === "EARNING");
  const deductions = slip.lines.filter((l) => l.kind === "DEDUCTION");
  const prorated = slip.paidDays < slip.workingDays;
  return (
    <Document title={`Payslip ${slip.label} ${slip.employee.name}`} author={slip.company}>
      <Page size="A4" style={s.page}>
        <Text style={s.banner}>
          Simulated payroll. This payslip is generated from demo data and has no legal or financial
          standing.
        </Text>
        <View style={s.head}>
          <View>
            <Text style={s.brand}>Grove</Text>
            <Text style={s.company}>{slip.company}</Text>
          </View>
          <View>
            <Text style={[s.title, { textAlign: "right" }]}>Payslip</Text>
            <Text style={s.period}>{slip.label}</Text>
          </View>
        </View>

        <View style={s.who}>
          <Cell label="Employee" value={slip.employee.name} />
          <Cell label="Employee ID" value={slip.employee.code} />
          <Cell label="Designation" value={slip.employee.title} />
          <Cell label="Department" value={slip.employee.department} />
          <Cell label="Location" value={slip.employee.location} />
          <Cell label="Paid days" value={`${slip.paidDays} of ${slip.workingDays}`} />
        </View>

        <View style={s.tables}>
          <View style={s.table}>
            <View style={s.th}>
              <Text>Earnings</Text>
              <Text>Amount</Text>
            </View>
            {earnings.map((l) => (
              <View key={l.name} style={s.row}>
                <View>
                  <Text>{l.name}</Text>
                  {prorated && l.fullMinor !== l.amountMinor && (
                    <Text style={s.muted}>Full month {inr(l.fullMinor)}</Text>
                  )}
                </View>
                <Text>{inr(l.amountMinor)}</Text>
              </View>
            ))}
            <View style={s.total}>
              <Text>Gross earnings</Text>
              <Text>{inr(slip.grossMinor)}</Text>
            </View>
          </View>
          <View style={s.table}>
            <View style={s.th}>
              <Text>Deductions</Text>
              <Text>Amount</Text>
            </View>
            {deductions.length === 0 && (
              <View style={s.row}>
                <Text style={{ color: PDF.inkSubtle }}>None this month</Text>
                <Text>{inr(0)}</Text>
              </View>
            )}
            {deductions.map((l) => (
              <View key={l.name} style={s.row}>
                <Text>{l.name}</Text>
                <Text>{inr(l.amountMinor)}</Text>
              </View>
            ))}
            <View style={s.total}>
              <Text>Total deductions</Text>
              <Text>{inr(slip.deductionsMinor)}</Text>
            </View>
          </View>
        </View>

        <View style={s.net}>
          <View>
            <Text style={{ fontSize: 8.5, opacity: 0.85 }}>NET PAY</Text>
            <Text style={{ fontSize: 8.5, opacity: 0.85, marginTop: 2 }}>
              Gross less deductions
            </Text>
          </View>
          <Text style={s.netValue}>{inr(slip.netMinor)}</Text>
        </View>

        <Text style={s.foot} fixed>
          Computer generated, no signature needed. Questions? Write to people@northwindgrove.in.
        </Text>
      </Page>
    </Document>
  );
}
