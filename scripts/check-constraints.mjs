import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

function htmlFiles() {
  return walk(dist).filter((file) => file.endsWith(".html"));
}

function read(relative) {
  const file = join(dist, relative);
  try {
    return readFileSync(file, "utf8");
  } catch {
    throw new Error(`Missing built page ${relative}`);
  }
}

const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function includes(haystack, needle) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

const pages = htmlFiles().map((file) => ({ file, html: readFileSync(file, "utf8") }));
const home = read("index.html").replace(/&#(?:39|x27);|&apos;/gi, "'");
const pricing = read("pricing/index.html");
const onePager = read("one-pager/index.html");
const sample = read("sample-evidence-report/index.html");
const partners = read("design-partners/index.html");

for (const page of pages) {
  assert(!page.html.includes("acceptable outcome"), `${page.file} still says acceptable outcome`);
  assert(!page.html.includes("accepted task"), `${page.file} still says accepted task`);
  assert(!page.html.includes("cost per accepted outcome"), `${page.file} uses a lowercase paraphrase of Cost per Accepted Outcome`);
  assert(!page.html.includes("Hosted Pro"), `${page.file} renames Hosted Team`);
  assert(!includes(page.html, "No release binaries"), `${page.file} still says release binaries are unpublished`);
  assert(!includes(page.html, "stores tokens"), `${page.file} says the product stores tokens`);
  assert(!includes(page.html, "never stores tokens"), `${page.file} says the product never stores tokens`);
  assert(!includes(page.html, "Live today only on a toy fixture"), `${page.file} still says the product is live only on a toy fixture`);
  assert(includes(page.html, "https://github.com/paulpham157/sdf"), `${page.file} is missing the GitHub repository link`);
  assert(includes(page.html, 'href="/favicon.ico"'), `${page.file} is missing the favicon.ico link`);
  assert(includes(page.html, 'href="/favicon.svg"'), `${page.file} is missing the favicon.svg link`);
  assert(includes(page.html, "design-partners@softwaredecisionfabric.tech"), `${page.file} is missing the contact address`);
  assert(!includes(page.html, "Placeholder mailbox"), `${page.file} still marks the mailbox as a placeholder`);
  assert(!includes(page.html, "testimonial"), `${page.file} contains a testimonial claim`);
  assert(!includes(page.html, "case study"), `${page.file} contains a case study`);
  assert(!includes(page.html, "trusted by"), `${page.file} contains a trusted-by claim`);
  assert(!includes(page.html, "lorem ipsum"), `${page.file} contains placeholder copy`);
  assert(!includes(page.html, "streetAddress"), `${page.file} invents a postal address`);
  assert(includes(page.html, "<title>"), `${page.file} is missing a title`);
  assert(includes(page.html, 'name="description"'), `${page.file} is missing a description`);
  assert(includes(page.html, 'property="og:title"'), `${page.file} is missing Open Graph`);
}

assert(includes(home, "Know which agent work actually shipped."), "Home is missing the hero headline");
assert(
  includes(home, "A local OpenTelemetry collector and decision ledger for coding agents."),
  "Home is missing the official tagline",
);
assert(!includes(home, "This row is not the list of SDF adapters."), "Home agent row was removed");
assert(!includes(home, "toy fixture"), "Home specimen was removed");
assert(!includes(home, "§ 01. How it works"), "How it works section must leave the homepage");
assert(!includes(home, "§ 01. Why SDF"), "Why SDF must leave the homepage");
assert(!includes(home, "§ 03. Shipping today"), "Shipping today must leave the homepage");
assert(includes(home, "§ 04. Design partners"), "Home § 04 kicker drifted");
const homeKickers = [
  "§ 01. Proof: a checked commit",
  "§ 02. Proof: cost that won't guess",
  "§ 03. Get started",
  "§ 04. Design partners",
];
let kickerAt = -1;
for (const kicker of homeKickers) {
  const next = home.indexOf(kicker);
  assert(next > kickerAt, `Home kicker missing or out of order: ${kicker}`);
  kickerAt = next;
}
assert(
  includes(
    home,
    "SDF records your coding agents' telemetry, links sessions to commits, and checks commits against tasks you declare. Local only; it doesn't launch or sandbox agents, and routing is planned.",
  ),
  "Hero lede drifted",
);
assert(!includes(home, "VP Engineering"), "Hero buyer line must leave the homepage");
assert(includes(home, 'href="/blog"'), "Home is missing the blog link");
assert(includes(home, "Become a design partner"), "Home is missing the § 04 design-partner heading");
assert(includes(home, ">Apply now<"), "Home design-partner CTA must say Apply now");
const headerBlocks = pages.map((page) => ({
  file: page.file,
  header: page.html.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0] ?? "",
}));
for (const page of headerBlocks) {
  assert(page.header.includes('class="button header-cta" href="/#today"'), `${page.file} header CTA must go to /#today`);
  assert(includes(page.header, ">Get started<"), `${page.file} header button must say Get started`);
  assert(!includes(page.header, "Become a design partner"), `${page.file} header still has the design-partner button`);
  assert(
    includes(page.header, 'href="https://github.com/paulpham157/sdf/tree/main/docs"'),
    `${page.file} header is missing the Docs link`,
  );
  const navOrder = [...page.header.matchAll(/>([^<]+)<\/a>/g)].map((match) => match[1].trim());
  const sampleAt = navOrder.indexOf("Sample report");
  const docsAt = navOrder.indexOf("Docs");
  const githubAt = navOrder.indexOf("GitHub");
  assert(sampleAt !== -1 && docsAt === sampleAt + 1 && githubAt === docsAt + 1, `${page.file} nav order must be Sample report, Docs, GitHub`);
  assert(navOrder.filter((label) => label === "Docs").length === 2, `${page.file} Docs must be in the bar and the menu`);
}
const heroCta = home.match(/<div class="cta-row">([\s\S]*?)<\/div>/)?.[1] ?? "";
assert(heroCta.includes('href="/#today"') && includes(heroCta, "Get started"), "Hero primary must be Get started → /#today");
assert(
  heroCta.includes('href="https://github.com/paulpham157/sdf"') && includes(heroCta, "View on GitHub"),
  "Hero secondary must be View on GitHub",
);
assert(!heroCta.includes("sample-evidence-report"), "Hero must not keep the sample-report button");
assert(includes(home, 'href="/sample-evidence-report"'), "Sample report must stay in the nav");
const closeCta = [...home.matchAll(/<div class="cta-row">([\s\S]*?)<\/div>/g)].at(-1)?.[1] ?? "";
assert(closeCta.includes('href="/design-partners"') && includes(closeCta, "Apply now"), "§ 04 design-partner CTA must stay");
const homeMain = home.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? "";
assert(homeMain.length > 0, "Home is missing main");
assert(!includes(homeMain, "Declare the checks. Run your agent as usual."), "How it works section must leave the homepage");
assert(!includes(homeMain, "sdf task declare records the task"), "Declare card must leave the homepage");
assert(!includes(homeMain, "Routing a task to an agent you already use is planned."), "Route card must leave the homepage");
assert(!includes(homeMain, "Your agents stay in place. SDF records what they did."), "Old how-it-works lede must leave");
assert(!includes(homeMain, "Vendor-neutral"), "Why SDF pillars must leave the homepage");
assert(
  includes(homeMain, "routing is planned."),
  "Homepage must say routing is planned",
);
assert(
  includes(homeMain, "an independent referee loop, are planned."),
  "Homepage must say the independent referee loop is planned",
);
assert(home.includes('id="how-it-works"'), "Verify section must keep the how-it-works nav id");
assert(
  includes(home, "Onboarding 3 to 5 platform teams running two or more agents."),
  "Home is missing the closing CTA",
);
assert(includes(home, "Planned"), "Home must label unshipped steps as Planned");
assert(includes(home, "go install github.com/paulpham157/sdf/cmd/sdf@latest"), "Home is missing the real install path");
assert(!includes(home, "sdf@v0.1.0"), "Homepage install must not pin @v0.1.0; that line lives in docs and on pricing");
assert(includes(home, "sdf serve"), "Home install is missing sdf serve");
assert(includes(home, "sdf init claude-code --write"), "Home install is missing sdf init");
assert(includes(home, "sdf summary"), "Home install is missing sdf summary");
assert(includes(home, "https://github.com/paulpham157/sdf/releases/tag/v0.1.0"), "Home is missing the v0.1.0 release");
assert(!includes(homeMain, "unless you opt in"), "Opt-in content wording leaves the homepage for the docs");
assert(
  includes(homeMain, "Auth is off by default: keep it on localhost."),
  "Homepage must keep the auth clause next to the install block",
);
assert(includes(homeMain, "Apache 2.0"), "Homepage must name the Apache 2.0 license");
assert(
  !includes(
    homeMain,
    "v0.1.0 is open source under Apache 2.0. sdf serve listens on localhost and serves a read-only page. Authentication is off by default, so keep the receiver on localhost.",
  ),
  "The old shipping-today paragraph must stay off the homepage",
);
assert(
  includes(
    home,
    "Keep sdf serve running and restart your agent after sdf init. Needs Go 1.26+, or grab a ",
  ),
  "Install note drifted",
);
assert(includes(home, "Setup: "), "Install docs line drifted");
assert(!includes(home, "listens on localhost for OTLP"), "Home must not put the OTLP receiver detail back in the shipping paragraph");
assert(!includes(home, "optional bearer token"), "Home must not put the bearer-token detail back in the shipping paragraph");
assert(!includes(home, "read-only UI on localhost"), "Home shipping copy still uses the old UI sentence");
assert(includes(home, "Cost that won't guess."), "Cost heading drifted");
assert(
  includes(
    home,
    "With --github, accepted means the linked PR merged. Missing outcome, cost, or unique merge: unknown.",
  ),
  "Cost footnote must state the outcome, cost, and unique-merge rule",
);
assert(
  !includes(homeMain, "Run it with --github, and sessions whose linked pull request merged get a figure."),
  "Cost footnote must not say --github alone produces a figure",
);
assert(includes(home, ">unlinked<"), "Cost table must show unlinked outcomes");
assert(!includes(homeMain, "the session stays unlinked."), "Commit-link caveat moves off the homepage");
assert(!includes(home, "commit trailer"), "Homepage must not list the commit-link rules");
assert(!includes(home, "from the OpenTelemetry each one exports"), "Coverage paragraph still has the export clause");
assert(!includes(home, "This is headed toward"), "Homepage moat was removed");
assert(!includes(home, "either way"), "either way must stay out of the homepage");
assert(!includes(homeMain, "The exact commit-link rules are in "), "Commit-link docs line leaves the homepage");
assert(!includes(homeMain, "is spelled out in "), "Accepted-definition docs line leaves the homepage");
assert(includes(home, "Needs Go 1.26+"), "Home install note drifted");
assert(!includes(home, "<code>go install</code> builds from source and needs Go 1.26 or newer."), "Old install note must leave");
assert(!includes(home, "Cost per Accepted Outcome is unknown without --github"), "The install note still repeats the unknown-cost conditions");
assert(home.includes('id="today"'), "Install section must keep id today");
assert(
  !includes(homeMain, "https://github.com/paulpham157/sdf/blob/main/docs/outcomes.md#linking-a-session-to-a-commit"),
  "Commit-link anchor leaves the homepage for the docs index",
);
assert(
  includes(home, "https://github.com/paulpham157/sdf/blob/v0.1.0/docs/verify.md"),
  "Home must link the verify docs at the v0.1.0 tag",
);
assert(includes(home, "We hand-wrote both commits in a toy repo"), "Verify caption must say the commits were written by hand");
assert(includes(home, "linear backoff fails the test"), "Verify caption must name the FAIL cause");
assert(includes(home, "exponential passes"), "Verify caption must name the PASS cause");
assert(
  includes(home, "Real sdf summary output (v0.1.0) on the repo's hand-written test telemetry, not real sessions."),
  "Cost caption drifted",
);
assert(includes(home, "<caption"), "Cost table needs a caption");
assert(includes(home, 'class="proof-label"'), "Proof blocks need the Toy repo and Example data chips");
assert(includes(home, ">Toy repo<"), "Verify block must be labeled Toy repo");
assert(includes(home, ">Example data<"), "Cost block must be labeled Example data");
assert(!includes(home, "status-badge"), "Proof chips must not use the planned status badge");
assert(includes(home, "sdf verify 461ddeb… --task retry-backoff --task-ref 478bd0f…"), "Verify FAIL command drifted");
assert(includes(home, "sdf verify 040181e… --task retry-backoff --task-ref 478bd0f…"), "Verify PASS command drifted");
assert(includes(home, "sha256:ec48838d…"), "Verify FAIL hash drifted");
assert(includes(home, "sha256:134a6e62…"), "Verify PASS hash drifted");
assert(includes(home, '<strong class="verdict verdict-fail">FAIL</strong>'), "FAIL must be text, not color alone");
assert(includes(home, '<strong class="verdict">PASS</strong>'), "PASS must be text, not color alone");
assert(
  includes(home, '  <span class="reason">CHECK_FAILED: unit: exit 1, expected 0</span>'),
  "CHECK_FAILED must keep the two-space indent from the run",
);
assert(
  includes(home, "cost_per_accepted_outcome_usd: unknown (3 sessions have no known outcome)"),
  "Cost per Accepted Outcome line drifted",
);
assert(includes(home, "sample-claude-1"), "Cost table is missing the Claude sample");
assert(includes(home, "sample-codex-conv-1"), "Cost table is missing the Codex sample");
assert(includes(home, "sample-gemini-1"), "Cost table is missing the Gemini sample");
assert(includes(home, "$0.00055"), "Computed cost must stay unrounded");
assert(includes(home, ">unknown<"), "Unknown cost must stay the word unknown");
assert(!includes(home, ">—<") && !includes(home, ">–<"), "Unknown must not be tidied into a dash");
assert(
  includes(home, "One commit, eight evidence records. Verifying every attempt, and an independent referee loop, are planned."),
  "Verify footnote drifted",
);
assert(
  includes(home, "https://github.com/paulpham157/sdf/tree/main/docs"),
  "Home footer must link the product docs",
);
assert(
  includes(
    onePager,
    "Run SDF today with v0.1.0, Apache 2.0, on your machine: go install github.com/paulpham157/sdf/cmd/sdf@latest, or go install github.com/paulpham157/sdf/cmd/sdf@v0.1.0. Prebuilt archives: https://github.com/paulpham157/sdf/releases/tag/v0.1.0. Building from source, including go install, needs Go 1.26 or newer.",
  ),
  "One-pager install copy drifted",
);
assert(!includes(onePager, "or pin @v0.1.0"), "One-pager must spell out the pinned go install command");
assert(includes(onePager, "Become a design partner"), "One-pager Ask must keep the design-partner button");

function emailOffBlocks(html) {
  return html.match(/<!--email_off-->[\s\S]*?<!--\/email_off-->/g) ?? [];
}

function assertEmailOff(html, label, needle) {
  const blocks = emailOffBlocks(html);
  assert(
    blocks.some((block) => block.includes(needle)),
    `${label} must keep ${needle} inside Cloudflare's email_off markers`,
  );
  assert(
    blocks.every((block) => !block.includes("design-partners@softwaredecisionfabric.tech")),
    `${label} must not disable obfuscation for the contact address`,
  );
  assert(!html.includes("/cdn-cgi/l/email-protection"), `${label} must not rewrite a protected command`);
}

assertEmailOff(home, "Home", "go install github.com/paulpham157/sdf/cmd/sdf@latest");
assertEmailOff(home, "Home", "sha256:ec48838d…");
assertEmailOff(home, "Home", "sha256:134a6e62…");
assertEmailOff(home, "Home", "cost_per_accepted_outcome_usd: unknown (3 sessions have no known outcome)");
assert(emailOffBlocks(home).length >= 3, "Home must protect the verify block, the cost line, and the install block");
function assertInstallProtected(html, label) {
  assertEmailOff(html, label, "go install github.com/paulpham157/sdf/cmd/sdf@v0.1.0");
}

assertInstallProtected(pricing, "Pricing");
assertInstallProtected(onePager, "One-pager");
assertEmailOff(onePager, "One-pager", "go install github.com/paulpham157/sdf/cmd/sdf@v0.1.0");
assert(!includes(homeMain, "Token counts"), "Token-count wording leaves the homepage");
assert(includes(pricing, "go install github.com/paulpham157/sdf/cmd/sdf@latest"), "Pricing must lead with the local install");
assert(includes(pricing, "https://github.com/paulpham157/sdf/releases/tag/v0.1.0"), "Pricing is missing the v0.1.0 release");
assert(includes(pricing, "linked GitHub pull request merged"), "Pricing must say accepted means a merged pull request");
assert(
  includes(home, "https://github.com/paulpham157/sdf/blob/v0.1.0/docs/outcomes.md#pull-requests-and-ci"),
  "Home must link the accepted and unknown-cost rules at the v0.1.0 tag",
);
assert(
  includes(home, "https://github.com/paulpham157/sdf/tree/v0.1.0/docs"),
  "Homepage setup link must point at the v0.1.0 docs",
);
assert(includes(pricing, "Planned: SSO (SAML/OIDC), SCIM"), "Pricing must label SSO as planned");
const verifiedAttempt =
  "A verified Attempt is a recorded run whose evidence was checked independently of the agent that produced it, against criteria that run did not get to choose.";
assert(!home.includes(verifiedAttempt), "Homepage no longer carries the verified Attempt definition");
assert(pricing.includes(verifiedAttempt), "Pricing is missing the verified Attempt sentence");
const costPerAcceptedOutcome =
  "Cost per Accepted Outcome is the computed cost of the agent sessions whose linked GitHub pull request merged, divided by how many such sessions there are. It is unknown, not zero, without --github, or when cost, outcome, or a unique merge is missing: any session has no known outcome, an accepted session has no known cost, the same commit is linked to more than one accepted session, or nothing merged. It is not read from an invoice, and it is not acceptance by a named principal. It is never a cost per seat, or per agent claiming a task is done.";
assert(!home.includes(costPerAcceptedOutcome), "Homepage no longer carries the full Cost per Accepted Outcome definition");
assert(pricing.includes(costPerAcceptedOutcome), "Pricing is missing the Cost per Accepted Outcome sentence");
assert(home.includes("Cost per Accepted Outcome"), "Home is missing Cost per Accepted Outcome");
assert(!home.toLowerCase().includes("acceptable outcome"), "Home still says acceptable outcome");
assert(!home.includes("accepted task"), "Home still says accepted task");
const homeDollars = home.match(/\$\d[\d.]*/g) ?? [];
assert(
  homeDollars.length === 1 && homeDollars[0] === "$0.00055",
  `Home dollar amounts must be only the sample computed cost $0.00055, found ${homeDollars.join(", ") || "none"}`,
);
assert(!includes(home, "OpenHands"), "Home must not show market-anchor prices");
assert(!/\bOna\b/.test(home), "Home must not show the Ona anchor");

assert(includes(pricing, "Not published"), "Pricing must leave SDF amounts unpublished");
assert(includes(pricing, "never per seat"), "Pricing is missing the price shape");
assert(includes(pricing, "OpenHands"), "Pricing is missing the OpenHands anchor");
assert(includes(pricing, "$500/month for up to 10 users, plus $50/month per extra seat"), "Pricing is missing the OpenHands figure");
assert(includes(pricing, "5,000 sessions per month"), "Pricing is missing the OpenHands session cap");
assert(includes(pricing, "https://www.openhands.dev/pricing"), "Pricing is missing the OpenHands source");
assert(includes(pricing, "$60/month per team, plus $40/month per seat, up to 10 seats"), "Pricing is missing the Factory Teams figure");
assert(includes(pricing, "https://factory.com/pricing"), "Pricing is missing the Factory source");
assert(includes(pricing, "$25,000 for 12 months"), "Pricing is missing the Factory Enterprise platform fee");
assert(includes(pricing, "https://aws.amazon.com/marketplace/pp/prodview-2lln5juxh6ujs"), "Pricing is missing the Factory AWS source");
assert(includes(pricing, "$60,000 Annual Commit for 12 months"), "Pricing is missing the Ona figure");
assert(includes(pricing, "does not define what one unit covers"), "Pricing must say the Ona unit is undefined");
assert(includes(pricing, "private offer"), "Pricing must mention Ona's private offer");
assert(includes(pricing, "https://aws.amazon.com/marketplace/pp/prodview-vn4wpn7u4afrq"), "Pricing is missing the Ona source");
assert(includes(pricing, "coding-agent list prices"), "Pricing must frame the anchors as coding-agent list prices");
assert(includes(pricing, "not verification, evaluation, or control-plane peers"), "Pricing must say these are not category peers");
assert(includes(pricing, "Hosted Team"), "Pricing must keep the Hosted Team name");
assert(!includes(pricing, "Hosted Pro"), "Pricing must not rename Hosted Team to Hosted Pro");
assert(!includes(pricing, "$60 + seats"), "Pricing still uses the old Factory shorthand");
assert(!includes(pricing, "$500/mo for 10 users"), "Pricing still uses the old OpenHands shorthand");
assert(includes(pricing, "Not SDF pricing"), "Market anchors are not labeled as other companies' prices");
assert(includes(pricing, "not an SDF price"), "The comparison row does not say the anchors are not SDF prices");
assert(includes(pricing, '"@type":"FAQPage"'), "Pricing FAQ is missing FAQPage structured data");
assert(includes(pricing, "Why not per seat?"), "Pricing is missing the FAQ");
assert(includes(pricing, "SSO (SAML/OIDC), SCIM"), "Pricing is missing Enterprise identity");

assert(
  includes(onePager, "SDF: a local OpenTelemetry collector and decision ledger for coding agents"),
  "One-pager headline drifted",
);
assert(onePager.includes("Cost per Accepted Outcome"), "One-pager is missing Cost per Accepted Outcome");
assert(!onePager.includes("$"), "One-pager must not carry dollar figures");
assert(!includes(onePager, "OpenHands"), "One-pager must not present market anchors");

assert(includes(sample, "not a customer report"), "Sample report is not clearly labeled");
assert(includes(sample, "toy fixture"), "Sample report must say it is a toy fixture");
assert(includes(sample, "token counts"), "Sample report must say token counts");
assert(includes(sample, "SAMPLE-TOY-001"), "Sample report is missing its specimen id");
assert(includes(sample, "sample-c0ffee1"), "Sample report is missing the specimen revision");
assert(!sample.includes("$"), "Sample report must not invent dollar amounts");
assert(includes(sample, "Not published") || includes(sample, "not published"), "Sample report should keep SDF price unpublished");

assert(includes(partners, "mailto:design-partners@softwaredecisionfabric.tech"), "Design-partner page is missing the mailto");
assert(includes(partners, "email draft"), "Design-partner page does not explain the mailto behavior");
assert(
  includes(partners, "does not submit to a server") || includes(partners, "Nothing is stored here"),
  "Design-partner page does not say the site does not submit to a server",
);
assert(/<script type="module" src="\/_astro\//.test(partners), "Design-partner script should be an external file");
assert(!/<script type="module">/.test(partners), "Inline module scripts would require script-src unsafe-inline");
assert(!/<style[\s>]/.test(partners), "Inline style tags would require style-src unsafe-inline");
assert(!/ style="/.test(partners), "Inline style attributes would require style-src-attr unsafe-inline");

const titles = new Map();
const descriptions = new Map();
for (const page of pages) {
  const title = page.html.match(/<title>([^<]*)<\/title>/)?.[1];
  const description = page.html.match(/name="description" content="([^"]*)"/)?.[1];
  assert(title && title.length > 0, `${page.file} has an empty title`);
  assert(description && description.length > 0, `${page.file} has an empty description`);
  assert(page.html.includes('rel="canonical" href="https://softwaredecisionfabric.tech'), `${page.file} canonical is not on the production host`);
  assert(page.html.includes('property="og:title"'), `${page.file} is missing og:title`);
  assert(page.html.includes('name="twitter:card"'), `${page.file} is missing a Twitter card`);
  titles.set(title, (titles.get(title) ?? 0) + 1);
  descriptions.set(description, (descriptions.get(description) ?? 0) + 1);
}
for (const [title, count] of titles) {
  assert(count === 1, `Duplicate title: ${title}`);
}
for (const [description, count] of descriptions) {
  assert(count === 1, `Duplicate description: ${description}`);
}
const notFound = read("404.html");
assert(includes(notFound, 'content="noindex, follow"'), "404 should be noindex");

const robots = readFileSync(join(dist, "robots.txt"), "utf8");
assert(includes(robots, "sitemap-index.xml"), "robots.txt is missing the sitemap");
assert(includes(robots, "Disallow: /404"), "robots.txt should keep the 404 out of the crawl");
assert(!/User-agent: (?!\*)/.test(robots), "robots.txt should not privilege a named crawler");

const headers = readFileSync(join(dist, "_headers"), "utf8");
assert(includes(headers, "Content-Security-Policy:"), "Missing Content-Security-Policy");
assert(includes(headers, "script-src 'self'"), "CSP should allow only same-origin scripts");
assert(includes(headers, "style-src 'self'"), "CSP should allow only same-origin styles");
assert(includes(headers, "form-action 'self' mailto:"), "CSP should allow the mailto form");
assert(includes(headers, "frame-ancestors 'none'"), "CSP should deny framing");
assert(!headers.includes("unsafe-inline"), "CSP should not need unsafe-inline");
assert(!headers.includes("unsafe-eval"), "CSP should not need unsafe-eval");

const llms = readFileSync(join(dist, "llms.txt"), "utf8");
const llmsFull = readFileSync(join(dist, "llms-full.txt"), "utf8");
for (const file of [llms, llmsFull]) {
  assert(file.includes("Cost per Accepted Outcome"), "llms text dropped the metric name");
  assert(file.includes("go install github.com/paulpham157/sdf/cmd/sdf@latest"), "llms text is missing the install line");
  assert(file.includes("Hosted Team"), "llms text dropped Hosted Team");
  assert(!file.includes("Hosted Pro"), "llms text renamed the hosted tier");
  assert(file.includes("design-partners@softwaredecisionfabric.tech"), "llms text is missing the contact address");
  assert(!/placeholder mailbox/i.test(file), "llms text still calls the mailbox a placeholder");
  assert(!file.includes("testimonial"), "llms text invented social proof");
}
assert(
  llms.includes("routing is planned."),
  "llms.txt must use the homepage lede",
);
assert(llms.includes("Auth is off by default: keep it on localhost."), "llms.txt must keep the auth clause");
assert(!llms.includes("the four steps"), "llms.txt still describes the old four homepage steps");
assert(!llms.includes("Route is Planned"), "llms.txt still marks Route on the homepage summary");
assert(llms.includes("Declare, verify, and record are partly shipped."), "llms.txt must say which steps are partly shipped");
assert(llmsFull.includes("cost_per_accepted_outcome_usd: unknown (3 sessions have no known outcome)"), "llms-full is missing the cost line");
assert(llmsFull.includes("sha256:ec48838d…"), "llms-full is missing the verify FAIL hash");
assert(llmsFull.includes("We hand-wrote both commits in a toy repo"), "llms-full verify caption drifted");
assert(
  llmsFull.includes(
    "With --github, accepted means the linked PR merged. Missing outcome, cost, or unique merge: unknown.",
  ),
  "llms-full cost footnote drifted",
);
assert(llmsFull.includes("an independent referee loop, are planned."), "llms-full must say the referee loop is planned");
assert(llmsFull.includes("sdf init claude-code --write"), "llms-full is missing the homepage init command");
assert(!llms.includes("three planned, one partly shipped"), "llms.txt still says three steps are planned");
assert(llmsFull.includes("Accepted means merged"), "llms-full must keep the accepted definition");
assert(llmsFull.includes("## Why SDF"), "llms-full must title the points Why SDF");
assert(!llmsFull.includes("## Commitments"), "llms-full still says Commitments");
assert(!llmsFull.includes("Acceptance by a named reviewer is planned"), "llms-full still says reviewer acceptance is planned");
assert(!llms.includes("A local OpenTelemetry collector and decision ledger for coding agents."), "llms.txt repeats the tagline beside the subhead");
assert(!llmsFull.includes("A local OpenTelemetry collector and decision ledger for coding agents."), "llms-full repeats the tagline beside the subhead");
assert(llmsFull.includes("https://github.com/paulpham157/sdf/releases/tag/v0.1.0"), "llms-full is missing the v0.1.0 release");
assert(llmsFull.includes("https://www.openhands.dev/pricing"), "llms-full is missing the OpenHands source");
assert(llmsFull.includes("https://factory.com/pricing"), "llms-full is missing the Factory source");
assert(llmsFull.includes("https://aws.amazon.com/marketplace/pp/prodview-vn4wpn7u4afrq"), "llms-full is missing the Ona source");

const sitemap = readFileSync(join(dist, "sitemap-index.xml"), "utf8");
assert(sitemap.includes("sitemap"), "sitemap index looks empty");
const sitemapBody = walk(dist)
  .filter((file) => file.endsWith(".xml"))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
for (const route of [
  "/pricing",
  "/one-pager",
  "/sample-evidence-report",
  "/design-partners",
  "/blog",
  "/blog/task-complete-is-a-claim",
  "/blog/cite-the-source",
]) {
  assert(sitemapBody.includes(route), `Sitemap is missing ${route}`);
}
assert(!sitemapBody.includes("/404"), "Sitemap should not list the 404 page");
assert(!sitemapBody.includes("draft-not-published"), "Sitemap listed a draft post");

const blog = read("blog/index.html");
assert(includes(blog, "Notes from the referee"), "Blog index is missing its heading");
assert(includes(blog, "Task complete is still a claim"), "Blog index is missing the sample note");
assert(includes(blog, "Quote the post, then check the work"), "Blog index is missing the citation sample");
assert(!includes(blog, "This draft must not ship"), "Blog index published a draft");

const note = read("blog/task-complete-is-a-claim/index.html");
assert(includes(note, "specimen of the blog"), "Sample note is not labeled as a sample");
assert(includes(note, "Decision Graph"), "Sample note dropped the Decision Graph");
assert(!note.includes("$"), "Sample note must not invent prices");

const cite = read("blog/cite-the-source/index.html");
assert(includes(cite, "specimen of the blog"), "Citation sample is not labeled as a sample");
assert(cite.includes('"@type":"BlogPosting"'), "Blog post is missing BlogPosting structured data");
assert(cite.includes("article:published_time"), "Blog post is missing article:published_time");
assert(includes(cite, "https://x.com/sdf_sample/status/1001"), "X citation is missing its permalink");
assert(includes(cite, "https://www.linkedin.com/posts/sdf-sample_activity-1001"), "LinkedIn citation is missing its permalink");
assert(includes(cite, "https://example.com/notes/sample-decision-graph"), "Generic citation is missing its permalink");
assert(includes(cite, "Sample quotation. Not a live post."), "Citation card does not label the specimen quotation");
assert(includes(cite, "Sample Author"), "Citation card dropped the author");
assert(!cite.includes("$"), "Citation sample must not invent prices");
assert(!includes(cite, "This draft must not ship"), "Draft text leaked onto a post");

const blogPages = pages.filter((page) => page.file.includes(`${join("dist", "blog")}`));
assert(blogPages.length >= 3, "Expected the blog index and two published posts");
for (const page of blogPages) {
  assert(!page.html.includes("$"), `${page.file} must not introduce dollar amounts`);
  assert(!includes(page.html, "OpenHands"), `${page.file} must not carry market-anchor prices`);
  assert(!/\bOna\b/.test(page.html), `${page.file} must not carry the Ona anchor`);
  assert(!includes(page.html, "testimonial"), `${page.file} contains a testimonial claim`);
}

for (const asset of ["og.png", "apple-touch-icon.png", "favicon.svg"]) {
  try {
    statSync(join(dist, asset));
  } catch {
    failures.push(`Missing ${asset}`);
  }
}

let faviconIco;
try {
  faviconIco = readFileSync(join(dist, "favicon.ico"));
} catch {
  faviconIco = null;
  failures.push("Missing favicon.ico");
}
if (faviconIco) {
  assert(
    faviconIco.length > 6 &&
      faviconIco[0] === 0 &&
      faviconIco[1] === 0 &&
      faviconIco[2] === 1 &&
      faviconIco[3] === 0 &&
      faviconIco.readUInt16LE(4) >= 1,
    "favicon.ico is not an ICO image",
  );
  assert(
    !faviconIco.subarray(0, 15).toString("latin1").toLowerCase().startsWith("<!doctype") &&
      !faviconIco.subarray(0, 5).toString("latin1").toLowerCase().startsWith("<html"),
    "favicon.ico is the HTML 404 page",
  );
}

const jsonLdProbe = "JSONLD_ESCAPE_PROBE";
for (const page of pages) {
  assert(
    !page.html.includes(jsonLdProbe),
    `${page.file} contains the JSON-LD escape fixture`,
  );
}

if (failures.length) {
  console.error("Copy and constraint checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Constraint checks passed (${pages.length} pages).`);
