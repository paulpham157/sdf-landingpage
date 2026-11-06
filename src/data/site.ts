/**
 * Site-wide facts. The mailbox is a placeholder until a real inbox is confirmed.
 * Change `email` here and every mailto link, footer line, and form follows.
 */
export const site = {
  name: "Software Decision Fabric",
  shortName: "SDF",
  url: "https://softwaredecisionfabric.tech",
  tagline: "The independent referee for coding agents.",
  email: "design-partners@softwaredecisionfabric.tech",
  emailIsPlaceholder: true,
  status:
    "SDF runs live only on a toy fixture. We are onboarding 3 to 5 design partners.",
} as const;

export const hero = {
  title: "Know which agent work actually shipped.",
  subhead:
    "SDF is the independent referee for coding agents. It verifies every agent attempt against your acceptance criteria and shows the cost of each accepted outcome, across every agent you run.",
  buyer:
    "For platform, security, or VP Engineering leaders running two or more coding agents.",
  primaryCta: "Become a design partner",
  secondaryCta: "See a sample Evidence Report",
} as const;

export const problem = {
  heading: "“Task complete” is a claim, not a result.",
  body: "Copilot, Cursor, Devin, and Factory each grade their own work. You pay per seat or per token, while the question that matters — did it work? — goes unanswered.",
  agents: ["Copilot", "Cursor", "Devin", "Factory"] as const,
} as const;

export const steps = [
  {
    id: "01",
    title: "Declare",
    body: "Declare the objective and acceptance criteria, linked to the business goal.",
  },
  {
    id: "02",
    title: "Route",
    body: "Route the task to any agent you already use. Bring your own subscriptions or keys.",
  },
  {
    id: "03",
    title: "Verify",
    body: "SDF runs independent checks the agent can't forge. PASS is tied to the exact code revision.",
  },
  {
    id: "04",
    title: "Record",
    body: "Every attempt, cost, and piece of evidence lands in an append-only Decision Graph you can audit.",
  },
] as const;

export const moat =
  "The record is hardened, evidence-gated verification in a Decision Graph that links objectives to attempts, cost, and evidence.";

export const pillars = [
  {
    title: "Vendor-neutral",
    body: "We don't sell an agent, so we have no reason to grade one up.",
  },
  {
    title: "Independently verifiable",
    body: "Evidence is re-runnable and revision-bound. Security and finance can check it without trusting us or the agent.",
  },
  {
    title: "Cost per acceptable outcome",
    body: "Compare agents on what you actually got: cost per accepted task, not seats or tokens.",
  },
] as const;

export const pricingIntro = {
  lede: "Priced per workspace and per verified outcome, never per seat.",
  unpublished:
    "Dollar amounts are intentionally unpublished until design partners validate them.",
} as const;

export const tiers = [
  {
    id: "hosted",
    name: "Hosted Team",
    for: "Teams running two or more coding agents",
    priceShape:
      "Monthly workspace fee with included verified Attempts, then a per-Attempt overage",
    agents: "Bring your own agent subscriptions or keys. SDF does not resell tokens.",
    evidence: "Evidence Report per task",
    deployment: "Hosted by SDF",
    identity: "Team roles",
    marketAnchor: "OpenHands $500/mo for 10 users; Factory $60 + seats",
    cta: "Join the design-partner program",
    href: "/design-partners?plan=hosted",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    for: "Platform, security, and regulated organizations",
    priceShape: "Annual platform fee plus verified-outcome volume",
    agents: "Same as Hosted Team, plus routing policy and budgets per org",
    evidence: "Signed Evidence Reports and export for audit",
    deployment: "Hosted, your VPC, or self-hosted",
    identity: "SSO (SAML/OIDC), SCIM",
    marketAnchor: "Factory $25k/yr fee; Ona $60k/yr commit (AWS listings)",
    cta: "Talk to us",
    href: "/design-partners?plan=enterprise",
  },
] as const;

export const compareRows = [
  { key: "for", label: "For" },
  { key: "priceShape", label: "Price shape" },
  { key: "agents", label: "Agents" },
  { key: "evidence", label: "Evidence" },
  { key: "deployment", label: "Deployment" },
  { key: "identity", label: "Identity" },
] as const;

export const faqs = [
  {
    q: "Why not per seat?",
    a: "Agents do the work, so seats undercount value and punish adoption.",
  },
  {
    q: "Do you resell model tokens?",
    a: "No. You keep your agent contracts. We bill for verification and the record.",
  },
  {
    q: "Can I self-host?",
    a: "On Enterprise, yes.",
  },
  {
    q: "Is SDF generally available?",
    a: "No. SDF runs live only on a toy fixture. The invitation on this site is a design-partner program for 3 to 5 platform teams, not a public rollout.",
  },
  {
    q: "Are the OpenHands, Factory, and Ona figures SDF prices?",
    a: "No. They are market anchors from public listings, shown so you can see how other products are priced. SDF dollar amounts are not published.",
  },
] as const;

export const onePager = {
  headline: "SDF: the independent referee for coding agents",
  sections: [
    {
      title: "Problem",
      body: "Coding agents grade their own work. Teams running several agents can't prove which work shipped or what each accepted result cost.",
    },
    {
      title: "Solution",
      body: "A vendor-neutral control plane that verifies every agent attempt with evidence the agent can't forge and records it in an auditable Decision Graph.",
    },
    {
      title: "Outcome",
      body: "One number to manage agent spend: cost per acceptable outcome, comparable across agents.",
    },
    {
      title: "Who it's for",
      body: "Platform, security, and engineering leaders running two or more coding agents.",
    },
    {
      title: "Model",
      body: "Hosted Team (workspace fee plus verified Attempts) and Enterprise (annual platform fee, VPC or self-host, SSO/SCIM). Dollar amounts are unpublished until design partners validate them.",
    },
  ],
  cta: "Become one of 3 to 5 design partners and baseline your cost per accepted task before and after SDF.",
} as const;

export const closing = {
  heading: "Become a design partner",
  body: "We're onboarding 3 to 5 platform teams already running two or more agents. Measure your cost per accepted task before and after SDF. Apply to be a design partner.",
} as const;

export const graphNodes = [
  { title: "Objective", detail: "Acceptance criteria, linked to the business goal" },
  { title: "Attempt", detail: "Routed to an agent you already use" },
  { title: "Evidence", detail: "Checks the agent cannot forge" },
  { title: "Verdict", detail: "Bound to the exact code revision" },
  { title: "Cost", detail: "Recorded on the same attempt" },
] as const;
