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

/** Public name of the wedge metric. Do not paraphrase this on the site. */
export const wedgeMetric = "Cost per Accepted Outcome";

export const hero = {
  title: "Know which agent work actually shipped.",
  subhead:
    "SDF is the independent referee for coding agents. It verifies every agent attempt against your acceptance criteria and shows Cost per Accepted Outcome, across every agent you run.",
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

export const verifiedAttempt =
  "A verified Attempt is a recorded run whose evidence was checked independently of the agent that produced it, against criteria that run did not get to choose.";

export const costPerAcceptedOutcome =
  "Cost per Accepted Outcome is what you spend on work whose result a named principal actually accepted, not what you spend per seat, per session, or per agent claiming a task is done.";

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
    title: "Cost per Accepted Outcome",
    body: "Compare agents on what you actually got: Cost per Accepted Outcome, not seats or tokens.",
    note: verifiedAttempt,
    outcome: costPerAcceptedOutcome,
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
    q: "What is a verified Attempt?",
    a: verifiedAttempt,
  },
  {
    q: "What is Cost per Accepted Outcome?",
    a: costPerAcceptedOutcome,
  },
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
    a: "No. They are coding-agent list prices, shown so you can see how those products are sold. OpenHands, Factory, and Ona sell agents. SDF grades that work and does not sell an agent. The figures are not SDF prices, and they are not prices for a verification, evaluation, or control-plane product. SDF dollar amounts are not published.",
  },
] as const;

export const onePager = {
  headline: "SDF: the independent referee for coding agents",
  sections: [
    {
      title: "Problem",
      body: "Coding agents grade their own work. Teams running several agents can't prove which work shipped, or the Cost per Accepted Outcome.",
    },
    {
      title: "Solution",
      body: "A vendor-neutral control plane that verifies every agent attempt with evidence the agent can't forge and records it in an auditable Decision Graph.",
    },
    {
      title: "Outcome",
      body: "One number to manage agent spend: Cost per Accepted Outcome, comparable across agents.",
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
  cta: "Become one of 3 to 5 design partners and baseline Cost per Accepted Outcome before and after SDF.",
} as const;

export const closing = {
  heading: "Become a design partner",
  body: "We're onboarding 3 to 5 platform teams already running two or more agents. Measure Cost per Accepted Outcome before and after SDF. Apply to be a design partner.",
} as const;

/**
 * Public list prices for coding agents. Not SDF prices, and not peers in
 * verification or evaluation. Each figure is tied to the page it came from.
 */
export const marketAnchorNote = {
  kicker: "Not SDF pricing",
  title: "Coding-agent list prices, for context only",
  body: "OpenHands, Factory, and Ona sell coding agents. Those are the products SDF independently grades, not verification, evaluation, or control-plane peers. The figures below are their public list prices, shown only so a buyer can see how those products are sold. Each figure below is not an SDF price. SDF dollar amounts stay unpublished until design partners validate them.",
  again: "Again: coding-agent list prices, not SDF prices.",
} as const;

export const marketAnchors = [
  {
    id: "openhands-teams",
    product: "OpenHands",
    context: "hosted",
    figure:
      "$500/month for up to 10 users, plus $50/month per extra seat. The Teams plan is also capped at 5,000 sessions per month.",
    sources: [{ label: "openhands.dev/pricing", url: "https://www.openhands.dev/pricing" }],
  },
  {
    id: "factory-teams",
    product: "Factory",
    context: "hosted",
    figure: "Teams is $60/month per team, plus $40/month per seat, up to 10 seats.",
    sources: [{ label: "factory.com/pricing", url: "https://factory.com/pricing" }],
  },
  {
    id: "factory-enterprise",
    product: "Factory",
    context: "enterprise",
    figure:
      "AWS Marketplace lists an Enterprise Platform fee of $25,000 for 12 months, plus usage-based Standard Tokens and Premium Tokens at $1.00 per unit. factory.com does not publish a dollar price for Business or Enterprise.",
    sources: [
      {
        label: "AWS Marketplace",
        url: "https://aws.amazon.com/marketplace/pp/prodview-2lln5juxh6ujs",
      },
      { label: "factory.com/pricing", url: "https://factory.com/pricing" },
    ],
  },
  {
    id: "ona-annual",
    product: "Ona",
    context: "enterprise",
    figure:
      "AWS Marketplace lists a $60,000 Annual Commit for 12 months. That listing does not define what one unit covers. The same page says Ona also sells custom pricing via private offer.",
    sources: [
      {
        label: "AWS Marketplace",
        url: "https://aws.amazon.com/marketplace/pp/prodview-vn4wpn7u4afrq",
      },
    ],
  },
] as const;

export const graphNodes = [
  { title: "Objective", detail: "Acceptance criteria, linked to the business goal" },
  { title: "Attempt", detail: "Routed to an agent you already use" },
  { title: "Evidence", detail: "Checks the agent cannot forge" },
  { title: "Verdict", detail: "Bound to the exact code revision" },
  { title: "Cost", detail: "Recorded on the same attempt" },
] as const;
