import type { APIRoute } from "astro";
import {
  acceptedToday,
  closing,
  faqs,
  hero,
  homeCost,
  homeInstall,
  homePartners,
  homeVerify,
  marketAnchorNote,
  marketAnchors,
  onePager,
  pillars,
  pricingIntro,
  problem,
  shipsToday,
  site,
  statusLabel,
  steps,
  tiers,
  wedgeMetric,
} from "../data/site";

const lines: string[] = [];
const write = (...parts: string[]) => lines.push(...parts);

write(
  `# ${site.name} (${site.shortName})`,
  "",
  hero.subhead,
  "",
  site.status,
  "SDF dollar amounts are not published. The public site does not show customer logos, customer quotes, case studies, or result metrics.",
  `The public name of the metric is ${wedgeMetric}. The hosted tier is named Hosted Team.`,
  site.emailIsPlaceholder
    ? `${site.email} is a placeholder mailbox. The design-partner form opens an email draft and does not submit to a server.`
    : `${site.email}. The design-partner form opens an email draft and does not submit to a server.`,
  "",
  "## Proof: a checked commit",
  "",
  `${homeVerify.label}. ${homeVerify.caption}`,
  `$ ${homeVerify.failCommand}`,
  `verdict FAIL ${homeVerify.failHash}`,
  `  ${homeVerify.failReason}`,
  "",
  `$ ${homeVerify.passCommand}`,
  `verdict PASS ${homeVerify.passHash}`,
  "",
  homeVerify.footnote,
  `${homeVerify.linkLabel}: ${homeVerify.linkUrl}`,
  "",
  "## Proof: cost that won't guess",
  "",
  `${homeCost.label}. ${homeCost.caption}`,
  homeCost.columns.join(" | "),
);
for (const row of homeCost.rows) {
  write(row.join(" | "));
}
write(
  homeCost.cpao,
  "",
  homeCost.footnote,
  `${homeCost.linkLabel}: ${homeCost.linkUrl}`,
  "",
  "## Get started",
  "",
  ...homeInstall.lines,
  `${homeInstall.beforeArchive}${homeInstall.archiveLabel}${homeInstall.beforeDocs}${homeInstall.docsLabel}${homeInstall.afterDocs}`,
  `Release: ${shipsToday.releaseUrl}`,
  `Docs: ${homeInstall.docsUrl}`,
  "",
  "## Homepage design partners",
  "",
  homePartners,
  "",
  "## Steps",
  "",
);
for (const step of steps) {
  write(`- ${step.id} ${step.title} (${statusLabel[step.status]}): ${step.body}`);
}
write("", "## Why SDF", "", problem.coverage, "");
for (const pillar of pillars) {
  write(`- ${pillar.title}: ${pillar.body}`);
}
write(
  "",
  acceptedToday,
  "",
  `## ${shipsToday.heading}`,
  "",
  shipsToday.body,
  `Install: ${shipsToday.install}`,
  `Pin: ${shipsToday.installPin}`,
  `Release: ${shipsToday.releaseUrl}`,
  `Run: ${shipsToday.run.join(", ")}`,
  `${shipsToday.note.command}${shipsToday.note.after}`,
  `Source: ${site.repo}`,
);
write(
  "",
  "## Pricing shape",
  "",
  pricingIntro.lede,
  pricingIntro.unpublished,
  "",
);
for (const tier of tiers) {
  write(
    `### ${tier.name}`,
    "",
    `For: ${tier.for}`,
    `Price shape: ${tier.priceShape}`,
    `Agents: ${tier.agents}`,
    `Evidence: ${tier.evidence}`,
    `Deployment: ${tier.deployment}`,
    `Identity: ${tier.identity}`,
    "Amount: not published.",
    "",
  );
}
write("## Coding-agent list prices", "", marketAnchorNote.body, "");
for (const anchor of marketAnchors) {
  const sources = anchor.sources.map((source) => `${source.label} (${source.url})`).join("; ");
  write(`- ${anchor.product}: ${anchor.figure} Source: ${sources}`);
}
write("", marketAnchorNote.again, "", "## Questions already on the pricing page", "");
for (const item of faqs) {
  write(`- ${item.q} ${item.a}`);
}
write(
  "",
  "## One-pager",
  "",
  onePager.headline,
);
for (const section of onePager.sections) {
  write(`- ${section.title}: ${section.body}`);
}
write("", onePager.cta, "", "## Design partners", "", closing.body, "", `Site: ${site.url}/`);

export const GET: APIRoute = () =>
  new Response(`${lines.join("\n")}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
