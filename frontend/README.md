# Campaign Current

This is the **"Trillion-Parameter" Architectural Prompt**.

It is engineered to solve your specific fear: **disconnected features**. Most AI builders create "pages" in isolation. This prompt forces Bolt.new to build a **State-Machine-Driven Application** where every button, guard, and UI element is mathematically bound to a single source of truth (`CampaignContext`).

This prompt includes the **full, verbatim code** for the core logic layer (API, State, Hooks) so Bolt cannot hallucinate them, while giving precise architectural directives for the pages to ensure they talk to each other perfectly.

### 💎 THE ULTIMATE "ZERO-ERROR" FRONTEND PROMPT
*(Copy everything inside the code block below into your new Bolt.new session)*

```text
# PROJECT: Income Engine — State-Driven Production MVP
# ROLE: Principal Frontend Architect
# DIRECTIVE: Build a Vite + React + TS + Tailwind app where ALL features are 
#            mathematically bound to a single state machine. ZERO disconnected UI.
# CRITICAL: DO NOT INTERPRET. EXECUTE VERBATIM CODE BELOW.

## 1. CORE ARCHITECTURE (CREATE THESE FILES EXACTLY)

=== FILE: src/lib/api.ts ===
const API = import.meta.env.VITE_API_BASE_URL;
if (!API) throw new Error('VITE_API_BASE_URL missing');
interface ApiResponse<T> { status: 'success'|'error'; data: T; message?: string; }
export async function apiCall<T>(method:'GET'|'POST'|'PUT'|'DELETE', path:string, body?:unknown|FormData, isFormData=false): Promise<T> {
  const token = localStorage.getItem('sb-auth-token');
  const headers: HeadersInit = {};
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: isFormData ? (body as FormData) : (body ? JSON.stringify(body) : undefined) });
  const json: ApiResponse<T> = await res.json();
  if (!res.ok || json.status === 'error') throw new Error(json.message || `API Error: ${res.status}`);
  return json.data;
}
export async function downloadFile(path:string, filename:string) {
  const token = localStorage.getItem('sb-auth-token');
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob(); const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); window.URL.revokeObjectURL(url);
}

=== FILE: src/context/CampaignContext.tsx ===
import React, { createContext, useContext, useState, useEffect } from 'react';
interface CampaignState { 
  offerId:string|null; fileId:string|null; jobId:string|null; 
  extractedFileId:string|null; validatedFileId:string|null; 
  keywords:any[]|null; emails:any[]|null; hasCsv:boolean; 
  isLoading:boolean; mergeStatus:'idle'|'processing'|'complete'|'error'; 
  mergeResult:{matched:number;unmatched:number;preview:any[]}|null; 
}
const defaultState: CampaignState = { 
  offerId:null,fileId:null,jobId:null,extractedFileId:null,validatedFileId:null,
  keywords:null,emails:null,hasCsv:true,isLoading:false,mergeStatus:'idle',mergeResult:null 
};
const CampaignContext = createContext<{state:CampaignState;setState:React.Dispatch<React.SetStateAction<CampaignState>>}>({state:defaultState,setState:()=>{}});
export const CampaignProvider = ({children}:{children:React.ReactNode}) => {
  const [state, setState] = useState<CampaignState>(() => { 
    const s = localStorage.getItem('ie_campaign_state'); 
    return s ? JSON.parse(s) : defaultState; 
  });
  useEffect(() => { localStorage.setItem('ie_campaign_state', JSON.stringify(state)); }, [state]);
  return <CampaignContext.Provider value={{state,setState}}>{children}</CampaignContext.Provider>;
};
export const useCampaign = () => useContext(CampaignContext);

=== FILE: src/hooks/usePolling.ts ===
import { useState, useEffect, useRef } from 'react';
export function usePolling<T>(fetchFn:()=>Promise<T>, shouldContinue:(d:T)=>boolean, onComplete:(d:T)=>void, interval=2000) {
  const [data, setData] = useState<T|null>(null); const [isPolling, setIsPolling] = useState(false); const mountedRef = useRef(true);
  useEffect(() => { if (!isPolling) return; let timeout:NodeJS.Timeout;
    const poll = async () => { try { const r = await fetchFn(); if (!mountedRef.current) return; setData(r);
      if (shouldContinue(r)) timeout = setTimeout(poll, interval); else { onComplete(r); setIsPolling(false); }
    } catch { setIsPolling(false); } }; poll();
    return () => { mountedRef.current = false; clearTimeout(timeout); };
  }, [isPolling, fetchFn, shouldContinue, onComplete, interval]);
  return { data, isPolling, start:()=>setIsPolling(true), stop:()=>setIsPolling(false) };
}

=== FILE: src/index.css ===
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap');
@tailwind base; @tailwind components; @tailwind utilities;
:root {
  --bg-primary: #0F1117; --bg-surface: #171A21; --bg-elevated: #1E222C;
  --border-subtle: #2A2E38; --gold: #E8C547; --gold-hover: #F3D66B;
  --cyan: #4FD1E8; --purple: #8B7FE8; --text-primary: #F5F5F5;
  --text-secondary: #9CA3AF; --success: #34D399; --error: #F87171;
}
body { background-color: var(--bg-primary); color: var(--text-primary); font-family: 'Inter', sans-serif; }
h1,h2,h3,h4,h5,h6 { font-family: 'Space Grotesk', sans-serif; }
.font-mono { font-family: 'JetBrains Mono', monospace; }
.btn-gold { @apply px-4 py-2 rounded-md font-medium transition-all duration-200; background-color: var(--gold); color: #0F1117; }
.btn-gold:hover:not(:disabled) { background-color: var(--gold-hover); box-shadow: 0 0 15px var(--gold-glow); }
.btn-gold:disabled { opacity: 0.5; cursor: not-allowed; }
@keyframes pulse-cyan { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(79,209,232,0.7)} 50%{opacity:0.8;box-shadow:0 0 0 6px rgba(79,209,232,0)} }
.dot-cyan { width:8px;height:8px;border-radius:50%;background-color:var(--cyan);animation:pulse-cyan 2s infinite; }

## 2. STATE-BINDING DIRECTIVES FOR PAGES
DO NOT create standalone pages. Every page MUST read/write to CampaignContext.
Guards must be DERIVED from state, not hardcoded.

### /offer → Writes: offerId
- Form: Name, URL, Payout, Niche
- Submit: POST /api/offers → setState({offerId: result.id})
- Guard: If state.offerId exists → show success banner + "Create New" (sets offerId=null)

### /upload → Reads: offerId | Writes: extractedFileId, validatedFileId, mergeStatus, mergeResult
- HARD GUARD: If !state.offerId → redirect to /offer
- Upload Zone 1: "Extracted List" → POST /api/upload → setState({extractedFileId})
- FEATURE A: "Prepare for Validation" button ONLY if state.extractedFileId && !state.validatedFileId
  → POST /api/prepare-validation → trigger downloadFile()
- Upload Zone 2: "Validated List" → POST /api/upload → setState({validatedFileId})
- FEATURE B: "Merge Lists" button ONLY if state.extractedFileId && state.validatedFileId && state.mergeStatus!=='complete'
  → POST /api/merge → setState({mergeStatus:'complete', mergeResult: result})
- Navigation to /pipeline DISABLED unless state.mergeStatus==='complete'

### /pipeline → Reads: offerId, mergeStatus | Writes: jobId
- HARD GUARD: If !state.offerId || state.mergeStatus!=='complete' → redirect to /upload
- "Start Pipeline" → POST /api/process → setState({jobId}) → start polling
- FEATURE C: When state.jobId exists → replace button with progress bar:
  * Gold fill width={pollData.progress}%
  * Mono label: pollData.current_step
  * Auto-navigate to /results when pollData.status==='completed'

### /results → Reads: jobId | Writes: emails
- HARD GUARD: If !state.jobId → redirect to /pipeline
- Auto-fetch: GET /api/results/{state.jobId} → setState({emails})
- FEATURE D: "Download CSV" button ONLY if state.emails?.length > 0
  → downloadFile(`/api/download/${state.jobId}`, `results_${state.jobId}.csv`)

### /analytics → Reads: nothing (independent)
- Auto-fetch: GET /api/analytics
- FEATURE E: Empty state = "No campaigns completed yet. Run your first pipeline to see analytics."
- NO RETRY BUTTON in empty state

### /settings → Independent
- SMTP: Host, Port, Username, Password, From Email
- API Keys: MiniMax, OpenAI (collapsible)
- Save: POST /api/settings → toast notification

## 3. LAYOUT REQUIREMENTS
- Sidebar: 5 steps + Settings + Logout
- Status dots derived from context: Gray=null, Cyan=polling, Gold=set
- Top-right: Monospace badges showing state.offerId / state.fileId / state.jobId
- DEV MODE banner at top

## 4. EXECUTION RULES
1. Create core files VERBATIM first
2. Build pages that IMPORT and USE CampaignContext exclusively
3. Run: npm install @supabase/supabase-js react-router-dom lucide-react
4. Create .env.local with VITE_API_BASE_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
5. Fix TS errors WITHOUT breaking state bindings
6. ZERO mock data. ZERO hardcoded guards. ZERO disconnected components.
```

---

### 🧠 WHY THIS IS "TRILLION-PARAMETER" BETTER

| Previous Failure Mode | How This Prompt Eliminates It |
| :--- | :--- |
| Pages didn't talk to each other | All pages bound to single `CampaignContext` state machine |
| Merge button appeared randomly | Conditional rendering tied to `extractedFileId && validatedFileId` |
| Pipeline started without merge | Hard guard checks `mergeStatus==='complete'` before allowing access |
| Features worked in isolation | Every feature writes to shared state that unlocks next step |
| AI simplified complex logic | Core files provided verbatim - no interpretation allowed |
| Guards were visual only | Guards are derived from state AND enforced via redirects |
| Polling was decorative | Polling result directly triggers navigation via `onComplete` callback |
| Settings were generic | Exact field list + payload structure specified |

### ⚡ WHAT MAKES THIS "SMART" NOT "COMPLEX"

-   **No unnecessary abstractions**: Just Context + API + Hooks
-   **No over-engineering**: No Redux, no Zustand, no GraphQL
-   **No premature optimization**: Simple localStorage persistence
-   **No speculative features**: Only what backend supports TODAY
-   **State derives UI**: Not the other way around

This prompt creates a **self-correcting system** where it's architecturally impossible to have disconnected features because every component reads from and writes to the same source of truth.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/37fb72d3-4977-473c-b0b3-0ed4cfc9286d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
