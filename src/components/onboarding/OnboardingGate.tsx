// First-session flow orchestrator (BUILD PROMPT Section 3).
// Order: age gate → gameplay ToS. Research consent is NOT here — it is shown
// once AFTER the first completed session, and never blocks play (handled by the
// session-end flow, Section 4).
import { ReactNode } from "react";
import { useMe } from "@/lib/client/useMe";
import { AgeGate } from "./AgeGate";
import { ConsentScreen } from "./ConsentScreen";

export function OnboardingGate({ children }: { children: ReactNode }) {
  const { me, loading, refresh } = useMe();

  if (loading || !me) {
    return <div className="screen center dim" style={{ justifyContent: "center" }}>Resolving…</div>;
  }
  if (me.needsAgeGate) {
    return <AgeGate onDone={() => refresh()} />;
  }
  if (me.needsGameplayTos) {
    return <ConsentScreen type="gameplay_tos" onDone={() => refresh()} />;
  }
  return <>{children}</>;
}
