import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/shell/page-header";

import {
  ButtonsDemo,
  ContentDemo,
  DisplayDemo,
  FormDemo,
  OverlaysDemo,
  ProgressDemo,
  SelectionDemo,
} from "../_components/components-demos";
import { Section, SectionStack } from "../_components/showcase";

export const metadata: Metadata = { title: "Components" };

export default function ComponentsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Design system"
        title="Components"
        description="Accessible primitives from Radix, styled from scratch with Grove's tokens. Everything here is interactive."
      />
      <SectionStack>
        <Section
          id="buttons"
          title="Buttons"
          description="One primary action per view. The press settles a pixel, like a real key."
        >
          <ButtonsDemo />
        </Section>
        <Section
          id="forms"
          title="Forms"
          description="React Hook Form with Zod. The same schema validates on the server, so errors read the same in both places."
        >
          <FormDemo />
        </Section>
        <Section
          id="selection"
          title="Selection"
          description="Checkboxes, radios, switches, segmented controls and sliders."
        >
          <SelectionDemo />
        </Section>
        <Section
          id="display"
          title="Status, badges and people"
          description="Statuses map to tones in one place, so Pending looks the same on every screen."
        >
          <DisplayDemo />
        </Section>
        <Section
          id="overlays"
          title="Overlays"
          description="Dialogs confirm, sheets show detail without losing your place, menus hold row actions."
        >
          <OverlaysDemo />
        </Section>
        <Section id="content" title="Tabs, timeline and calendar">
          <ContentDemo />
        </Section>
        <Section
          id="progress"
          title="Numbers and progress"
          description="Numbers count up once, rings draw in. Reduced motion shows the final state immediately."
        >
          <ProgressDemo />
        </Section>
      </SectionStack>
    </PageContainer>
  );
}
