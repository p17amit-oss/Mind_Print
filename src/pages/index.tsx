// Home. In Step 1 this is a minimal shell behind the onboarding gate; Step 7
// replaces the inner content with the fog constellation + daily session flow.
import Link from "next/link";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { ConstellationHome } from "@/components/home/ConstellationHome";

export default function HomePage() {
  return (
    <OnboardingGate>
      <ConstellationHome />
    </OnboardingGate>
  );
}

// Re-exported for direct linking in dev.
export { Link };
