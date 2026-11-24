# Software Decision Fabric

Marketing site for [softwaredecisionfabric.tech](https://softwaredecisionfabric.tech/).

Software Decision Fabric is a local OpenTelemetry collector and decision ledger for coding agents. v0.1.0 is public (Apache 2.0) and runs on the user's machine. This site also describes a planned hosted referee. That loop is shown only as a labeled mock where the mock appears, so the pages do not show customer logos, testimonials, case studies, result metrics, or SDF dollar prices. Declare, Verify, and Record are partly shipped. Route is planned.

Copy lives in [`src/data/site.ts`](src/data/site.ts). The product repository is [github.com/paulpham157/sdf](https://github.com/paulpham157/sdf).

## Run locally

Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

`npm run build` writes the static site to `dist/`. `npm run check:copy` and `npm run check:jsonld` check that output. `npm run preview` serves `dist/` on the same port.

## Deploy

Create the Pages project once, in your own terminal:

```bash
npm ci
npm exec wrangler -- login
npm exec wrangler -- pages project create sdf-landing --production-branch main
```

Do not run `pages project create` from an agent session. Wrangler 4.158.0 can create a Worker instead of a Pages project when `sdf-landing` is missing. `npm run deploy` only uploads when that project already exists. A clean `main` checkout is production; any other branch is a preview. The command prints the project's `pages.dev` URL. It does not attach the custom domain. `npm run deploy` does not read Terraform state and does not use an R2 bucket. `npm run deploy` không đọc Terraform và không dùng bucket R2.

Project settings, DNS, and the optional custom domain are documented in [`infra/cloudflare/README.md`](infra/cloudflare/README.md). Response headers are in [`public/_headers`](public/_headers).

## Routes

| Path | Page |
| --- | --- |
| `/` | Landing |
| `/pricing` | Hosted Team and Enterprise. Amounts are not published |
| `/blog` | Posts from `src/content/blog`. Drafts are not built |
| `/one-pager` | The same brief on one sheet |
| `/sample-evidence-report` | Labeled mock Evidence Report |
| `/design-partners` | Design-partner contact. Opens an email draft |

## Content

Add a post as Markdown or MDX under [`src/content/blog/`](src/content/blog/). The filename is the URL slug. Frontmatter requires `title`, `date`, and `summary`. `draft: true` keeps the file out of the build. `sample: true` marks a specimen. Quoted social posts use [`src/components/SocialCitation.astro`](src/components/SocialCitation.astro).

The contact address is `email` in [`src/data/site.ts`](src/data/site.ts) (`design-partners@softwaredecisionfabric.tech`).

## Stack

[Astro](https://astro.build/) 7 builds static HTML. [`.github/workflows/build.yml`](.github/workflows/build.yml) installs, tests, builds, and runs the checks. [`.github/workflows/terraform.yml`](.github/workflows/terraform.yml) validates the Pages Terraform. Neither workflow deploys.
