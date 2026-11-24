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
const home = read("index.html");
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
assert(includes(home, "§ 01. Why SDF"), "Home § 01 kicker drifted");
assert(includes(home, "Stays on your machine"), "Home is missing the localhost point");
assert(includes(home, "Data goes into local SQLite, with no outside SaaS."), "Localhost point drifted");
assert(includes(home, 'href="/blog"'), "Home is missing the blog link");
assert(includes(home, "Become a design partner"), "Home is missing the § 06 design-partner heading");
assert(includes(home, "Apply to be a design partner"), "Home is missing the § 06 design-partner link");
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
assert(closeCta.includes('href="/design-partners"') && includes(closeCta, "Apply to be a design partner"), "§ 06 design-partner CTA must stay");
assert(includes(home, "sdf task declare records the task"), "Home is missing the Declare line");
assert(includes(home, "Routing a task to an agent you already use is planned."), "Home Route line drifted");
assert(includes(home, "Your agents stay in place. SDF records what they did."), "How-it-works lede drifted");
assert(includes(home, "Vendor-neutral"), "Home is missing the vendor-neutral pillar");
assert(
  includes(home, "onboarding 3 to 5 platform teams already running two or more agents"),
  "Home is missing the closing CTA",
);
assert(includes(home, "Planned"), "Home must label unshipped steps as Planned");
assert(includes(home, "go install github.com/paulpham157/sdf/cmd/sdf@latest"), "Home is missing the real install path");
assert(includes(home, "go install github.com/paulpham157/sdf/cmd/sdf@v0.1.0"), "Home is missing the v0.1.0 pin");
assert(includes(home, "https://github.com/paulpham157/sdf/releases/tag/v0.1.0"), "Home is missing the v0.1.0 release");
assert(includes(home, "unless you opt in"), "Home must say content is opt-in");
assert(
  includes(home, "v0.1.0 is open source under Apache 2.0. sdf serve listens on localhost and serves a read-only page. Authentication is off by default, so keep the receiver on localhost."),
  "Home shipping copy drifted",
);
assert(!includes(home, "listens on localhost for OTLP"), "Home must not put the OTLP receiver detail back in the shipping paragraph");
assert(!includes(home, "optional bearer token"), "Home must not put the bearer-token detail back in the shipping paragraph");
assert(!includes(home, "read-only UI on localhost"), "Home shipping copy still uses the old UI sentence");
assert(includes(home, "it says unknown instead of guessing"), "Cost point drifted");
assert(includes(home, "the session stays unlinked."), "Record line must keep the unlinked rule");
assert(!includes(home, "commit trailer"), "Homepage must not list the commit-link rules");
assert(!includes(home, "from the OpenTelemetry each one exports"), "Coverage paragraph still has the export clause");
assert(!includes(home, "This is headed toward"), "Homepage moat was removed");
assert(!includes(home, "either way"), "either way must stay out of the homepage");
assert(includes(home, "The exact commit-link rules are in "), "Commit-link docs line drifted");
assert(includes(home, "is spelled out in "), "Accepted-definition docs line drifted");
assert(includes(home, "go install builds from source and needs Go 1.26 or newer."), "Home install note drifted");
assert(!includes(home, "Cost per Accepted Outcome is unknown without --github"), "The install note still repeats the unknown-cost conditions");
assert(home.includes('id="today"'), "Install section must keep id today");
assert(
  includes(home, "https://github.com/paulpham157/sdf/blob/main/docs/outcomes.md#linking-a-session-to-a-commit"),
  "Home must link the commit-link rules in the product docs",
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

function assertInstallProtected(html, label) {
  const blocks = emailOffBlocks(html);
  assert(
    blocks.some((block) => block.includes("go install github.com/paulpham157/sdf/cmd/sdf@v0.1.0")),
    `${label} must keep sdf@v0.1.0 inside Cloudflare's email_off markers`,
  );
  assert(
    blocks.every((block) => !block.includes("design-partners@softwaredecisionfabric.tech")),
    `${label} must not disable obfuscation for the contact address`,
  );
  assert(!html.includes("/cdn-cgi/l/email-protection"), `${label} must not rewrite the install command`);
}

assertInstallProtected(home, "Home");
assertInstallProtected(pricing, "Pricing");
assertInstallProtected(onePager, "One-pager");
assert(includes(home, "Token counts"), "Home must say token counts are stored");
assert(includes(pricing, "go install github.com/paulpham157/sdf/cmd/sdf@latest"), "Pricing must lead with the local install");
assert(includes(pricing, "https://github.com/paulpham157/sdf/releases/tag/v0.1.0"), "Pricing is missing the v0.1.0 release");
assert(includes(pricing, "linked GitHub pull request merged"), "Pricing must say accepted means a merged pull request");
assert(
  includes(home, "https://github.com/paulpham157/sdf/blob/main/docs/outcomes.md#pull-requests-and-ci"),
  "Home must link the accepted and unknown-cost rules",
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
assert(!home.includes("$"), "Home must not contain dollar amounts");
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
assert(llms.includes("Route is Planned"), "llms.txt still uses the old step count");
assert(llms.includes("Declare, Verify, and Record are partly shipped"), "llms.txt must say which steps are partly shipped");
assert(!llms.includes("three planned, one partly shipped"), "llms.txt still says three steps are planned");
assert(llmsFull.includes("Accepted means merged"), "llms-full must keep the accepted definition");
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
