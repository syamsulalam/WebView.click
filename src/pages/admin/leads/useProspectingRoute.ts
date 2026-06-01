import { useMemo } from "react";
import { useLocalStorageState } from "../../../lib/localStorageState";

export default function useProspectingRoute() {
  const [prospectingState, setProspectingState] = useLocalStorageState("webview.adminLeads.prospectingState", "TX");
  const [prospectingCity, setProspectingCity] = useLocalStorageState("webview.adminLeads.prospectingCity", "Dallas");
  const [prospectingNiche, setProspectingNiche] = useLocalStorageState("webview.adminLeads.prospectingNiche", "concrete contractor");
  const [prospectingProgressRaw, setProspectingProgressRaw] = useLocalStorageState("webview.adminLeads.prospectingProgress", "{}");

  const prospectingProgress = useMemo(() => {
    try {
      return JSON.parse(prospectingProgressRaw || "{}") as Record<string, Record<string, boolean>>;
    } catch {
      return {};
    }
  }, [prospectingProgressRaw]);

  const progressKey = `${prospectingState}:${prospectingCity}:${prospectingNiche}`;
  const currentProgress = prospectingProgress[progressKey] || {};

  const setProgressStep = (key: string, checked: boolean) => {
    setProspectingProgressRaw(JSON.stringify({
      ...prospectingProgress,
      [progressKey]: { ...currentProgress, [key]: checked },
    }));
  };

  return {
    prospectingState,
    setProspectingState,
    prospectingCity,
    setProspectingCity,
    prospectingNiche,
    setProspectingNiche,
    currentProgress,
    setProgressStep,
  };
}
