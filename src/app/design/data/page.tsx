import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/shell/page-header";

import { ChartsDemo, TableDemo } from "../_components/data-demos";
import { Section, SectionStack } from "../_components/showcase";

export const metadata: Metadata = { title: "Data & charts" };

export default function DataPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Design system"
        title="Data & charts"
        description="Tables built on TanStack Table with sorting, selection, keyboard navigation and density. Charts share one axis, grid and tooltip style, and every chart can switch to a plain table."
      />
      <SectionStack>
        <Section
          id="table"
          title="Data table"
          description="Filter it, sort a column, select a few rows to reveal bulk actions, or switch to compact."
        >
          <TableDemo />
        </Section>
        <Section
          id="charts"
          title="Charts"
          description="Single series use the accent alone; categories follow the chart palette in order."
        >
          <ChartsDemo />
        </Section>
      </SectionStack>
    </PageContainer>
  );
}
