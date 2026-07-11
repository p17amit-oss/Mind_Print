// Trial registry — maps trial_type → playable component (build steps 3–4).
// Step 3 wires every slot to StubTrial so the shell is exercisable; Step 4
// replaces each entry with its real trial component.
import type { ComponentType } from "react";
import type { TrialComponentProps } from "@/lib/engine/types";
import type { TrialType } from "@/lib/trials";
import { StubTrial } from "./StubTrial";

export const TRIAL_COMPONENTS: Record<TrialType, ComponentType<TrialComponentProps>> = {
  neon_stream: StubTrial,
  impostor: StubTrial,
  heist: StubTrial,
  alien_rules: StubTrial,
  read_room: StubTrial,
  fooled: StubTrial,
};

export function getTrialComponent(type: TrialType): ComponentType<TrialComponentProps> {
  return TRIAL_COMPONENTS[type] ?? StubTrial;
}
