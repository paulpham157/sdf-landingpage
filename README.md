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

Deploy with `npm run deploy`. That command builds the site and uploads `dist/` to the existing Cloudflare Pages project `sdf-landing` by Direct Upload. A clean `main` checkout is production; any other branch is a preview. The command prints the project's `pages.dev` URL.

Create the Pages project once, in your own terminal, before the first upload:

```bash
npm ci
npm exec wrangler -- login
npm exec wrangler -- pages project create sdf-landing --production-branch main
```

Do not run `pages project create` from an agent session. Wrangler 4.158.0 can create a Worker instead of a Pages project when `sdf-landing` is missing. `npm run deploy` only uploads when that project already exists.

`npm run deploy` needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The token is an account API token with Cloudflare Pages: Edit. Copy [`.env.example`](.env.example) to `.env` at the repo root for a local shell. `npm run deploy` loads that file when it exists. A value already set in the shell wins. `.env` is not committed. When `.env` is absent, the command keeps the variables already in the process environment. The GitHub Actions deploy does not create a `.env` file.

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) installs with `npm ci`, builds, runs `npm run check:copy` and `npm run check:jsonld`, then runs `npm run deploy`. That command builds and checks again and uploads `dist/` to the existing Pages project `sdf-landing`. A push to `main` is production and is recorded on the GitHub `production` environment (`https://sdf-landing.pages.dev`). A push to any other branch is a preview (the Pages branch alias) on the `preview` environment. `workflow_dispatch` deploys the branch you select. Pull requests do not deploy.

The workflow needs two repository secrets, added under Settings → Secrets and variables → Actions. `CLOUDFLARE_API_TOKEN` is an account API token with Cloudflare Pages: Edit. `CLOUDFLARE_ACCOUNT_ID` is the account id. They are passed only to the secret check and to `npm run deploy`. If either secret is missing on `main`, the check names it, says where to add it, and fails the production job. On any other branch it emits a notice and skips the preview. Secret values are not printed.

Push lên `main` là bản production. Push lên nhánh khác là bản xem trước (alias của nhánh). `workflow_dispatch` chạy nhánh được chọn. Workflow cần `CLOUDFLARE_API_TOKEN` (quyền Cloudflare Pages: Edit) và `CLOUDFLARE_ACCOUNT_ID`. Thiếu secret trên `main` thì job lỗi; trên nhánh khác thì ghi notice và bỏ qua. Không cần file `.env`.

Attach the custom domain in the Cloudflare dashboard. Response headers are in [`public/_headers`](public/_headers).

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

[Astro](https://astro.build/) 7 builds static HTML. [`.github/workflows/build.yml`](.github/workflows/build.yml) installs, tests, builds, and runs the checks. It does not deploy. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publishes the site with `npm run deploy`.
