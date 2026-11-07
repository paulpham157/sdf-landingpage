# Cloudflare Pages for the SDF landing site

Terraform configuration for a static [Cloudflare Pages](https://developers.cloudflare.com/pages/) project. It describes the project only. It does not publish `dist/`, and nothing in this repository applies it.

Checked against the Cloudflare provider schema published with v5.28.1 (20 October 2026) and Terraform 1.17.1. The v5 names are `cloudflare_pages_project`, `cloudflare_pages_domain` (`name`, not the v4 `domain` argument), and `cloudflare_dns_record`.

## Why Pages

Cloudflare recommends [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) for new sites. This repository already specifies Pages: `npm run build`, output `dist`, Node 22, and the apex `softwaredecisionfabric.tech`. `public/_headers` is a Pages (and Netlify) static headers file. Moving the site to Workers would be a different host and a different asset configuration. This stack stays on Pages and creates no Worker, route, KV, R2, D1, or Access resource.

## What an apply would create

| Flag | Default | Resource |
| --- | --- | --- |
| (always) | on | `cloudflare_pages_project.site` |
| `enable_custom_domain` | `false` | `cloudflare_pages_domain.apex` for `domain` |
| `attach_www` | `false` | `cloudflare_pages_domain.www` for `www.<domain>` |
| `manage_dns` | `false` | Proxied `CNAME` records for those hostnames only |
| `enable_git_source` | `false` | GitHub `source` on the project |
| `enable_automatic_deployments` | `false` | Production and preview builds on push |

The default apply is the Pages project: build command `npm run build`, destination `dist`, production branch `main`, build image major version 3, and `NODE_VERSION=22` as a plain-text variable on production and preview. No custom hostname, no DNS, no Git connection, no automatic deployment.

Build image v3 is the current Pages image and defaults to Node 22. `NODE_VERSION` is the documented override (`https://developers.cloudflare.com/pages/configuration/build-image/`). v1 images are retired. The variable is not a secret. Preview receives that same pin and no other variables.

Direct Upload does not run the Pages build image. The build settings are stored so a later, explicit Git opt-in builds the same Astro command. Publishing the files is a separate step below.

`lifecycle.prevent_destroy` is set on the project, the domain attachments, and the CNAMEs. Terraform only accepts a literal there, so turning destruction on takes a reviewed code change.

## What it will not take over

- No `cloudflare_zone`. The zone must already exist. Nameservers are not changed.
- No MX, TXT, CAA, NS, or wildcard records. The contact mailbox `design-partners@softwaredecisionfabric.tech` is untouched.
- `allow_overwrite` was removed in provider v5. If a record already exists at the apex or `www`, apply stops with a conflict. It does not replace that record. Import it, or leave `manage_dns` false.
- On Cloudflare, a proxied apex CNAME is flattened and can sit beside existing MX records. This configuration never sets `type` to `MX` or `TXT`.
- No redirect ruleset. A zone has one `http_request_dynamic_redirect` ruleset; creating `cloudflare_ruleset` would take ownership of that phase. `www` → apex is not automated. The Astro site, `public/_headers`, `public/robots.txt`, the static 404, and canonical URLs are unchanged.
- No token, account id, or zone id is committed. `terraform.tfvars.example` uses an all-zero account id as a placeholder, not as a real account.

## Ownership

Terraform owns the Pages project and, only when the flags are on, its custom domains and the CNAME records. There is no `wrangler.toml` and no `cloudflare.config.ts`. Do not add one that also sets the project name, build command, or environment. Wrangler and Terraform must not both reconcile those settings.

Uploading `dist/` is not `terraform apply`. The [Direct Upload](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/) command, run by a person after the project exists, is:

```bash
CLOUDFLARE_ACCOUNT_ID="<account id>" npx wrangler pages deploy dist --project-name="<project name>"
```

`CLOUDFLARE_API_TOKEN` is the same environment variable, not a shell argument. Run the upload from a checkout of `main`. Pages uses the current Git branch as the deployment branch unless a branch option is set, and a non-production branch becomes a preview. Do not point Wrangler at a second project name. If Wrangler creates the project before Terraform does, import the project instead of applying a second create.

## Git integration is opt-in and one-way

The provider requires a GitHub or GitLab account already connected to Cloudflare before a `source` block can be applied. Connecting it is not a Terraform step:

1. Install the **Cloudflare Workers & Pages** GitHub App and authorize it (`https://github.com/settings/installations`, or the organization installations page).
2. Limit the app to this repository. Cloudflare's guidance is that one GitHub account should point at one Cloudflare account.
3. Only then set `enable_git_source`, `git_owner`, and `git_repo_name`.

`git_owner_id` and `git_repo_id` stay null unless the installed app has given you those numeric ids. Do not invent them.

[Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/) cannot be switched back to Direct Upload on the same project. Leave `enable_git_source` false to keep Direct Upload. Setting it is a one-way choice for that project.

`enable_git_source` alone still sets `production_deployments_enabled` and `deployments_enabled` to false, `preview_deployment_setting` to `none`, and `pr_comments_enabled` to false. Pushes do not build, and Pages does not comment on pull requests. Provider 5.28.1 warns that `deployments_enabled` is deprecated and points at the two granular attributes. Those are set as well. The deprecated attribute stays, set to false, because its schema text is the switch that disables both production and preview builds. `terraform test` prints that warning when the Git opt-in is planned. It is not an error. `enable_automatic_deployments` is a second flag and is rejected unless Git source is on. This repository does not turn that flag on, and CI does not deploy.

Preview deployments, when someone later enables them, are `*.pages.dev` URLs. Custom domains are separate `cloudflare_pages_domain` resources and are not set to a `pages.dev` name. Preview environment variables stay the public `NODE_VERSION` pin. There is no `secret_text` variable. The Astro `site` in `astro.config.mjs` stays `https://softwaredecisionfabric.tech`, so a preview document still canonicalizes to production. That is existing site behavior; this stack does not add the production hostname to a preview.

## Custom domain and DNS

`cloudflare_pages_domain` does not create DNS. The provider documents that separately (its page still says `cloudflare_record`; the v5 resource is `cloudflare_dns_record`). The dashboard flow can add a CNAME for a zone already on the account. This configuration will not, unless `manage_dns` is true.

An apex hostname has to be a zone on the same Cloudflare account as the Pages project. This stack does not create that zone. A subdomain can be a CNAME from DNS that is not Cloudflare; `manage_dns` only works for a zone id you already have.

When `manage_dns` is true the record is:

| Name | Type | Content | Proxy | TTL |
| --- | --- | --- | --- | --- |
| the apex, as a full hostname | `CNAME` | the project's `pages_subdomain` output | proxied | `1` (automatic) |

`www.<domain>` is added only with `attach_www`. Names are full hostnames. Provider v5 compares `name` to the API's FQDN, so `@` is not used. TTL `1` is required for proxied records. The CNAME depends on the Pages domain attachment. Pages returns HTTP 522 if DNS points at `*.pages.dev` before the hostname is attached to the project.

Certificate status moves through `initializing`, `pending`, and `active`. CAA records are not managed. If issuance stays pending, the custom-domain docs say the existing CAA set must allow `letsencrypt.org`, `pki.goog`, and `ssl.com`. Changing CAA is a separate review. Do not delete unrelated CAA, MX, or TXT records.

`www` → apex is still a product requirement in the site README and is intentionally not in this stack. Add it only after reading the current dynamic-redirect ruleset, or import that ruleset in a later change. Do not create a new ruleset over an existing one.

## Token

Create an account API token. The provider reads `CLOUDFLARE_API_TOKEN`. Do not put the token in tfvars, CLI arguments, or this repository.

Dashboard permission names are from the [permissions list](https://developers.cloudflare.com/fundamentals/api/reference/permissions/). The provider's accepted names are on each resource page.

| When | Dashboard permission | Scope | Provider name |
| --- | --- | --- | --- |
| Always | Account → Cloudflare Pages → Edit | This account only | `Pages Write` (the resource also lists `Pages Read`) |
| `manage_dns = true` only | Zone → DNS → Read and DNS → Edit | This zone only | `DNS Read` and `DNS Write` |

The direct-upload docs use the same Pages Edit permission for `wrangler pages deploy`. Do not add Zone Settings, Email Routing, Firewall, or access to every zone. Do not use the Global API Key (`CLOUDFLARE_API_KEY` / `CLOUDFLARE_EMAIL`).

## Remote state

Do not apply with local state. The committed backend is an empty S3 block:

```hcl
backend "s3" {}
```

Bucket, key, region, and lock settings are not in git.

1. Outside this state, create a private S3 bucket. Enable versioning and default encryption. Block public access.
2. Grant the operator `s3:ListBucket` on the bucket, `s3:GetObject` and `s3:PutObject` on the state key, and `s3:GetObject`, `s3:PutObject`, and `s3:DeleteObject` on the `<key>.tflock` object. That is the [S3 backend lock](https://developer.hashicorp.com/terraform/language/backend/s3) permission set for `use_lockfile`.
3. Copy `backend.hcl.example` to `backend.hcl`. Fill bucket, key, and region. Leave credentials out of the file.
4. `terraform init -backend-config=backend.hcl`

`use_lockfile = true` is the S3-native lock (generally available in Terraform 1.11 and later; this repo was checked with 1.17.1). A second apply fails while the `.tflock` object exists, instead of overwriting the state. DynamoDB locking is not used. HCP Terraform is the other locked backend, via `TF_TOKEN_app_terraform_io` and a `cloud` block this repository does not commit. This configuration does not use Cloudflare R2 for state: the lock depends on S3 conditional writes, and that was not verified for R2.

`terraform init -backend=false` is for format, validate, and `terraform test` only. It is not an apply.

## Plan, review, apply

```bash
cd infra/cloudflare
cp terraform.tfvars.example terraform.tfvars   # then replace account_id
export CLOUDFLARE_API_TOKEN="..."              # shell only; never commit it
terraform init -backend-config=backend.hcl
terraform plan -out=sdf.tfplan
```

Review the plan before apply:

- The only create, on a fresh account, is `cloudflare_pages_project.site`, unless you opted in.
- No zone, MX, TXT, CAA, ruleset, Worker, or secret environment variable.
- Opt-in DNS is `CNAME` only, names are the apex and optionally `www`, content ends in `.pages.dev`.
- Git `source` is absent unless you set the flag. If it is present, `preview_deployment_setting` is `none` and both deployment booleans are false, unless you also set `enable_automatic_deployments`.
- A second plan that only rewrites `deployment_configs` fields this configuration does not set is the known provider drift (the API fills defaults). Stop. Do not apply that diff, and do not add `ignore_changes` until the Node pin is still visible in review. `ignore_changes` on the whole block would hide a real `NODE_VERSION` edit.

`terraform apply sdf.tfplan` is a human step. This repository's GitHub Actions workflow does not run it. Apply is not transactional across resources. A failure after the project is created leaves the project in state and leaves DNS as it was. Run plan again and continue. A Pages domain can stay `pending` until DNS points at it; that is not a reason to edit mail records.

DNS and certificate changes propagate on their own schedule. Previous resolver TTLs can outlive Cloudflare's automatic TTL. Treat an apex CNAME change as a cutover: import or review the existing apex record first.

## Rollback

A bad upload is a Pages deployment rollback, not a Terraform destroy. In the project, open **Deployments**, then **All deployments**, then the action menu on a successful production deployment, then **Rollback to this deployment**. Preview deployments are not rollback targets. Rollback does not change Terraform state.

A bad infrastructure change is a reverted commit and a new plan. `prevent_destroy` blocks `terraform destroy` and blocks removing these resources from config. To delete one on purpose: change `prevent_destroy` to `false` in a reviewed commit, plan, and only then destroy. Destroying the project deletes its deployments. Destroying a CNAME deletes that record only. Cloudflare's domain docs remove the CNAME before the custom domain attachment.

If state is wrong, restore the previous object version from the bucket. Do not hand-edit the state.

## Import an existing project

Import before apply when the project or record already exists. A create against an existing project or record conflicts; it does not adopt it.

```bash
terraform import cloudflare_pages_project.site '<account_id>/<project_name>'
terraform import 'cloudflare_pages_domain.apex[0]' '<account_id>/<project_name>/<domain>'
terraform import 'cloudflare_dns_record.apex[0]' '<zone_id>/<dns_record_id>'
```

The same shapes work for `www[0]`. Record ids come from the DNS API or dashboard, not from this repository. The provider cannot import a Pages project that still has secret environment variables; remove those secrets before import. This configuration has no secrets to put back.

After import, run plan. The plan should show no MX or TXT changes and no replacement of an existing record. If it shows a replace, stop.

## Validate without credentials

```bash
cd infra/cloudflare
terraform fmt -check -recursive
terraform init -backend=false -input=false
terraform validate
terraform test
```

`terraform test` plans against a mocked provider. It does not call Cloudflare. `.github/workflows/terraform.yml` runs those commands and exits if `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_API_KEY`, or `CLOUDFLARE_EMAIL` is set. Do not add an apply job there.
