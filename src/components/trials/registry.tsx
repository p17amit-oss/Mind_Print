// Trial registry — maps trial_type → playable component (build steps 3–4).
import type { ComponentType } from "react";
import type { TrialComponentProps } from "@/lib/engine/types";
import type { TrialType } from "@/lib/trials";
import { StubTrial } from "./StubTrial";
import { NeonStream } from "./NeonStream";
import { Impostor } from "./Impostor";
import { Heist } from "./Heist";
import { AlienRules } from "./AlienRules";
import { ReadRoom } from "./ReadRoom";
import { Fooled } from "./Fooled";

export const TRIAL_COMPONENTS: Record<TrialType, ComponentType<TrialComponentProps>> = {
  neon_stream: NeonStream,
  impostor: Impostor,
  heist: Heist,
  alien_rules: AlienRules,
  read_room: ReadRoom,
  fooled: Fooled,
};

export function getTrialComponent(type: TrialType): ComponentType<TrialComponentProps> {
  return TRIAL_COMPONENTS[type] ?? StubTrial;
}

export { StubTrial };
