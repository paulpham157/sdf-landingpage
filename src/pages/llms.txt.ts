import type { APIRoute } from "astro";
import { site, wedgeMetric } from "../data/site";

const body = `# ${site.name} (${site.shortName})

> ${site.tagline} SDF verifies every agent attempt against your acceptance criteria and shows ${wedgeMetric}, across every agent you run. SDF does not sell an agent and does not resell model tokens. ${site.status} SDF dollar amounts are not published. The hosted tier is named Hosted Team.

This file restates public pages on ${site.url}. It is not a customer list, a price sheet, or a set of results.

## Pages

- [Home](${site.url}/): what SDF is, the four steps, and the three commitments.
- [Pricing](${site.url}/pricing): Hosted Team and Enterprise. Amounts are not published. OpenHands, Factory, and Ona figures are cited coding-agent list prices, not SDF prices.
- [One-pager](${site.url}/one-pager): the same brief on one page.
- [Sample Evidence Report](${site.url}/sample-evidence-report): a labeled mock. Not a customer report.
- [Blog](${site.url}/blog): notes. Posts marked Sample are specimens, not results. Drafts are not published.
- [Design partners](${site.url}/design-partners): the contact form opens an email draft. It does not submit to a server.

## Contact

${site.emailIsPlaceholder ? `${site.email} is a placeholder mailbox until that inbox is confirmed.` : `${site.email}. The design-partner form opens an email draft and does not submit to a server.`}

## More detail

- [Full public facts](${site.url}/llms-full.txt)
`;

export const GET: APIRoute = () =>
  new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
