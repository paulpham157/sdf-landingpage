import type { APIRoute } from "astro";
import {
  closing,
  faqs,
  hero,
  marketAnchorNote,
  marketAnchors,
  onePager,
  pillars,
  pricingIntro,
  site,
  steps,
  tiers,
  wedgeMetric,
} from "../data/site";

const lines: string[] = [];
const write = (...parts: string[]) => lines.push(...parts);

write(
  `# ${site.name} (${site.shortName})`,
  "",
  site.tagline,
  "",
  hero.subhead,
  "",
  site.status,
  "SDF dollar amounts are not published. The public site does not show customer logos, customer quotes, case studies, or result metrics.",
  `The public name of the metric is ${wedgeMetric}. The hosted tier is named Hosted Team.`,
  `${site.email} is a placeholder mailbox. The design-partner form opens an email draft and does not submit to a server.`,
  "",
  "## How it works",
  "",
);
for (const step of steps) {
  write(`- ${step.id} ${step.title}: ${step.body}`);
}
write("", "## Commitments", "");
for (const pillar of pillars) {
  write(`- ${pillar.title}: ${pillar.body}`);
}
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
