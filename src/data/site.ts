/**
 * Site-wide facts. `email` is the only contact address.
 * Change it here and every mailto link, footer line, and form follows.
 */
export const site = {
  name: "Software Decision Fabric",
  shortName: "SDF",
  url: "https://softwaredecisionfabric.tech",
  tagline: "The independent referee for coding agents.",
  email: "design-partners@softwaredecisionfabric.tech",
  emailIsPlaceholder: false,
  status:
    "Today SDF ships an open-source local collector for coding-agent telemetry, plus local commands that declare a task's checks and run them against a commit. The full referee loop is planned and is shown only as a toy fixture mock on this site. We are onboarding 3 to 5 design partners.",
  repo: "https://github.com/paulpham157/sdf",
} as const;

/** Public name of the wedge metric. Do not paraphrase this on the site. */
export const wedgeMetric = "Cost per Accepted Outcome";

export const hero = {
  title: "Know which agent work actually shipped.",
  subhead:
    "SDF is building the independent referee for coding agents. Today it is an open-source local collector: it records the telemetry your agents already export, links sessions to commits, and shows Cost per Accepted Outcome from pull requests that merged. It can also run a task's declared checks against one commit from the command line. Routing work to agents and verifying every attempt automatically are planned.",
  buyer:
    "For platform, security, or VP Engineering leaders running two or more coding agents.",
  primaryCta: "Become a design partner",
  secondaryCta: "See a sample Evidence Report",
} as const;

export const problem = {
  heading: "“Task complete” is a claim, not a result.",
  body: "Copilot, Cursor, Devin, and Factory each grade their own work. You pay per seat or per token, while the question that matters — did it work? — goes unanswered.",
  coverage:
    "What SDF reads today: Claude Code, Codex CLI, OpenCode v2, Qwen Code, Grok CLI, Gemini CLI, GitHub Copilot CLI, and Pi through the community pi-otel extension, from the OpenTelemetry each one exports. The tool-call arguments Qwen Code and Gemini CLI send are dropped before anything is stored. Cursor, Devin, Factory, and Copilot outside the CLI have no SDF adapter yet.",
  agents: ["Copilot", "Cursor", "Devin", "Factory"] as const,
} as const;

export type Status = "planned" | "partial";

export const statusLabel: Record<Status, string> = {
  planned: "Planned",
  partial: "Partly shipped",
};

export const steps = [
  {
    id: "01",
    title: "Declare",
    status: "partial" as Status,
    body: "Declare the objective and acceptance criteria, linked to the business goal.",
    today:
      "Today: sdf task declare records a task's checks and the files they depend on, hashed, before an agent starts, and sdf decision add records a decision or hypothesis. Linking a task to a business goal is planned.",
  },
  {
    id: "02",
    title: "Route",
    status: "planned" as Status,
    body: "Route the task to any agent you already use. Bring your own subscriptions or keys.",
    today:
      "Today: SDF does not launch or route agents. You run them as usual, and sdf init prints the settings that point their telemetry at SDF.",
  },
  {
    id: "03",
    title: "Verify",
    status: "partial" as Status,
    body: "SDF runs independent checks the agent can't forge, and ties PASS to the exact code revision.",
    today:
      "Today: sdf verify runs a declared task's checks against one commit in a fresh checkout, from trusted copies of the task, and prints the evidence and a PASS, FAIL, or ERROR verdict for that commit. A GitHub Action runs it on pull requests. Running it on every agent attempt automatically is planned.",
  },
  {
    id: "04",
    title: "Record",
    status: "partial" as Status,
    body: "Planned: every attempt, its cost, and its evidence land in a Decision Graph you can audit. Shipping now: session cost and commit links, decision records you link to sessions and commits, and an optional hash-chained ledger.",
    today:
      "Today: each session's tokens, duration, and cost, the commit or pull request it links to, and the decision records you write, in one local SQLite file. No UI or API route writes or deletes. With --ledger, sdf task declare and sdf verify also append the task, evidence, and verdict to an append-only, hash-chained ledger that sdf audit verify checks. Linking that evidence to sessions and cost is planned.",
  },
] as const;

export const moat =
  "Where this is going: a hardened, evidence-gated record in a Decision Graph that links objectives to attempts, cost, and evidence. What runs today is the layer underneath it: an opt-in hash-chained ledger for tasks, evidence, and verdicts, vendor-neutral telemetry, a computed cost that says unknown instead of guessing, and commit links that come, in order, from a commit SHA the agent exported, the sdf git hook, or an SDF-Session: commit trailer. An exported SHA that is not in the checkout leaves the session unlinked; it does not drop to the hook, the trailer, or the time window. Only a session with no exported SHA and no hook commit can be linked by its time window, and only when exactly one commit fits.";

export const verifiedAttempt =
  "A verified Attempt is a recorded run whose evidence was checked independently of the agent that produced it, against criteria that run did not get to choose.";

export const costPerAcceptedOutcome =
  "Cost per Accepted Outcome is the computed cost of the agent sessions whose linked commit landed in a merged GitHub pull request, divided by how many such sessions there are. It is unknown, not zero, when any session has no known outcome, an accepted session has no known cost, the same commit is linked to more than one accepted session, or nothing merged. It is never a cost per seat, or per agent claiming a task is done.";

export const acceptedToday =
  "Accepted means merged: a session counts as accepted only when every commit linked to it is in one GitHub pull request and that pull request is merged. CI status is reported next to it and does not change it. Acceptance by a named reviewer is planned.";

export const pillars = [
  {
    title: "Vendor-neutral",
    body: "We don't sell an agent, so we have no reason to grade one up.",
  },
  {
    title: "Independently verifiable",
    status: "planned" as Status,
    body: "Evidence that is re-runnable and revision-bound, so security and finance can check it without trusting us or the agent. Today the telemetry sits in a local SQLite file you can summarize again, and sdf verify re-runs a declared task's checks against a commit. Re-running them for every agent attempt is planned.",
  },
  {
    title: "Cost per Accepted Outcome",
    body: "Compare agents on what you actually got: Cost per Accepted Outcome, not seats or tokens. The local UI from sdf serve shows it overall and per agent. Run it with --github so merge status is known; without that flag the figure stays unknown.",
    note: verifiedAttempt,
    outcome: costPerAcceptedOutcome,
  },
] as const;

export const pricingIntro = {
  lede: "Planned pricing: per workspace and per verified outcome, never per seat.",
  unpublished:
    "Neither plan is available yet. Dollar amounts are intentionally unpublished until design partners validate them. The open-source collector is free to run today under Apache 2.0.",
} as const;

export const tiers = [
  {
    id: "hosted",
    name: "Hosted Team",
    for: "Teams running two or more coding agents",
    priceShape:
      "Monthly workspace fee with included verified Attempts, then a per-Attempt overage",
    agents: "Bring your own agent subscriptions or keys. SDF does not resell tokens.",
    evidence: "Planned: Evidence Report per task",
    deployment: "Planned: hosted by SDF",
    identity: "Planned: team roles",
    cta: "Join the design-partner program",
    href: "/design-partners?plan=hosted",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    for: "Platform, security, and regulated organizations",
    priceShape: "Annual platform fee plus verified-outcome volume",
    agents: "Same as Hosted Team, plus planned routing policy and budgets per org",
    evidence: "Planned: signed Evidence Reports and export for audit",
    deployment: "Planned: hosted, your VPC, or supported self-host",
    identity: "Planned: SSO (SAML/OIDC), SCIM",
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
    a: "No. You keep your agent contracts. The plan is to bill for verification and the record.",
  },
  {
    q: "Can I self-host?",
    a: "The open-source collector already runs on your own machine. A supported Enterprise self-host, with identity and signed export, is planned.",
  },
  {
    q: "Is SDF generally available?",
    a: "No. What ships today is the open-source local collector, with local sdf task declare and sdf verify commands. Automatic verification of every attempt, routing, Hosted Team, and Enterprise are planned, and the referee loop exists only as a toy fixture mock. The invitation on this site is a design-partner program for 3 to 5 platform teams, not a public rollout.",
  },
  {
    q: "Are the OpenHands, Factory, and Ona figures SDF prices?",
    a: "No. They are coding-agent list prices, shown so you can see how those products are sold. OpenHands, Factory, and Ona sell agents. SDF is being built to grade that work, and it does not sell an agent. The figures are not SDF prices, and they are not prices for a verification, evaluation, or control-plane product. SDF dollar amounts are not published.",
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
      body: "Planned: a vendor-neutral control plane that verifies every agent attempt with evidence the agent can't forge and records it in an auditable Decision Graph. Shipping today: an open-source local collector that records agent telemetry, links sessions to commits, and computes Cost per Accepted Outcome from merged pull requests, plus sdf verify, which runs a declared task's checks against one commit.",
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
      body: "Planned: Hosted Team (workspace fee plus verified Attempts) and Enterprise (annual platform fee, VPC or self-host, SSO/SCIM). Neither is available yet. Dollar amounts are unpublished until design partners validate them.",
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
  body: "OpenHands, Factory, and Ona sell coding agents. Those are the products SDF plans to grade independently, not verification, evaluation, or control-plane peers. The figures below are their public list prices, shown only so a buyer can see how those products are sold. Each figure below is not an SDF price. SDF dollar amounts stay unpublished until design partners validate them.",
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
  { title: "Objective", detail: "Today: a declared task's checks (sdf task declare). Planned: linked to the business goal" },
  { title: "Attempt", detail: "Today: an agent session, linked to a commit by exact SHA, git hook, commit trailer, or the single commit in its time window; otherwise unlinked" },
  { title: "Evidence", detail: "Today: sdf verify's check results, not yet linked to a session" },
  { title: "Verdict", detail: "Today: PASS, FAIL, or ERROR for the exact commit sdf verify checked" },
  { title: "Cost", detail: "Today: computed from the session's tokens and a public price table" },
] as const;

export const shipsToday = {
  heading: "What you can run today",
  body: "The collector is open source (Apache 2.0) and runs on your machine. sdf serve listens for OTLP/HTTP on 127.0.0.1:4318 and OTLP/gRPC on 127.0.0.1:4317, stores sessions in one SQLite file, and serves a read-only page at 127.0.0.1:4320. Authentication is off by default; an optional bearer token (--otlp-token-file or SDF_OTLP_TOKEN_FILE) guards OTLP writes, and the hooks sdf installs send it. Keep it on localhost either way.",
  install: "go install github.com/paulpham157/sdf/cmd/sdf@latest",
  run: ["sdf serve", "sdf summary"],
  note: "Needs Go 1.26 or newer. No release binaries are published yet. An accepted outcome needs a commit link (sdf init --git-hooks records one) and --github for merge status; without them the metric says unknown.",
} as const;
