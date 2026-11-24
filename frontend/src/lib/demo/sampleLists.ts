// Deterministic sample lead lists so the flow is clickable without a file.

import { hashString, mulberry32 } from "./agents";

const FIRST = [
  "Marcus", "Dana", "Priya", "Elena", "Tyrone", "Grace", "Owen", "Nadia",
  "Colin", "Rosa", "Hank", "Amara", "Jared", "Mei", "Douglas", "Sofia",
  "Ben", "Leila", "Victor", "Tessa", "Andre", "Karen", "Malik", "Ingrid",
  "Curtis", "Yara", "Pete", "Delia", "Ron", "Anika", "Gus", "Marta",
];

const LAST = [
  "Whitfield", "Okafor", "Ramos", "Lindqvist", "Brennan", "Castellanos",
  "Nakamura", "Feldman", "Osei", "Kowalski", "Duarte", "Hollis", "Vance",
  "Ibarra", "Sorensen", "Adeyemi", "Pruitt", "Marchetti", "Boyd", "Quinn",
  "Salazar", "Kirkland", "Emerson", "Novak", "Ferreira", "Haddad", "Strand",
  "Whitaker", "Delgado", "Ashford",
];

const CITIES: [string, string][] = [
  ["Austin", "TX"], ["Round Rock", "TX"], ["San Antonio", "TX"],
  ["Phoenix", "AZ"], ["Mesa", "AZ"], ["Tucson", "AZ"],
  ["Charlotte", "NC"], ["Raleigh", "NC"], ["Greensboro", "NC"],
  ["Columbus", "OH"], ["Cincinnati", "OH"], ["Toledo", "OH"],
  ["Atlanta", "GA"], ["Savannah", "GA"], ["Augusta", "GA"],
  ["Denver", "CO"], ["Colorado Springs", "CO"], ["Fort Collins", "CO"],
  ["Nashville", "TN"], ["Knoxville", "TN"], ["Chattanooga", "TN"],
  ["Jacksonville", "FL"], ["Orlando", "FL"], ["Tampa", "FL"],
  ["Kansas City", "MO"], ["St. Louis", "MO"], ["Springfield", "MO"],
  ["Boise", "ID"], ["Spokane", "WA"], ["Eugene", "OR"],
];

const COMPANIES = [
  "Harbor View Realty", "Lakeside Property Group", "Summit Roofing Co",
  "Bright Path Home Services", "Cedar & Oak Interiors", "Northline Contractors",
  "Meridian Property Mgmt", "Fairmont Builders", "Blue Heron Design",
  "Crossroads Home Repair", "Vantage Real Estate", "Old Town Remodeling",
];

const TITLES = [
  "Owner", "Property Manager", "Operations Lead", "Design Consultant",
  "Project Coordinator", "Director", "Managing Broker",
];

const SOURCES = [
  "google_search_quote",
  "facebook_ad",
  "home_improvement_newsletter",
  "contractor_referral",
  "comparison_site",
  "webinar_signup",
  "yelp_listing",
  "direct_mail_response",
  "pricing_page_visit",
  "before_after_gallery",
];

const STATUS = ["owner", "renter", "owner-occupier", "landlord", ""];

const DOMAINS = [
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com",
  "aol.com", "protonmail.com",
  "harborviewrealty.com", "lakesidepg.com", "summitroof.co",
  "brightpathhome.com", "cedarandoak.io", "northlinecontractors.net",
  "meridianpm.com", "fairmontbuilders.com", "blueherondesign.co",
  "crossroadshome.com", "vantagere.com", "oldtownremodel.com",
];

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

interface Row {
  first_name: string;
  last_name: string;
  email: string;
  city: string;
  state: string;
  company: string;
  job_title: string;
  homeowner_status: string;
  last_renovate_year: string;
  source: string;
}

const HEADER =
  "first_name,last_name,email,city,state,company,job_title,homeowner_status,last_renovate_year,source";

function esc(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function toCsv(rows: Row[]): string {
  const lines = [HEADER];
  for (const r of rows) {
    lines.push(
      [
        r.first_name,
        r.last_name,
        r.email,
        r.city,
        r.state,
        r.company,
        r.job_title,
        r.homeowner_status,
        r.last_renovate_year,
        r.source,
      ]
        .map((v) => esc(String(v ?? "")))
        .join(","),
    );
  }
  return lines.join("\n");
}

function buildRows(seed: number, count: number): Row[] {
  const r = mulberry32(hashString(`sample-${seed}`));
  const year = new Date().getFullYear();
  const rows: Row[] = [];
  const used = new Set<string>();

  for (let i = 0; i < count; i++) {
    const first = FIRST[Math.floor(r() * FIRST.length) % FIRST.length];
    const last = LAST[Math.floor(r() * LAST.length) % LAST.length];
    const [city, state] = CITIES[Math.floor(r() * CITIES.length) % CITIES.length];
    const domain = DOMAINS[Math.floor(r() * DOMAINS.length) % DOMAINS.length];
    const localStyle = r();
    const local =
      localStyle < 0.4
        ? `${first.toLowerCase()}.${last.toLowerCase()}`
        : localStyle < 0.7
          ? `${first.toLowerCase()}${last.toLowerCase()}`
          : `${first.charAt(0).toLowerCase()}${last.toLowerCase()}`;
    let email = `${local}@${domain}`;
    if (used.has(email)) email = `${local}${i}@${domain}`;
    used.add(email);

    const hasCompany = r() < 0.35;
    const renov = r() < 0.55 ? String(year - Math.floor(r() * 9)) : "";

    rows.push({
      first_name: first,
      last_name: last,
      email,
      city,
      state,
      company: hasCompany
        ? COMPANIES[Math.floor(r() * COMPANIES.length) % COMPANIES.length]
        : "",
      job_title: hasCompany
        ? TITLES[Math.floor(r() * TITLES.length) % TITLES.length]
        : "",
      homeowner_status: STATUS[Math.floor(r() * STATUS.length) % STATUS.length],
      last_renovate_year: renov,
      source: SOURCES[Math.floor(r() * SOURCES.length) % SOURCES.length],
    });
  }
  return rows;
}

// Junk rows that the relevance filter is meant to catch, so the numbers are real.
function junkRows(year: number): Row[] {
  const row = (
    first: string,
    last: string,
    email: string,
    city: string,
    state: string,
    source: string,
    renov = "",
  ): Row => ({
    first_name: first,
    last_name: last,
    email,
    city,
    state,
    company: "",
    job_title: "",
    homeowner_status: "owner",
    last_renovate_year: renov,
    source,
  });

  return [
    row("Grant", "Ellery", "grant.ellery@cityhomes.com", "Austin", "TX", "google_search_quote", String(year - 1)),
    row("", "", "not-an-email-address", "Mesa", "AZ", "facebook_ad"),
    row("", "", "broken@@domain", "Tucson", "AZ", "yelp_listing"),
    row("", "", "info@northlinecontractors.net", "Raleigh", "NC", "contractor_referral"),
    row("", "", "admin@lakesidepg.com", "Columbus", "OH", "comparison_site"),
    row("", "", "sales@oldtownremodel.com", "Denver", "CO", "pricing_page_visit"),
    row("", "", "support@brightpathhome.com", "Orlando", "FL", "webinar_signup"),
    row("", "", "noreply@harborviewrealty.com", "Atlanta", "GA", "home_improvement_newsletter"),
    row("Wendell", "Pike", "wendell.pike@mailinator.com", "Spokane", "WA", "before_after_gallery"),
    row("Ilona", "Frey", "ilona.frey@tempmail.com", "Boise", "ID", "google_search_quote"),
    row("Bram", "Toledo", "bram.toledo@yopmail.com", "Toledo", "OH", "direct_mail_response"),
    row("", "", "user4471@gmail.com", "Knoxville", "TN", "facebook_ad"),
    row("", "", "customer12@aol.com", "Tampa", "FL", "comparison_site"),
    row("", "", "test@preview.test", "Springfield", "MO", "webinar_signup"),
    row("", "", "qa@sample.invalid", "Eugene", "OR", "yelp_listing"),
    row("Petra", "Vance", "petra.vance@fairmontbuilders.com", "Savannah", "GA", "contractor_referral", String(year - 2)),
    row("Petra", "Vance", "petra.vance@fairmontbuilders.com", "Savannah", "GA", "contractor_referral", String(year - 2)),
    row("Nils", "Odegard", "nils.odegard@cedarandoak.io", "Augusta", "GA", "before_after_gallery"),
    row("Nils", "Odegard", "nils.odegard@cedarandoak.io", "Augusta", "GA", "before_after_gallery"),
  ];
}

export interface SampleLists {
  extractedCsv: string;
  validatedCsv: string;
  extractedFilename: string;
  validatedFilename: string;
}

export function buildSampleLists(): SampleLists {
  const year = new Date().getFullYear();
  const clean = buildRows(7, 58);
  const junk = junkRows(year);
  const extracted = [...clean, ...junk];

  // The validated list is what survived email verification: bad syntax,
  // disposable domains and unverifiable domains never make it through.
  const dropped = new Set([
    "not-an-email-address",
    "broken@@domain",
    "wendell.pike@mailinator.com",
    "ilona.frey@tempmail.com",
    "bram.toledo@yopmail.com",
    "test@preview.test",
    "qa@sample.invalid",
  ]);
  const validated = extracted.filter((r) => !dropped.has(r.email));

  return {
    extractedCsv: toCsv(extracted),
    validatedCsv: toCsv(validated),
    extractedFilename: "sample_extracted_leads.csv",
    validatedFilename: "sample_validated_leads.csv",
  };
}

export function buildSampleOffer() {
  return {
    name: "Bathroom Refresh Partner Program",
    url: "https://example.com/bathroom-refresh",
    payout: 1250,
    niche: "bathroom renovation",
  };
}

export { titleCase };
