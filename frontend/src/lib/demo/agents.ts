// The five client-facing agents, simulated in-browser so the whole flow is
// clickable without the live pipeline. Deterministic: same input, same output.

export interface Offer {
  id: string;
  name: string;
  url: string;
  payout: number;
  niche: string;
}

export interface Lead {
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  city: string;
  state: string;
  company: string;
  job_title: string;
  homeowner_status: string;
  last_renovate_year: string;
  source: string;
}

export type BuyerStage = "Decision" | "Comparison" | "Awareness";

export interface Avatar {
  stage: BuyerStage;
  reason: string;
}

export interface FilterLayer {
  name: string;
  removed: number;
  flagged: number;
}

export interface FilterResult {
  kept: Lead[];
  removed: { email: string; layer: string }[];
  layers: FilterLayer[];
  flaggedFreeProvider: number;
}

export interface KeywordRow {
  keyword: string;
  intent: "High" | "Medium";
  volume: number;
  cpc: number;
  cluster: string;
}

export interface EmailRow {
  email: string;
  first_name: string;
  last_name: string;
  city: string;
  state: string;
  company: string;
  buyer_stage: string;
  avatar_reason: string;
  icebreaker: string;
  keyword: string;
  sequence_number: number;
  day: number;
  subject_a: string;
  subject_b: string;
  email_body: string;
}

/* ---------------------------------- prng ---------------------------------- */

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pickOne = <T,>(arr: T[], r: () => number): T =>
  arr[Math.floor(r() * arr.length) % arr.length];

/* ----------------------------- column mapping ----------------------------- */

const canon = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");

const CANDIDATES: Record<keyof Lead, string[]> = {
  email: [
    "email",
    "emailaddress",
    "mail",
    "contactemail",
    "useremail",
    "workemail",
    "primaryemail",
    "email1",
    "emailaddresswork",
  ],
  first_name: [
    "firstname",
    "first",
    "givenname",
    "fname",
    "contactfirstname",
    "firstnamelastname",
  ],
  last_name: ["lastname", "last", "surname", "lname", "contactlastname"],
  full_name: ["fullname", "name", "contactname", "displayname", "leadname"],
  city: ["city", "town", "location", "cityname", "contactcity"],
  state: ["state", "province", "region", "st", "statecode", "stateorprovince"],
  company: [
    "company",
    "companyname",
    "organization",
    "org",
    "accountname",
    "businessname",
  ],
  job_title: ["jobtitle", "title", "position", "role", "job", "contacttitle"],
  homeowner_status: [
    "homeownerstatus",
    "homeowner",
    "ownership",
    "ownrent",
    "propertytype",
    "residencestatus",
  ],
  last_renovate_year: [
    "lastrenovateyear",
    "lastrenovated",
    "renovated",
    "renovyear",
    "projectyear",
    "lastprojectyear",
    "yearoflastrenovation",
  ],
  source: [
    "source",
    "leadsource",
    "channel",
    "origin",
    "campaign",
    "acquisitionchannel",
  ],
};

function pickField(raw: Record<string, string>, key: keyof Lead): string {
  const candidates = CANDIDATES[key];
  const entries = Object.entries(raw);
  for (const [k, v] of entries) {
    if (candidates.includes(canon(k)) && v && v.trim() !== "") return v.trim();
  }
  for (const [k, v] of entries) {
    const c = canon(k);
    if (!v || v.trim() === "") continue;
    if (candidates.some((cand) => c.includes(cand) || cand.includes(c))) {
      return v.trim();
    }
  }
  return "";
}

function titleCase(s: string): string {
  return s
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function nameFromEmail(email: string): { first: string; last: string } {
  const local = (email.split("@")[0] ?? "").toLowerCase();
  const parts = local.split(/[._\-+\d]+/).filter((p) => /^[a-z]{2,}$/.test(p));
  return {
    first: parts[0] ? titleCase(parts[0]) : "",
    last: parts[1] ? titleCase(parts[1]) : "",
  };
}

export function normalizeLead(raw: Record<string, string>): Lead {
  const email = pickField(raw, "email").toLowerCase();
  let first = pickField(raw, "first_name");
  let last = pickField(raw, "last_name");
  if (!first || !last) {
    const fromEmail = nameFromEmail(email);
    first = first || fromEmail.first;
    last = last || fromEmail.last;
  }
  const full =
    pickField(raw, "full_name") || [first, last].filter(Boolean).join(" ");
  return {
    email,
    first_name: first,
    last_name: last,
    full_name: full,
    city: pickField(raw, "city"),
    state: pickField(raw, "state"),
    company: pickField(raw, "company"),
    job_title: pickField(raw, "job_title"),
    homeowner_status: pickField(raw, "homeowner_status"),
    last_renovate_year: pickField(raw, "last_renovate_year"),
    source: pickField(raw, "source"),
  };
}

/* ------------------------- 1. Keyword Intelligence ------------------------ */

const NICHE_KEYWORDS: Record<string, string[]> = {
  bathroom: [
    "bathroom remodel cost",
    "walk in tub installation",
    "tub to shower conversion",
    "small bathroom renovation ideas",
    "bathroom remodel near me",
    "luxury bathroom refresh",
  ],
  window: [
    "window replacement cost",
    "energy efficient windows",
    "double pane window prices",
    "bay window installation",
    "window replacement near me",
    "vinyl window frames",
  ],
  roof: [
    "roof replacement cost",
    "emergency roof repair",
    "shingle roof lifespan",
    "roof inspection near me",
    "metal roofing prices",
    "storm damage roof repair",
  ],
  kitchen: [
    "kitchen remodel cost",
    "kitchen cabinet refacing",
    "small kitchen renovation ideas",
    "kitchen island installation",
    "countertop replacement cost",
    "kitchen remodel near me",
  ],
  solar: [
    "solar panel cost",
    "solar tax credit eligibility",
    "home battery backup",
    "solar lease vs buy",
    "solar installers near me",
    "reduce electric bill solar",
  ],
  siding: [
    "house siding cost",
    "vinyl siding replacement",
    "fiber cement siding",
    "siding repair near me",
    "exterior remodel ideas",
    "insulated siding benefits",
  ],
  flooring: [
    "hardwood floor installation",
    "luxury vinyl plank cost",
    "flooring replacement near me",
    "waterproof flooring options",
    "carpet removal cost",
    "flooring before and after",
  ],
  hvac: [
    "hvac system replacement cost",
    "ductless mini split install",
    "furnace repair near me",
    "heat pump tax credit",
    "central air installation",
    "smart thermostat upgrade",
  ],
  plumbing: [
    "water heater replacement",
    "tankless water heater cost",
    "whole house repiping",
    "leak detection service",
    "drain camera inspection",
    "plumber near me",
  ],
  painting: [
    "interior painting cost",
    "exterior house painting",
    "cabinet painting services",
    "painter near me",
    "whole home repaint estimate",
    "popcorn ceiling removal",
  ],
};

const HIGH_INTENT = ["cost", "near me", "quotes", "pricing", "installation", "for sale"];
const MED_INTENT = ["ideas", "reviews", "before and after", "best", "how to", "checklist"];

export function runKeywordIntelligence(offer: Offer): KeywordRow[] {
  const niche = (offer.niche || "").toLowerCase();
  const key = Object.keys(NICHE_KEYWORDS).find((k) => niche.includes(k));
  const base = key
    ? NICHE_KEYWORDS[key]
    : buildFromNiche(niche || "home improvement");

  const r = mulberry32(hashString(offer.id + offer.niche));
  return base.map((keyword, i) => {
    const high = HIGH_INTENT.some((m) => keyword.includes(m));
    return {
      keyword,
      intent: (high ? "High" : "Medium") as "High" | "Medium",
      volume: 400 + Math.floor(r() * 14000),
      cpc: Math.round((1.1 + r() * 13.4) * 100) / 100,
      cluster: i < 3 ? "Buyer stage" : i < 5 ? "Consideration" : "Local intent",
    };
  });
}

function buildFromNiche(niche: string): string[] {
  const clean = niche.replace(/[^a-z ]/g, "").trim() || "home improvement";
  return MED_INTENT.map((m) => `${clean} ${m}`);
}

/* --------------------------- 2. Customer Avatar --------------------------- */

export function classifyLead(
  lead: Lead,
  nowYear = new Date().getFullYear(),
): Avatar {
  const year = parseInt(lead.last_renovate_year, 10);
  if (!Number.isNaN(year) && year >= nowYear - 2 && year <= nowYear + 1) {
    return { stage: "Decision", reason: `Renovation activity in ${year}` };
  }
  const src = lead.source.toLowerCase();
  if (/(quote|pricing|estimate|buy|order|request|consult)/.test(src)) {
    return { stage: "Decision", reason: "Asked for a quote or price" };
  }
  if (/(compare|research|review|webinar|guide|newsletter|comparison)/.test(src)) {
    return { stage: "Comparison", reason: "Comparing options" };
  }
  if (lead.company || lead.job_title) {
    return { stage: "Comparison", reason: "Business contact gathering options" };
  }
  if (/own/i.test(lead.homeowner_status)) {
    return { stage: "Awareness", reason: "Owner, no buying signal yet" };
  }
  return { stage: "Awareness", reason: "No buying signal captured" };
}

export function runCustomerAvatar(leads: Lead[]): {
  avatars: Record<string, Avatar>;
  distribution: Record<BuyerStage, number>;
} {
  const avatars: Record<string, Avatar> = {};
  const distribution: Record<BuyerStage, number> = {
    Decision: 0,
    Comparison: 0,
    Awareness: 0,
  };
  for (const lead of leads) {
    const a = classifyLead(lead);
    avatars[lead.email] = a;
    distribution[a.stage] += 1;
  }
  return { avatars, distribution };
}

/* -------------------------- 3. Relevance Filter --------------------------- */

const ROLE_PREFIXES = [
  "info",
  "admin",
  "sales",
  "support",
  "hello",
  "contact",
  "no-reply",
  "noreply",
  "postmaster",
  "abuse",
  "webmaster",
  "help",
  "office",
  "reception",
  "billing",
  "service",
  "team",
  "hr",
  "jobs",
  "careers",
  "marketing",
  "accounts",
];

const DISPOSABLE = [
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "yopmail.com",
  "throwawaymail.com",
  "sharklasers.com",
  "getnada.com",
  "trashmail.com",
  "fakeinbox.com",
];

const FREE_PROVIDERS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
  "protonmail.com",
  "proton.me",
  "live.com",
  "msn.com",
];

const BAD_TLDS = [".test", ".invalid", ".example", ".local", ".localhost"];

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const GENERIC_LOCAL = /^(user|customer|client|lead|contact|person|admin|test|dev|sample)\d*$/i;

export const FILTER_LAYERS = [
  "Layer 1 — syntax check",
  "Layer 2 — role & shared mailboxes",
  "Layer 3 — disposable domains",
  "Layer 4 — free-provider flag",
  "Layer 5 — duplicates",
  "Layer 6 — unusable contact name",
  "Layer 7 — unverifiable domain",
];

export function runRelevanceFilter(leads: Lead[]): FilterResult {
  const removed: { email: string; layer: string }[] = [];
  const counts: Record<string, { removed: number; flagged: number }> = {};
  for (const l of FILTER_LAYERS) counts[l] = { removed: 0, flagged: 0 };

  const seen = new Set<string>();
  const kept: Lead[] = [];

  for (const lead of leads) {
    const email = lead.email.trim();
    const domain = (email.split("@")[1] ?? "").toLowerCase();
    const local = (email.split("@")[0] ?? "").toLowerCase();

    if (!EMAIL_RE.test(email)) {
      counts[FILTER_LAYERS[0]].removed++;
      removed.push({ email: email || "(blank)", layer: FILTER_LAYERS[0] });
      continue;
    }
    if (ROLE_PREFIXES.includes(local)) {
      counts[FILTER_LAYERS[1]].removed++;
      removed.push({ email, layer: FILTER_LAYERS[1] });
      continue;
    }
    if (DISPOSABLE.includes(domain)) {
      counts[FILTER_LAYERS[2]].removed++;
      removed.push({ email, layer: FILTER_LAYERS[2] });
      continue;
    }
    if (FREE_PROVIDERS.includes(domain)) counts[FILTER_LAYERS[3]].flagged++;
    if (seen.has(email)) {
      counts[FILTER_LAYERS[4]].removed++;
      removed.push({ email, layer: FILTER_LAYERS[4] });
      continue;
    }
    if (!lead.first_name || GENERIC_LOCAL.test(local)) {
      counts[FILTER_LAYERS[5]].removed++;
      removed.push({ email, layer: FILTER_LAYERS[5] });
      continue;
    }
    if (BAD_TLDS.some((t) => domain.endsWith(t))) {
      counts[FILTER_LAYERS[6]].removed++;
      removed.push({ email, layer: FILTER_LAYERS[6] });
      continue;
    }

    seen.add(email);
    kept.push(lead);
  }

  return {
    kept,
    removed,
    layers: FILTER_LAYERS.map((name) => ({
      name,
      removed: counts[name].removed,
      flagged: counts[name].flagged,
    })),
    flaggedFreeProvider: counts[FILTER_LAYERS[3]].flagged,
  };
}

/* ----------------------------- 4. Icebreaker ------------------------------ */

export function runIcebreaker(
  lead: Lead,
  offer: Offer,
  seedSalt = "",
): string {
  const r = mulberry32(hashString(lead.email + offer.id + seedSalt));
  const first = lead.first_name || "there";
  const city = lead.city || "your area";
  const niche = offer.niche || "your project";
  const year = lead.last_renovate_year || "recently";
  const company = lead.company;

  const templates = [
    `Hi ${first} — I saw you'd been looking into ${niche} around ${city}. Most folks there are hitting the same snag right now.`,
    `Hi ${first}, quick one: homeowners in ${city} have been asking us about ${niche} since ${year}. Thought it might be useful to you too.`,
    `Hi ${first} — ${city} has had a run of ${niche} jobs lately, and yours looked like the kind worth a proper look.`,
    company
      ? `Hi ${first}, I was looking at ${company} and wondered whether ${niche} was on the list for this year.`
      : `Hi ${first}, no pitch yet — I just wanted to check whether ${niche} was still on your radar.`,
    `Hi ${first}, the last ${niche} job we ran in ${city} finished under budget, and it made me think of your enquiry.`,
  ];
  return pickOne(templates, r);
}

/* ---------------------------- 5. AI Copywriter ---------------------------- */

interface Ctx {
  first: string;
  city: string;
  niche: string;
  offer: string;
  payout: string;
  url: string;
  icebreaker: string;
  keyword: string;
  stage: string;
}

const BEATS = [
  { day: 0, angle: "Direct offer" },
  { day: 2, angle: "Social proof" },
  { day: 4, angle: "Cost objection" },
  { day: 7, angle: "Case study" },
  { day: 10, angle: "Availability" },
  { day: 14, angle: "What to check" },
  { day: 18, angle: "Financing" },
  { day: 23, angle: "Personal check-in" },
  { day: 29, angle: "Deadline" },
  { day: 36, angle: "Breakup" },
];

function subjectFor(ctx: Ctx, i: number): { a: string; b: string } {
  const { first, city, niche, offer } = ctx;
  const pairs = [
    { a: `${first}, quick question on ${niche}`, b: `${niche} in ${city}` },
    { a: `3 ${city} homes did this last month`, b: `Is ${niche} still on your list?` },
    { a: `${niche}: what it actually costs`, b: `${first}, before you get 3 quotes` },
    { a: `The ${city} job that finished early`, b: `Worth 4 minutes, ${first}?` },
    { a: `Two ${niche} slots left this month`, b: `${first}, can I hold one?` },
    { a: `5 things to check before hiring`, b: `${niche} checklist — ${city}` },
    { a: `No upfront cost, ${first}`, b: `Financing ${niche} in ${city}` },
    { a: `${first} — still thinking it over?`, b: `Did my last note land?` },
    { a: `Closes Friday: ${offer}`, b: `${first}, last call on this` },
    { a: `Should I stop emailing you?`, b: `Closing your file, ${first}` },
  ];
  return pairs[i] ?? pairs[0];
}

function bodyFor(ctx: Ctx, i: number): string {
  const { first, city, niche, offer, payout, url, icebreaker, keyword } = ctx;
  const sign = `\n\n— Income Engine\n${url}`;

  switch (i) {
    case 0:
      return `${icebreaker}

Here's the short version: we run ${offer} for homeowners in ${city}. If you go ahead, the referral payout on our side is ${payout}, which is exactly why we can spend real time on your quote instead of churning it out.

If you'd like me to line up ${niche} in ${city}, just reply "yes" and I'll send two dates.`;
    case 1:
      return `${first}, three houses within about a mile of yours went through this in the last month. Two of them had already got two quotes and still chose us.

The reason they gave was the same each time: someone actually turned up and checked the ${niche} properly before quoting.`;
    case 2:
      return `Most people stall on price, and that's fair.

So here's the honest frame: ${niche} in ${city} usually lands in a band, and the difference between the cheap quote and the right one is almost always what's left out of the scope. I'd rather walk you through that band in five minutes than have you pick blind.

Reply "cost" and I'll send the range for ${city}.`;
    case 3:
      return `A quick one, ${first}.

A homeowner near ${city} came to us after a quote that looked great on paper and then grew by a third. We re-scoped it, and the finished job came in under the original number.

Happy to show you the before/after so you can judge whether your own quote is holding up.`;
    case 4:
      return `${first}, I've got two ${niche} slots left in ${city} this month, and I'd rather offer them to someone already looking than fill them cold.

Want me to hold one while you decide? Reply "hold" and it's yours for 48 hours.`;
    case 5:
      return `Before you sign anything for ${niche}, check these five:

1. Is waste removal in the price?
2. Who actually does the work — employee or subcontractor?
3. What's covered if something goes wrong in year two?
4. Are permits included?
5. Is the quote fixed, or an estimate?

If any of those are missing from your quote, send it over and I'll tell you what I'd push back on.`;
    case 6:
      return `${first}, cost shouldn't be the reason this waits another year.

There's a financing route on ${offer} that spreads it monthly, and for most ${city} homes the payment is smaller than the bill you're already paying to keep the old setup going.

Want the monthly number for your situation?`;
    case 7:
      return `Hi ${first}, I don't want to be the email you keep skipping.

If ${niche} isn't happening this year, tell me and I'll stop. If it is, reply with a week that suits and I'll do the rest.

Either answer is fine — I just need one.`;
    case 8:
      return `${first}, this is the last one I'll send on the current offer.

The ${offer} terms close Friday. After that the payout and the priority scheduling both change, and I can't pull them back.

If you want in, reply "in" today and I'll handle the paperwork.`;
    default:
      return `${first}, I'll close your file today so you stop hearing from me.

If ${niche} in ${city} comes back on the table later, just reply to this email — it'll land with me directly, not a shared inbox.

Wishing you a good one.`;
  }
}

export function runCopywriter(
  lead: Lead,
  offer: Offer,
  avatar: Avatar,
  keyword: string,
  seedSalt = "",
): EmailRow[] {
  const icebreaker = runIcebreaker(lead, offer, seedSalt);
  const ctx: Ctx = {
    first: lead.first_name || "there",
    city: lead.city || "your area",
    niche: offer.niche || "your project",
    offer: offer.name || "the offer",
    payout: offer.payout ? `$${offer.payout.toLocaleString()}` : "a set payout",
    url: offer.url || "https://example.com/offer",
    icebreaker,
    keyword,
    stage: avatar.stage,
  };

  return BEATS.map((beat, i) => {
    const s = subjectFor(ctx, i);
    return {
      email: lead.email,
      first_name: lead.first_name,
      last_name: lead.last_name,
      city: lead.city,
      state: lead.state,
      company: lead.company,
      buyer_stage: avatar.stage,
      avatar_reason: avatar.reason,
      icebreaker,
      keyword,
      sequence_number: i + 1,
      day: beat.day,
      subject_a: s.a,
      subject_b: s.b,
      email_body: bodyFor(ctx, i),
    };
  });
}

export const PIPELINE_STEPS = [
  "Keyword Intelligence",
  "Customer Avatar",
  "Relevance Filter",
  "Icebreaker",
  "AI Copywriter",
];
