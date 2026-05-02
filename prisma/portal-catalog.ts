/**
 * Solicitation portal catalog. Curated list of public bid / solicitation
 * portals across federal, state, county, municipal, and aggregator tiers.
 *
 * Idempotent — `upsertPortalCatalog()` keys on URL (which is @unique on
 * the model) so re-running adds new entries and updates existing ones
 * without disturbing user-created RfpSource subscriptions.
 *
 * The list deliberately leans toward portals construction GCs and
 * subs would actually pursue — public works, federal facilities,
 * state DOT bid lettings, large city procurements, plus the major
 * private aggregators contractors subscribe to.
 */

import type { AgencyKind, AgencyTier, PrismaClient, ScraperKind } from "@prisma/client";
import { SE_PORTAL_CATALOG } from "./portal-catalog-southeast";

export type PortalSeed = {
  name: string;
  url: string;
  category: string;
  agencyKind: AgencyKind;
  agencyTier: AgencyTier;
  agencyName?: string;
  geoScope: string;
  geoCity?: string;
  geoState?: string;
  authType?: string;
  signupUrl?: string;
  description: string;
  naicsFocus?: string;
  setAsideFocus?: string;
  scraperKind?: ScraperKind;
  scraperModule?: string;
};

export const PORTAL_CATALOG: PortalSeed[] = [
  // ─── Federal — civilian / GSA-wide ─────────────────────────────────
  { name: "SAM.gov — Contract Opportunities", url: "https://sam.gov/opportunities", category: "Federal master", agencyKind: "FEDERAL", agencyTier: "GSA", agencyName: "GSA / SAM.gov", geoScope: "FEDERAL", description: "Federal-wide contract opportunities. The single source of truth for federal solicitations >$25K.", naicsFocus: "236220, 237110, 237310", scraperKind: "API", scraperModule: "sam-gov" },
  { name: "GSA Forecast of Contracting Opportunities", url: "https://www.gsa.gov/sell-to-government/step-2-learn-about-government-contracting/find-government-buyers/forecast-of-contracting-opportunities", category: "Federal forecast", agencyKind: "FEDERAL", agencyTier: "GSA", agencyName: "General Services Administration", geoScope: "FEDERAL", description: "GSA's forward-looking forecast of upcoming acquisitions across PBS and FAS. Key for capture planning.", naicsFocus: "236220" },
  { name: "GSA eBuy", url: "https://www.ebuy.gsa.gov", category: "Federal task orders", agencyKind: "FEDERAL", agencyTier: "GSA", agencyName: "GSA eBuy", geoScope: "FEDERAL", authType: "LOGIN", description: "Task-order solicitations under GSA Schedules. Schedule holders only.", naicsFocus: "236220" },
  { name: "FedConnect", url: "https://www.fedconnect.net", category: "Federal grants + contracts", agencyKind: "FEDERAL", agencyTier: "CIVILIAN", agencyName: "FedConnect", geoScope: "FEDERAL", authType: "LOGIN", description: "Cross-agency portal for grants and contract opportunities; common at DOE, HHS, NRC.", naicsFocus: "236220" },
  { name: "USAJobs Hiring + Contractor Bench", url: "https://www.usajobs.gov", category: "Federal staffing", agencyKind: "FEDERAL", agencyTier: "CIVILIAN", agencyName: "OPM", geoScope: "FEDERAL", description: "Tracks staffing and contracting bench needs across agencies. Useful signal for upcoming construction support contracts.", naicsFocus: "541330" },

  // ─── DoD ───────────────────────────────────────────────────────────
  { name: "DoD Contract Announcements", url: "https://www.war.gov/News/Contracts/", category: "DoD daily awards", agencyKind: "FEDERAL", agencyTier: "DOD", agencyName: "Department of War (formerly Defense)", geoScope: "FEDERAL", description: "Daily DoD/DoW contract awards >$7.5M. Useful for win/loss intelligence. NOTE: as of 2026, RSS only teases; full award text is on Akamai-protected article pages, so server-side scraping is blocked. Marked MANUAL until upstream policy changes.", naicsFocus: "236220, 237310", scraperKind: "MANUAL" },
  { name: "USACE Contracting Opportunities", url: "https://www.usace.army.mil/Business-With-Us/Contracting", category: "DoD construction", agencyKind: "FEDERAL", agencyTier: "USACE", agencyName: "U.S. Army Corps of Engineers", geoScope: "FEDERAL", description: "USACE district-level construction opportunities. Each district publishes its own forecast in addition to SAM.gov.", naicsFocus: "236220, 237310, 237990" },
  { name: "NAVFAC Atlantic Construction", url: "https://www.navfac.navy.mil/Business-Lines/Capital-Improvements/", category: "DoD construction", agencyKind: "FEDERAL", agencyTier: "DOD", agencyName: "NAVFAC Atlantic", geoScope: "REGIONAL", geoState: "Multiple Atlantic states", description: "Naval Facilities Engineering Systems Command — Atlantic. Coastal facility construction + MILCON.", naicsFocus: "236220", setAsideFocus: "SDVOSB, 8(a), HUBZONE" },
  { name: "NAVFAC Pacific Construction", url: "https://www.navfac.navy.mil/Business-Lines/Capital-Improvements/Pacific/", category: "DoD construction", agencyKind: "FEDERAL", agencyTier: "DOD", agencyName: "NAVFAC Pacific", geoScope: "REGIONAL", description: "NAVFAC Pacific — Hawaii, Guam, mainland west coast, Asia-Pacific.", naicsFocus: "236220" },
  { name: "Air Force Civil Engineer Center (AFCEC)", url: "https://www.afcec.af.mil", category: "DoD construction", agencyKind: "FEDERAL", agencyTier: "DOD", agencyName: "Department of the Air Force", geoScope: "FEDERAL", description: "Air Force facility / infrastructure / environmental construction.", naicsFocus: "236220, 237110" },
  { name: "DLA Construction Solicitations", url: "https://www.dla.mil/HQ/Acquisition", category: "DoD logistics", agencyKind: "FEDERAL", agencyTier: "DOD", agencyName: "Defense Logistics Agency", geoScope: "FEDERAL", description: "Defense Logistics Agency facility upgrades, fuel storage, troop support construction.", naicsFocus: "236220" },
  { name: "Army Contracting Command (ACC)", url: "https://www.army.mil/acc", category: "DoD construction", agencyKind: "FEDERAL", agencyTier: "DOD", agencyName: "U.S. Army Contracting Command", geoScope: "FEDERAL", description: "ACC posts MATOC / MAC opportunities at Aberdeen, APG, Rock Island, and division boards.", naicsFocus: "236220" },

  // ─── VA ────────────────────────────────────────────────────────────
  { name: "VA Veterans Affairs Acquisition (VAAS)", url: "https://www.va.gov/oal/business/index.asp", category: "VA construction", agencyKind: "FEDERAL", agencyTier: "VA", agencyName: "Department of Veterans Affairs", geoScope: "FEDERAL", description: "VA medical center construction + facility renovation. Heavy SDVOSB preference.", naicsFocus: "236220, 238210", setAsideFocus: "SDVOSB" },
  { name: "VA eCMS — Electronic Contract Management System", url: "https://www.vendorportal.ecms.va.gov", category: "VA contract mgmt", agencyKind: "FEDERAL", agencyTier: "VA", agencyName: "VA eCMS", geoScope: "FEDERAL", authType: "LOGIN", description: "Vendor portal for VA contract submissions and document exchange.", naicsFocus: "236220" },

  // ─── Other federal ─────────────────────────────────────────────────
  { name: "DOE Construction Solicitations", url: "https://www.energy.gov/eere/funding/funding-opportunities", category: "Federal R&D + facilities", agencyKind: "FEDERAL", agencyTier: "ENERGY", agencyName: "Department of Energy", geoScope: "FEDERAL", description: "DOE national lab + EM facility construction. Notable for cleanup + decommissioning.", naicsFocus: "237120, 562910" },
  { name: "DHS Procurement Opportunities", url: "https://www.dhs.gov/how-do-i/find-contracting-opportunities", category: "DHS facilities", agencyKind: "FEDERAL", agencyTier: "HOMELAND", agencyName: "Department of Homeland Security", geoScope: "FEDERAL", description: "DHS, FEMA, USCG, ICE facility construction and disaster response infrastructure.", naicsFocus: "236220, 237310" },
  { name: "DOT Contracting + Procurement", url: "https://www.transportation.gov/mission/budget-and-performance/contracting-resources", category: "Federal transportation", agencyKind: "FEDERAL", agencyTier: "TRANSPORTATION", agencyName: "Department of Transportation", geoScope: "FEDERAL", description: "FAA, FHWA, FRA, MARAD federal-tier infrastructure. State DOT pass-throughs are listed separately.", naicsFocus: "237310, 237110" },
  { name: "HUD Building Programs", url: "https://www.hud.gov/program_offices/community_planning_and_development", category: "Federal housing", agencyKind: "FEDERAL", agencyTier: "CIVILIAN", agencyName: "Department of HUD", geoScope: "FEDERAL", description: "HUD-funded housing construction + rehabilitation programs (often through state HFAs).", naicsFocus: "236116, 236117" },
  { name: "FEMA Public Assistance + Construction", url: "https://www.fema.gov/assistance/public", category: "Federal disaster", agencyKind: "FEDERAL", agencyTier: "HOMELAND", agencyName: "FEMA", geoScope: "FEDERAL", description: "FEMA-funded disaster recovery construction. Surges after declared events; signal: monitor declarations.", naicsFocus: "236220, 237310" },

  // ─── State DOT bid lettings ────────────────────────────────────────
  { name: "SCDOT Bid Letting", url: "https://www.scdot.org/business/business-letting.aspx", category: "State DOT", agencyKind: "STATE", agencyTier: "TRANSPORTATION", agencyName: "South Carolina DOT", geoScope: "STATE", geoState: "SC", description: "SCDOT monthly bid lettings — roadway, bridge, paving, signing, signals.", naicsFocus: "237310" },
  { name: "FDOT Bidding & Contracting", url: "https://www.fdot.gov/contracts", category: "State DOT", agencyKind: "STATE", agencyTier: "TRANSPORTATION", agencyName: "Florida DOT", geoScope: "STATE", geoState: "FL", description: "Florida DOT statewide construction / maintenance contracts.", naicsFocus: "237310" },
  { name: "GDOT Construction Bidding", url: "https://www.dot.ga.gov/PartnerSmart/Business", category: "State DOT", agencyKind: "STATE", agencyTier: "TRANSPORTATION", agencyName: "Georgia DOT", geoScope: "STATE", geoState: "GA", description: "Georgia DOT bid lettings — interstate / freeway / paving / bridge.", naicsFocus: "237310" },
  { name: "NCDOT Contract Standards (legacy)", url: "https://www.ncdot.gov/doh/operations/dp_chief_eng/contracts", category: "State DOT", agencyKind: "STATE", agencyTier: "TRANSPORTATION", agencyName: "North Carolina DOT", geoScope: "STATE", geoState: "NC", description: "Old NC DOT URL — replaced by connect.ncdot.gov/letting (in SE catalog).", naicsFocus: "237310", scraperKind: "DEPRECATED" },
  { name: "TxDOT Construction & Maintenance", url: "https://www.txdot.gov/business.html", category: "State DOT", agencyKind: "STATE", agencyTier: "TRANSPORTATION", agencyName: "Texas DOT", geoScope: "STATE", geoState: "TX", description: "Texas statewide DOT bid lettings — one of the largest in the country.", naicsFocus: "237310" },
  { name: "Caltrans Local Assistance + Contracting", url: "https://dot.ca.gov/programs/procurement-and-contracts", category: "State DOT", agencyKind: "STATE", agencyTier: "TRANSPORTATION", agencyName: "California DOT", geoScope: "STATE", geoState: "CA", description: "Caltrans district-level construction bids; SoCal + Bay Area + Central Valley districts.", naicsFocus: "237310" },
  { name: "VDOT Contract Letting", url: "https://www.virginiadot.org/business/bus-default.asp", category: "State DOT", agencyKind: "STATE", agencyTier: "TRANSPORTATION", agencyName: "Virginia DOT", geoScope: "STATE", geoState: "VA", description: "Virginia DOT design-build + traditional bid letting.", naicsFocus: "237310" },
  { name: "NYSDOT Contract Bid Notices", url: "https://www.dot.ny.gov/doing-business/opportunities/notices", category: "State DOT", agencyKind: "STATE", agencyTier: "TRANSPORTATION", agencyName: "New York State DOT", geoScope: "STATE", geoState: "NY", description: "NYSDOT statewide construction notices.", naicsFocus: "237310" },

  // ─── State procurement portals ────────────────────────────────────
  { name: "California Cal eProcure", url: "https://caleprocure.ca.gov", category: "State procurement", agencyKind: "STATE", agencyTier: "CIVILIAN", agencyName: "State of California", geoScope: "STATE", geoState: "CA", description: "California state-wide procurement portal; covers DGS, CDCR, agency facilities.", naicsFocus: "236220" },
  { name: "Texas SmartBuy", url: "https://www.txsmartbuy.com", category: "State procurement", agencyKind: "STATE", agencyTier: "CIVILIAN", agencyName: "State of Texas", geoScope: "STATE", geoState: "TX", description: "Texas state-wide procurement; covers TFC, TDCJ, agency facilities.", naicsFocus: "236220" },
  { name: "MyFloridaMarketPlace", url: "https://vendor.myfloridamarketplace.com", category: "State procurement", agencyKind: "STATE", agencyTier: "CIVILIAN", agencyName: "State of Florida", geoScope: "STATE", geoState: "FL", authType: "LOGIN", description: "Florida statewide procurement portal.", naicsFocus: "236220" },
  { name: "Virginia eVA", url: "https://eva.virginia.gov", category: "State procurement", agencyKind: "STATE", agencyTier: "CIVILIAN", agencyName: "Commonwealth of Virginia", geoScope: "STATE", geoState: "VA", authType: "LOGIN", description: "Virginia eVA statewide procurement.", naicsFocus: "236220" },
  { name: "New York OGS Procurement", url: "https://ogs.ny.gov/procurement", category: "State procurement", agencyKind: "STATE", agencyTier: "CIVILIAN", agencyName: "NY Office of General Services", geoScope: "STATE", geoState: "NY", description: "New York Office of General Services — statewide buying.", naicsFocus: "236220" },
  { name: "SC Procurement Services (legacy)", url: "https://procurement.sc.gov/general/business", category: "State procurement", agencyKind: "STATE", agencyTier: "CIVILIAN", agencyName: "State of South Carolina", geoScope: "STATE", geoState: "SC", description: "Old SC procurement URL — replaced by procurement.sc.gov/vendor (in SE catalog).", naicsFocus: "236220", scraperKind: "DEPRECATED" },
  { name: "GA State Purchasing Department", url: "https://doas.ga.gov/state-purchasing", category: "State procurement", agencyKind: "STATE", agencyTier: "CIVILIAN", agencyName: "Georgia DOAS", geoScope: "STATE", geoState: "GA", description: "Georgia DOAS state purchasing.", naicsFocus: "236220" },
  { name: "NC Interactive Purchasing System (IPS, legacy)", url: "https://www.ips.state.nc.us", category: "State procurement", agencyKind: "STATE", agencyTier: "CIVILIAN", agencyName: "State of North Carolina", geoScope: "STATE", geoState: "NC", description: "IPS legacy portal — superseded by NC eProcurement (in SE catalog) for new solicitations.", naicsFocus: "236220", scraperKind: "DEPRECATED" },

  // ─── Authorities / quasi-government ────────────────────────────────
  { name: "MTA Capital Construction", url: "https://new.mta.info/doing-business-with-us", category: "Transit authority", agencyKind: "AUTHORITY", agencyTier: "TRANSPORTATION", agencyName: "NY MTA", geoScope: "REGIONAL", geoState: "NY", description: "NY Metropolitan Transportation Authority capital projects.", naicsFocus: "237310, 237990" },
  { name: "Port Authority of NY/NJ Procurement", url: "https://www.panynj.gov/business-opportunities", category: "Port authority", agencyKind: "AUTHORITY", agencyTier: "TRANSPORTATION", agencyName: "PANYNJ", geoScope: "REGIONAL", description: "Airports, tunnels, bridges, port facilities. Massive ongoing capital programs.", naicsFocus: "237990, 237310" },
  { name: "TVA Contracting", url: "https://www.tva.com/about-tva/doing-business-with-tva", category: "Federal authority", agencyKind: "AUTHORITY", agencyTier: "ENERGY", agencyName: "Tennessee Valley Authority", geoScope: "REGIONAL", description: "TVA dam, plant, and substation construction across the Southeast.", naicsFocus: "237130, 237990" },
  { name: "USPS Facilities Procurement", url: "https://about.usps.com/doing-business/contract-opportunities", category: "Federal authority", agencyKind: "AUTHORITY", agencyTier: "CIVILIAN", agencyName: "U.S. Postal Service", geoScope: "FEDERAL", description: "USPS post office construction + leasehold improvements.", naicsFocus: "236220" },

  // ─── Major county / municipal ─────────────────────────────────────
  { name: "City of Charleston Procurement", url: "https://www.charleston-sc.gov/bids.aspx", category: "Municipal", agencyKind: "MUNICIPAL", agencyTier: "CIVILIAN", agencyName: "City of Charleston, SC", geoScope: "CITY", geoCity: "Charleston", geoState: "SC", description: "City of Charleston bids and RFPs.", naicsFocus: "236220" },
  { name: "Charleston County Procurement", url: "https://www.charlestoncounty.org/departments/procurement", category: "County", agencyKind: "COUNTY", agencyTier: "CIVILIAN", agencyName: "Charleston County, SC", geoScope: "COUNTY", geoState: "SC", description: "Charleston County procurement portal.", naicsFocus: "236220" },
  { name: "City of Atlanta Procurement", url: "https://www.atlantaga.gov/government/departments/procurement", category: "Municipal", agencyKind: "MUNICIPAL", agencyTier: "CIVILIAN", agencyName: "City of Atlanta, GA", geoScope: "CITY", geoCity: "Atlanta", geoState: "GA", description: "Atlanta city construction and infrastructure procurement.", naicsFocus: "236220, 237310" },
  { name: "City of Houston Strategic Procurement", url: "https://purchasing.houstontx.gov/", category: "Municipal", agencyKind: "MUNICIPAL", agencyTier: "CIVILIAN", agencyName: "City of Houston, TX", geoScope: "CITY", geoCity: "Houston", geoState: "TX", description: "Houston citywide bids — large CIP program.", naicsFocus: "236220" },
  { name: "City of Los Angeles Business Assistance", url: "https://bca.lacity.org", category: "Municipal", agencyKind: "MUNICIPAL", agencyTier: "CIVILIAN", agencyName: "City of Los Angeles, CA", geoScope: "CITY", geoCity: "Los Angeles", geoState: "CA", description: "LA city bid opportunities.", naicsFocus: "236220" },
  { name: "City of New York Procurement (PPB)", url: "https://www.nyc.gov/site/mocs/index.page", category: "Municipal", agencyKind: "MUNICIPAL", agencyTier: "CIVILIAN", agencyName: "City of New York, NY", geoScope: "CITY", geoCity: "New York", geoState: "NY", description: "NYC citywide procurement (Mayor's Office of Contract Services).", naicsFocus: "236220" },
  { name: "Miami-Dade County Procurement", url: "https://www.miamidade.gov/global/government/procurement/home.page", category: "County", agencyKind: "COUNTY", agencyTier: "CIVILIAN", agencyName: "Miami-Dade County, FL", geoScope: "COUNTY", geoState: "FL", description: "Miami-Dade County construction + services procurement.", naicsFocus: "236220" },
  { name: "Cook County Office of the CPO", url: "https://www.cookcountyil.gov/agency/office-chief-procurement-officer", category: "County", agencyKind: "COUNTY", agencyTier: "CIVILIAN", agencyName: "Cook County, IL", geoScope: "COUNTY", geoState: "IL", description: "Cook County, IL procurement (Chicago metro).", naicsFocus: "236220" },
  { name: "King County Procurement", url: "https://kingcounty.gov/depts/finance-business-operations/procurement", category: "County", agencyKind: "COUNTY", agencyTier: "CIVILIAN", agencyName: "King County, WA", geoScope: "COUNTY", geoState: "WA", description: "King County, WA procurement (Seattle metro).", naicsFocus: "236220" },
  { name: "Maricopa County Procurement", url: "https://www.maricopa.gov/5615/Procurement-Services", category: "County", agencyKind: "COUNTY", agencyTier: "CIVILIAN", agencyName: "Maricopa County, AZ", geoScope: "COUNTY", geoState: "AZ", description: "Maricopa County, AZ procurement (Phoenix metro).", naicsFocus: "236220" },
  { name: "Harris County Purchasing", url: "https://purchasing.harriscountytx.gov", category: "County", agencyKind: "COUNTY", agencyTier: "CIVILIAN", agencyName: "Harris County, TX", geoScope: "COUNTY", geoState: "TX", description: "Harris County, TX procurement (Houston metro).", naicsFocus: "236220" },

  // ─── Aggregators ───────────────────────────────────────────────────
  { name: "BidNet Direct", url: "https://www.bidnetdirect.com", category: "Aggregator", agencyKind: "AGGREGATOR", agencyTier: "OTHER", agencyName: "BidNet", geoScope: "NATIONAL", authType: "LOGIN", signupUrl: "https://www.bidnetdirect.com/register", description: "Aggregator covering hundreds of state and local agencies. Subscription-based.", naicsFocus: "236220" },
  { name: "BidContract", url: "https://www.bidcontract.com", category: "Aggregator", agencyKind: "AGGREGATOR", agencyTier: "OTHER", geoScope: "NATIONAL", authType: "LOGIN", description: "Government bid aggregator — domain unreachable from probe; marked deprecated until verified.", naicsFocus: "236220", scraperKind: "DEPRECATED" },
  { name: "Dodge Construction Network", url: "https://www.construction.com", category: "Aggregator", agencyKind: "AGGREGATOR", agencyTier: "OTHER", geoScope: "NATIONAL", authType: "LOGIN", signupUrl: "https://www.construction.com/products/dodge-data-analytics/", description: "Dodge — private + public project intelligence. Covers pre-bid plan rooms.", naicsFocus: "236220" },
  { name: "ConstructConnect", url: "https://www.constructconnect.com", category: "Aggregator", agencyKind: "AGGREGATOR", agencyTier: "OTHER", geoScope: "NATIONAL", authType: "LOGIN", description: "ConstructConnect / iSqFt — bid management + project leads.", naicsFocus: "236220" },
  { name: "PlanHub", url: "https://www.planhub.com", category: "Aggregator", agencyKind: "AGGREGATOR", agencyTier: "OTHER", geoScope: "NATIONAL", authType: "LOGIN", description: "PlanHub bid management for sub + GC matching.", naicsFocus: "236220" },
  { name: "Building Connected", url: "https://www.buildingconnected.com", category: "Aggregator", agencyKind: "AGGREGATOR", agencyTier: "OTHER", geoScope: "NATIONAL", authType: "LOGIN", description: "Autodesk's Building Connected — invitation-based bid network for GCs.", naicsFocus: "236220" },
];

export async function upsertPortalCatalog(prisma: PrismaClient): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  const allEntries = [...PORTAL_CATALOG, ...SE_PORTAL_CATALOG].map(applyDefaultScraper);
  for (const p of allEntries) {
    const existing = await prisma.solicitationPortalCatalog.findUnique({ where: { url: p.url } });
    const data = {
      name: p.name,
      category: p.category,
      agencyKind: p.agencyKind,
      agencyTier: p.agencyTier,
      agencyName: p.agencyName,
      geoScope: p.geoScope,
      geoCity: p.geoCity,
      geoState: p.geoState,
      authType: p.authType ?? "NONE",
      signupUrl: p.signupUrl,
      description: p.description,
      naicsFocus: p.naicsFocus,
      setAsideFocus: p.setAsideFocus,
      scraperKind: p.scraperKind ?? ("MANUAL" as ScraperKind),
      scraperModule: p.scraperModule ?? null,
    };
    if (existing) {
      await prisma.solicitationPortalCatalog.update({ where: { url: p.url }, data });
      updated += 1;
    } else {
      await prisma.solicitationPortalCatalog.create({ data: { url: p.url, ...data } });
      created += 1;
    }
  }
  return { created, updated };
}

/**
 * Apply scraper defaults so we don't have to mark every catalog row
 * by hand. Rules:
 *
 *   - If scraperKind is already set on the row, leave it alone.
 *   - Federal agencies whose solicitations show up on SAM.gov default
 *     to scraperKind=API, scraperModule=sam-gov. The SAM scraper
 *     filters by organizationName so each row gets agency-scoped
 *     listings. Auth-walled federal portals (eBuy, FedConnect, eCMS)
 *     opt out by setting an explicit scraperKind.
 *   - DoD daily contract awards (defense.gov) gets the defense-news
 *     scraper since it has its own RSS feed.
 *   - Everything else stays MANUAL until an explicit scraper exists.
 */
function applyDefaultScraper(p: PortalSeed): PortalSeed {
  if (p.scraperKind) return p;
  if (p.agencyKind === "FEDERAL" && p.authType !== "LOGIN") {
    return { ...p, scraperKind: "API", scraperModule: "sam-gov" };
  }
  // We previously defaulted every state DOT to generic-html, but
  // verify-html-scrapers showed only 1 of 15 actually returns tables
  // (the rest are SPAs or moved URLs). Auto-defaulting was misleading
  // — operators saw "auto · html" badges on portals that never
  // worked. Now state DOTs default MANUAL; individual rows opt in
  // via explicit scraperKind once verified by scripts/verify-html-
  // scrapers.ts.
  return p;
}
