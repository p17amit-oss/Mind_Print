// Home. Onboarding gate → fog constellation + daily session flow.
import { useEffect } from "react";
import { useRouter } from "next/router";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { ConstellationHome } from "@/components/home/ConstellationHome";
import { track } from "@/lib/client/track";

export default function HomePage() {
  const router = useRouter();

  // Share landings carry ?v=<card_version>&s=<share_id> (Section 11).
  useEffect(() => {
    if (!router.isReady) return;
    const { v, s } = router.query;
    if (typeof v === "string" && typeof s === "string") {
      track("share_landing", { card_version: v, share_id: s });
    }
  }, [router.isReady, router.query]);

  return (
    <OnboardingGate>
      <ConstellationHome />
    </OnboardingGate>
  );
}
