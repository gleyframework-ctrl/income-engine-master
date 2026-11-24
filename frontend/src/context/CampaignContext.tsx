import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

export interface MergeResult {
  matched: number;
  unmatched: number;
  preview: unknown[];
}

export interface CampaignState {
  offerId: string | null;
  fileId: string | null;
  jobId: string | null;
  extractedFileId: string | null;
  validatedFileId: string | null;
  keywords: unknown[] | null;
  emails: unknown[] | null;
  hasCsv: boolean;
  isLoading: boolean;
  mergeStatus: "idle" | "processing" | "complete" | "error";
  mergeResult: MergeResult | null;
}

const defaultState: CampaignState = {
  offerId: null,
  fileId: null,
  jobId: null,
  extractedFileId: null,
  validatedFileId: null,
  keywords: null,
  emails: null,
  hasCsv: true,
  isLoading: false,
  mergeStatus: "idle",
  mergeResult: null,
};

const STORAGE_KEY = "ie_campaign_state";

const CampaignContext = createContext<{
  state: CampaignState;
  setState: React.Dispatch<React.SetStateAction<CampaignState>>;
  reset: () => void;
}>({
  state: defaultState,
  setState: () => {},
  reset: () => {},
});

export const CampaignProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<CampaignState>(defaultState);

  // Hydrate from localStorage after mount (SSR-safe).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...defaultState, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const reset = () => setState(defaultState);

  return (
    <CampaignContext.Provider value={{ state, setState, reset }}>
      {children}
    </CampaignContext.Provider>
  );
};

export const useCampaign = () => useContext(CampaignContext);
