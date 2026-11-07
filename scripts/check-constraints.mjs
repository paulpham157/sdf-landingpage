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
  assert(includes(page.html, "toy fixture"), `${page.file} does not mention the toy fixture`);
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
assert(includes(home, "independent referee for coding agents"), "Home is missing the subhead");
assert(includes(home, 'href="/blog"'), "Home is missing the blog link");
assert(includes(home, "Become a design partner"), "Home is missing the primary CTA");
assert(includes(home, "See a sample Evidence Report"), "Home is missing the secondary CTA");
assert(includes(home, "Declare the objective and acceptance criteria"), "Home is missing step 1");
assert(includes(home, "Vendor-neutral"), "Home is missing the vendor-neutral pillar");
assert(
  includes(home, "onboarding 3 to 5 platform teams already running two or more agents"),
  "Home is missing the closing CTA",
);
const verifiedAttempt =
  "A verified Attempt is a recorded run whose evidence was checked independently of the agent that produced it, against criteria that run did not get to choose.";
assert(home.includes(verifiedAttempt), "Home is missing the verified Attempt sentence");
assert(pricing.includes(verifiedAttempt), "Pricing is missing the verified Attempt sentence");
const costPerAcceptedOutcome =
  "Cost per Accepted Outcome is what you spend on work whose result a named principal actually accepted, not what you spend per seat, per session, or per agent claiming a task is done.";
assert(home.includes(costPerAcceptedOutcome), "Home is missing the Cost per Accepted Outcome sentence");
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

assert(includes(onePager, "SDF: the independent referee for coding agents"), "One-pager headline drifted");
assert(onePager.includes("Cost per Accepted Outcome"), "One-pager is missing Cost per Accepted Outcome");
assert(!onePager.includes("$"), "One-pager must not carry dollar figures");
assert(!includes(onePager, "OpenHands"), "One-pager must not present market anchors");

assert(includes(sample, "not a customer report"), "Sample report is not clearly labeled");
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
  assert(file.includes("Hosted Team"), "llms text dropped Hosted Team");
  assert(!file.includes("Hosted Pro"), "llms text renamed the hosted tier");
  assert(file.includes("design-partners@softwaredecisionfabric.tech"), "llms text is missing the contact address");
  assert(!/placeholder mailbox/i.test(file), "llms text still calls the mailbox a placeholder");
  assert(!file.includes("testimonial"), "llms text invented social proof");
}
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

if (failures.length) {
  console.error("Copy and constraint checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Constraint checks passed (${pages.length} pages).`);
