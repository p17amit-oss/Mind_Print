import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { ConsentState } from "../server/consent-store";

export interface MeResponse {
  user: {
    id: string;
    age_band: string | null;
    is_adult: boolean | null;
    region: string | null;
  };
  consent: ConsentState;
  needsAgeGate: boolean;
  needsGameplayTos: boolean;
}

export function useMe() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await api<MeResponse>("/api/me");
    setMe(data);
    setLoading(false);
    return data;
  }, []);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);

  return { me, loading, refresh };
}
