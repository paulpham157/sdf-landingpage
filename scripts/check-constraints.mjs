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
  assert(includes(page.html, "toy fixture"), `${page.file} does not mention the toy fixture`);
  assert(includes(page.html, "Placeholder mailbox"), `${page.file} does not mark the mailbox as a placeholder`);
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
assert(!home.includes("$"), "Home must not contain dollar amounts");
assert(!includes(home, "OpenHands"), "Home must not show market-anchor prices");
assert(!/\bOna\b/.test(home), "Home must not show the Ona anchor");

assert(includes(pricing, "Not published"), "Pricing must leave SDF amounts unpublished");
assert(includes(pricing, "never per seat"), "Pricing is missing the price shape");
assert(includes(pricing, "OpenHands"), "Pricing is missing the OpenHands anchor");
assert(includes(pricing, "$500/mo for 10 users"), "Pricing is missing the OpenHands figure");
assert(includes(pricing, "$60 + seats"), "Pricing is missing the Factory seat figure");
assert(includes(pricing, "$25k/yr fee"), "Pricing is missing the Factory annual figure");
assert(includes(pricing, "$60k/yr commit (AWS listings)"), "Pricing is missing the Ona figure");
assert(includes(pricing, "Not SDF pricing"), "Market anchors are not labeled as other companies' prices");
assert(includes(pricing, "not an SDF price"), "The comparison row does not say the anchors are not SDF prices");
assert(includes(pricing, "Why not per seat?"), "Pricing is missing the FAQ");
assert(includes(pricing, "SSO (SAML/OIDC), SCIM"), "Pricing is missing Enterprise identity");

assert(includes(onePager, "SDF: the independent referee for coding agents"), "One-pager headline drifted");
assert(includes(onePager, "cost per acceptable outcome"), "One-pager is missing the outcome");
assert(!onePager.includes("$"), "One-pager must not carry dollar figures");
assert(!includes(onePager, "OpenHands"), "One-pager must not present market anchors");

assert(includes(sample, "not a customer report"), "Sample report is not clearly labeled");
assert(includes(sample, "SAMPLE-TOY-001"), "Sample report is missing its specimen id");
assert(includes(sample, "sample-c0ffee1"), "Sample report is missing the specimen revision");
assert(!sample.includes("$"), "Sample report must not invent dollar amounts");
assert(includes(sample, "Not published") || includes(sample, "not published"), "Sample report should keep SDF price unpublished");

assert(includes(partners, "mailto:design-partners@softwaredecisionfabric.tech"), "Design-partner page is missing the mailto");
assert(includes(partners, "email draft"), "Design-partner page does not explain the mailto behavior");
assert(includes(partners, "SDF server"), "Design-partner page does not say the site does not submit to a server");

const robots = readFileSync(join(dist, "robots.txt"), "utf8");
assert(includes(robots, "sitemap-index.xml"), "robots.txt is missing the sitemap");

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

if (failures.length) {
  console.error("Copy and constraint checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Constraint checks passed (${pages.length} pages).`);
