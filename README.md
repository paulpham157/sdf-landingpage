# Software Decision Fabric

Marketing site for [softwaredecisionfabric.tech](https://softwaredecisionfabric.tech/).

SDF is the independent referee for coding agents. This site follows the draft v0 landing, pricing, and one-pager: vendor-neutral verification, evidence a team can re-run, and cost per acceptable outcome. It is written for the design-partner program. SDF runs live only on a toy fixture, so the pages do not show customer logos, testimonials, case studies, result metrics, or SDF dollar prices.

## Run locally

Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

## Production build

```bash
npm run build
npm run check:copy
npm run preview
```

`npm run build` writes a static site to `dist/`. `npm run check:copy` fails the build output if a page drifts into invented prices, customer proof, or a missing toy-fixture disclosure. Preview serves `dist/` at [http://localhost:4321](http://localhost:4321).

## Routes

| Path | Page |
| --- | --- |
| `/` | Landing: hero, problem, four steps, three commitments, design-partner close |
| `/pricing` | Hosted Team and Enterprise. Amounts say “Not published.” OpenHands, Factory, and Ona figures are labeled as market anchors, not SDF prices |
| `/one-pager` | The same brief on one sheet. Use **Print or save as PDF** |
| `/sample-evidence-report` | A stylized mock Evidence Report. Labeled sample. Not a customer report |
| `/design-partners` | Design-partner contact. No backend |

## Contact placeholder

`design-partners@softwaredecisionfabric.tech` is a **placeholder mailbox**. The form does not post to a server. It opens an email draft, and the address is marked as a placeholder in the footer and on the contact page.

Before launch, confirm that inbox or change `email` in [`src/data/site.ts`](src/data/site.ts). That constant is the only place the address is defined.

## Deploy to softwaredecisionfabric.tech

The site is static HTML, CSS, and a small amount of page-specific JavaScript (the print button and the mailto form). Cloudflare Pages or Netlify can host it in front of the existing domain.

1. Connect this GitHub repository to the host.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Node version: 22
5. Add the custom domain `softwaredecisionfabric.tech`.
6. Redirect `www.softwaredecisionfabric.tech` to the apex.
7. Point DNS at the host: the host’s apex record (ALIAS, ANAME, or the addresses they publish) and a CNAME for `www` if you keep it.
8. Confirm the placeholder mailbox, or change it, before announcing the page.
9. No analytics script is included.

`public/_headers` is copied into `dist/` and sets a few response headers on Cloudflare Pages and Netlify (`nosniff`, referrer policy, frame denial, an asset cache for `/_astro/*`).

`public/robots.txt` allows crawling and points at the generated sitemap, `https://softwaredecisionfabric.tech/sitemap-index.xml`. Each page sets a title, description, canonical URL, and Open Graph / Twitter card tags. The default social image is `public/og.png`.

## What the copy will not claim

- SDF prices. Both tiers say the amount is not published. The shape (workspace fee, verified Attempts, Enterprise platform fee) is described without numbers.
- Market anchors. OpenHands ($500/mo for 10 users), Factory ($60 + seats and a $25k/yr fee), and Ona ($60k/yr commit on AWS listings) appear only on the pricing page, in a section and a table row that say they are not SDF prices.
- Customers. There are no logos, quotes, case studies, or performance metrics. The Evidence Report is a labeled mock (`SAMPLE-TOY-001` on workspace `toy-fixture`).
- A company address, team photos, or a legal entity name. None of those were invented.
- A working form API. Until one exists, the contact path is the documented mailto placeholder.

## Stack

[Astro](https://astro.build/) 7 renders the pages to static files. Type is set in `src/data/site.ts` and the components. Fraunces, Source Sans 3, and IBM Plex Mono are self-hosted through Fontsource (SIL Open Font License; see `licenses/`). There is no UI kit and no tracking.

GitHub Actions (`.github/workflows/build.yml`) runs `npm ci`, `npm run build`, and `npm run check:copy` on pushes and pull requests.
