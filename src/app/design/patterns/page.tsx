import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/shell/page-header";

import {
  CelebrationDemo,
  EmptyStatesDemo,
  ErrorDemo,
  GreetingDemo,
  OptimisticDemo,
  SkeletonsDemo,
} from "../_components/patterns-demos";
import { Section, SectionStack } from "../_components/showcase";

export const metadata: Metadata = { title: "Patterns" };

export default function PatternsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Design system"
        title="Patterns"
        description="How screens behave when they're new, empty, loading, broken, or celebrating. Every page in Grove uses these instead of spinners and blank space."
      />
      <SectionStack>
        <Section
          id="greeting"
          title="Time-aware greeting"
          description="The home screen opens with the viewer's time of day and what matters today."
        >
          <GreetingDemo />
        </Section>
        <Section
          id="optimistic"
          title="Optimistic decisions"
          description="Approvals and check-ins update instantly, animate to explain what moved, and can be undone."
        >
          <OptimisticDemo />
        </Section>
        <Section
          id="empty"
          title="Empty states"
          description="Specific copy, a small icon composition, and one clear next step."
        >
          <EmptyStatesDemo />
        </Section>
        <Section
          id="error"
          title="Error states"
          description="Say what happened in plain words, reassure about data, and offer a way forward. Try the retry."
        >
          <ErrorDemo />
        </Section>
        <Section
          id="loading"
          title="Loading"
          description="Skeletons are shaped like the content they stand in for."
        >
          <SkeletonsDemo />
        </Section>
        <Section id="delight" title="Celebration">
          <CelebrationDemo />
        </Section>
      </SectionStack>
    </PageContainer>
  );
}
