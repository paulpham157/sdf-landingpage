# Cloudflare Pages for the SDF landing site

Terraform configuration for a static [Cloudflare Pages](https://developers.cloudflare.com/pages/) project. It describes the project only. It does not publish `dist/`, and nothing in this repository applies it.

Checked against the Cloudflare provider schema published with v5.28.1 (20 October 2026) and Terraform 1.17.1. The v5 names are `cloudflare_pages_project`, `cloudflare_pages_domain` (`name`, not the v4 `domain` argument), and `cloudflare_dns_record`.

## Why Pages

Cloudflare recommends [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) for new sites. This repository already specifies Pages: `npm run build`, output `dist`, Node 22, and the apex `softwaredecisionfabric.tech`. `public/_headers` is a Pages (and Netlify) static headers file. Moving the site to Workers would be a different host and a different asset configuration. This stack stays on Pages and creates no Worker, route, KV, R2, D1, or Access resource. The optional remote state below is an R2 bucket created outside this configuration, not an R2 resource Terraform manages.

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

Direct Upload does not run the Pages build image. The build settings are stored on the project either way. Publishing files is a separate step below, and only for a project that was created as Direct Upload.

`lifecycle.prevent_destroy` is set on the project, the domain attachments, and the CNAMEs. Terraform only accepts a literal there, so allowing destruction takes a reviewed code change. Turning a flag off does not by itself delete the remote object: `count` going to zero plans a destroy, and `prevent_destroy` rejects that plan.

## What it will not take over

- No `cloudflare_zone`. The zone must already exist. Nameservers are not changed.
- No MX, TXT, CAA, NS, or wildcard records. The contact mailbox `design-partners@softwaredecisionfabric.tech` is untouched.
- `allow_overwrite` was removed in provider v5. If a record already exists at that hostname, create stops with a conflict. It does not replace that record. See import below. Do not import an A or AAAA into these CNAME resources.
- On Cloudflare, a proxied apex CNAME is flattened and can sit beside existing MX records. This configuration never sets `type` to `MX` or `TXT`.
- No redirect ruleset. A zone has one `http_request_dynamic_redirect` ruleset; creating `cloudflare_ruleset` would take ownership of that phase. `www` → apex is not automated. The Astro site, `public/_headers`, `public/robots.txt`, the static 404, and canonical URLs are unchanged.
- No token, account id, or zone id is committed. `terraform.tfvars.example` uses an all-zero account id as a placeholder, not as a real account.

## Ownership

Terraform owns the Pages project and, only when the flags are on, its custom domains and the CNAME records. There is no `wrangler.toml` and no `cloudflare.config.ts`. Do not add one that also sets the project name, build command, or environment. Wrangler and Terraform must not both reconcile those settings.

Uploading `dist/` is not `terraform apply`. From the repository root, `npm run deploy` lists Pages projects with `pages project list --json` and, only when `sdf-landing` is already listed, builds, checks, and runs `pages deploy` for that project. It passes the current git branch. It does not run `pages project create`. In Wrangler 4.158.0 that create command stays on Pages in a normal terminal. When Wrangler detects an agent session and the Pages project is missing, the same command can create a Worker instead. Create the project in your own terminal, or with the dashboard drag-and-drop. There is still no `wrangler.toml` or `cloudflare.config.ts`. Terraform remains the optional owner of the project settings, domains, and DNS. This upload does not reconcile those settings. A clean `main` upload is production when the Pages production branch is `main`. Any other branch is a preview. Do not point the command at a second project name. If the project was created before Terraform, import it instead of applying a second create.

## Source mode is fixed at creation

The default, `enable_git_source = false`, creates a [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) project (`source` is null). Cloudflare's Direct Upload docs say you cannot switch that project to Git later. You create a new Git-backed project instead. The [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/) docs say the opposite direction is also closed: a Git-backed project cannot be switched to Direct Upload.

Set `enable_git_source` only before the first apply, and only after the Cloudflare Workers & Pages GitHub App is installed (`https://github.com/settings/installations`, or the organization installations page). Limit the app to this repository. One GitHub account should point at one Cloudflare account. `git_owner_id` and `git_repo_id` stay null unless that installation has given you the numeric ids. Do not invent them. Terraform does not install the app.

Provider v5.28.1's `cloudflare_pages_project.source` attribute has no `RequiresReplace` plan modifier (`internal/services/pages_project/schema.go` at tag v5.28.1). A source edit plans as an in-place update. The provider does not reject that update. `prevent_destroy` rejects only a destroy.

`terraform_data.pages_source_mode` and `replace_triggered_by` narrow that gap only after both the project and the sentinel are already in state at the same mode. Terraform's `EvaluateReplaceTriggeredBy` treats Update, DeleteThenCreate, and CreateThenDelete of the referenced resource as a trigger. It does not treat Create as a trigger. The first plan that adds the sentinel therefore does not replace the project. A mode that does not match the imported project updates `source` in place, and `prevent_destroy` does not stop it.

`name` and `account_id` do have `RequiresReplace`. Renaming the project plans a destroy, which `prevent_destroy` rejects. That is a different change from `source`.

`infra/cloudflare/semantics/check.sh` applies `terraform_data` stand-ins only. It is not the Cloudflare provider. It shows three results: a matching import plans only `create` of the sentinel and `no-op` on the project; a mismatched import plans `create` of the sentinel and `update` of the project; after a matching apply, flipping the mode in either direction is rejected with `prevent_destroy`. The Pages mock still cannot apply `cloudflare_pages_project`, and no live plan was run. The script does not make the API immutable.

To use the other mode, create a new Pages project with a new name in its own state. The old name stays on the old project, and `prevent_destroy` blocks deleting or replacing it. Move the hostname only as its own reviewed change: a hostname is attached to one Pages project, and `prevent_destroy` on `cloudflare_pages_domain` blocks Terraform from detaching it until that lifecycle flag is changed on purpose. Point the CNAME at the new project's `pages_subdomain` only after the hostname is attached there. Leave MX and TXT alone.

When Git is selected at create, `production_deployments_enabled` and `deployments_enabled` are still false, `preview_deployment_setting` is `none`, and `pr_comments_enabled` is false, until `enable_automatic_deployments` is also set. Provider 5.28.1 warns that `deployments_enabled` is deprecated. It stays, set to false, because that is the schema text for disabling both production and preview builds. `terraform test` prints that warning when a Git create is planned. It is not an error. `enable_automatic_deployments` is rejected unless Git was selected. This repository does not turn that flag on, and CI does not deploy.

Preview deployments, when someone later enables them, are `*.pages.dev` URLs. Custom domains are separate `cloudflare_pages_domain` resources and are not set to a `pages.dev` name. Preview environment variables stay the public `NODE_VERSION` pin. There is no `secret_text` variable. The Astro `site` in `astro.config.mjs` stays `https://softwaredecisionfabric.tech`, so a preview document still canonicalizes to production. That is existing site behavior; this stack does not add the production hostname to a preview.

## Custom domain and DNS

`cloudflare_pages_domain` does not create DNS. The provider documents that separately (its page still says `cloudflare_record`; the v5 resource is `cloudflare_dns_record`). The dashboard flow can add a CNAME for a zone already on the account. This configuration will not, unless `manage_dns` is true.

`domain` is the hostname Pages should serve. It is usually the zone apex (`softwaredecisionfabric.tech`). It may instead be a subdomain of a zone you already have (`docs.example.com` in the zone `example.com`). `attach_www` adds `www.` in front of that hostname. Both names must sit in the zone: equal to the zone name, or a subdomain of it. A zone that is only `www.example.com` does not cover `example.com`. `pages.dev` and every hostname under it are rejected, in any case. `pages.dev.example.com` is a normal hostname and is not rejected by that rule. Labels must be lowercase punycode.

An apex custom domain has to be a zone on the same Cloudflare account as the Pages project. This stack does not create that zone or change nameservers. When `manage_dns` is true, a `data.cloudflare_zone` read checks the zone id before any record is planned. The zone's name must contain the hostnames, and `account.id` must equal `account_id`. A zone id from another zone fails that precondition during plan instead of failing when the record is created. A missing zone fails when the data source is read, which is also during plan. Tests mock that read. They do not call the zone API. A default plan does not include the data source, so it does not need Zone Read.

When `manage_dns` is true the record is:

| Name | Type | Content | Proxy | TTL |
| --- | --- | --- | --- | --- |
| `domain`, as a full hostname | `CNAME` | the project's `pages_subdomain` output | proxied | `1` (automatic) |

`www.<domain>` is added only with `attach_www`. Provider v5 compares `name` to the API's FQDN, so `@` is not used. TTL `1` is required for proxied records. The CNAME depends on the Pages domain attachment. Pages returns HTTP 522 if DNS points at `*.pages.dev` before the hostname is attached to the project. The test assertion that content equals `cloudflare_pages_project.site.subdomain` checks that wiring. The subdomain value in tests is a stub.

Certificate status moves through `initializing`, `pending`, and `active`. CAA records are not managed. If issuance stays pending, the custom-domain docs say the existing CAA set must allow `letsencrypt.org`, `pki.goog`, and `ssl.com`. Changing CAA is a separate review. Do not delete unrelated CAA, MX, or TXT records.

`www` → apex is still a product requirement in the site README and is intentionally not in this stack. Add it only after reading the current dynamic-redirect ruleset, or import that ruleset in a later change. Do not create a new ruleset over an existing one.

## Token

Create an account API token. The provider reads `CLOUDFLARE_API_TOKEN`. Do not put the token in tfvars, CLI arguments, or this repository.

Dashboard permission names are from the [permissions list](https://developers.cloudflare.com/fundamentals/api/reference/permissions/). The provider's accepted names are on each resource page.

| When | Dashboard permission | Scope | Provider name |
| --- | --- | --- | --- |
| Always | Account → Cloudflare Pages → Edit | This account only | `Pages Write` (the resource also lists `Pages Read`) |
| `manage_dns = true` only | Zone → Zone → Read | This zone only | `Zone Read` |
| `manage_dns = true` only | Zone → DNS → Read and DNS → Edit | This zone only | `DNS Read` and `DNS Write` |

`data.cloudflare_zone` in provider 5.28.1 lists many accepted permissions because the zone GET endpoint allows them. This stack asks only for Zone Read on that zone. Do not grant the rest of that list.

The direct-upload docs use the same Pages Edit permission for `wrangler pages deploy`. Do not add Zone Settings, Email Routing, Firewall, or access to every zone. Do not use the Global API Key (`CLOUDFLARE_API_KEY` / `CLOUDFLARE_EMAIL`).

## Remote state

`npm run deploy` does not read this backend, does not create a bucket, and does not need R2. Publishing stays the Wrangler command in the site README.

`versions.tf` keeps Terraform's S3 backend and points it at R2's S3 API. Bucket, object key, and the endpoint stay out of git. This configuration does not create the bucket. Create it before `terraform init`, outside this state: the backend cannot be the configuration that creates the bucket it is stored in.

Docs and the Terraform 1.17.1 client were checked on 7 November 2026. `backend/check.py` repeats the file checks and runs that same Terraform binary against a stand-in on `127.0.0.1`. A live R2 bucket was not initialized, and Terraform was not applied.

### Lock, request encryption, checksums

`use_lockfile = true` stays on. In Terraform 1.17.1 the lock object is `<key>.tflock` ([backend_state.go](https://github.com/hashicorp/terraform/blob/v1.17.1/internal/backend/remote-state/s3/backend_state.go)), and the lock `PutObject` sets `If-None-Match: *` ([client.go](https://github.com/hashicorp/terraform/blob/v1.17.1/internal/backend/remote-state/s3/client.go)). The localhost probe sent that header on the lock object, then deleted the object after the stand-in stored it. R2 documents the same header as an atomic create: one writer succeeds and the others get `412 PreconditionFailed` ([conditional PutObject](https://developers.cloudflare.com/r2/api/s3/extensions/), [consistency](https://developers.cloudflare.com/r2/reference/consistency/)). That R2 path was not executed. A second operation fails while `<key>.tflock` exists. That failure is the lock. `terraform force-unlock <lock-id>` deletes it only after the other process is gone. The id is in the error. A `-backend-config` entry or a `backend.hcl` line named `use_lockfile` overrides the committed value. `backend.hcl.example` does not contain that name. Setting it to false turns mutual exclusion off.

`encrypt = false` is set on purpose. With `encrypt = true`, the same client sets server-side encryption to `AES256`. The localhost probe then sent `x-amz-server-side-encryption: AES256` on the lock `PutObject`. R2's PutObject table marks `x-amz-server-side-encryption` unsupported ([S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/)). R2 encrypts every object at rest with AES-256-GCM. Cloudflare holds the keys. There is no bucket switch to turn that on ([data security](https://developers.cloudflare.com/r2/reference/data-security/), 21 April 2026). `PutBucketEncryption` is unimplemented on the compatibility page. `encrypt = false` leaves that at-rest encryption in place and keeps the unsupported request header off the call. It is not client-side encryption. Anyone who can read the bucket can read the state. Leave the bucket's public `r2.dev` URL and custom domains off. Do not set `sse_customer_key`, `AWS_SSE_CUSTOMER_KEY`, or `kms_key_id`. SSE-C is a different header, and losing that key makes the state unreadable.

The state `PutObject` does not send `If-None-Match`. The localhost probe showed that on an empty state pushed to the stand-in: the lock write is conditional, and the state write replaces the object. With R2 that replacement is the only copy.

`skip_s3_checksum = true` stops this client from setting `ChecksumAlgorithm` SHA256. It does not stop the AWS SDK inside Terraform 1.17.1 from adding `x-amz-checksum-crc32`. The localhost probe showed that header on the lock `PutObject` when `AWS_REQUEST_CHECKSUM_CALCULATION` was unset, and showed it absent when the variable was `when_required`. That probe used an empty `HOME`, so it did not read `~/.aws/config`. R2's checksum table lists CRC32 full-object checksums as unimplemented and composite CRC32 as implemented. The probe did not ask R2 whether it rejects the header. Export `AWS_REQUEST_CHECKSUM_CALCULATION=when_required` for this Terraform version. The variable is not a credential. `x-amz-content-sha256` is still sent. It is the SigV4 payload hash.

`region = "auto"` matches R2's S3 region. Without `skip_region_validation`, Terraform 1.17.1 rejects it at init with `Invalid AWS Region: auto` and does not open a connection. The check script covers that failure. `skip_credentials_validation`, `skip_requesting_account_id`, and `skip_metadata_api_check` skip STS, the account lookup, and IMDS. R2 does not provide those AWS endpoints. `use_path_style = true` matches Cloudflare's [remote backend example](https://developers.cloudflare.com/terraform/advanced-topics/remote-backend/) (21 April 2026). That example also writes `access_key` and `secret_key` into the file and does not set `use_lockfile`. This repository keeps the lock, leaves those keys out of every tracked file, and sets `encrypt = false`. No DynamoDB table is set, so this client does not write the MD5 digest it stores only in DynamoDB. No `acl` is set. R2 marks PutObject ACL headers unsupported.

`terraform init -backend=false` skips backend setup so `validate` and `terraform test` can run. A later `plan` or `apply` stops with `Backend initialization required` and does not write a state file. That is not a local-state apply.

### Credentials

Two credentials. They are different tokens, created on different screens. Neither is committed, and neither is passed as a command argument. Terraform stores `-backend-config` values in `.terraform` and in plan files, so the R2 keys stay in the shell.

1. R2 S3 credentials, for the backend only. In the dashboard open R2, then Manage API Tokens, then create an account API token or a user API token. Choose Object Read & Write and scope it to this bucket. The confirmation page shows the Access Key ID and the Secret Access Key once. Cloudflare's [R2 token](https://developers.cloudflare.com/r2/api/tokens/) page says this token is separate from API tokens for other services, that R2 has to be purchased before the token can be created, and that Object Read & Write is not accepted by `api.cloudflare.com`. Export `AWS_ACCESS_KEY_ID` as the access key id and `AWS_SECRET_ACCESS_KEY` as the secret. If those variables already hold AWS keys, this shell would send the AWS keys to the R2 endpoint. Set the R2 values for the Terraform commands, then unset them. Do not set `AWS_PROFILE` for this command.
2. The provider token, for Pages and optional DNS only. `CLOUDFLARE_API_TOKEN` is the account API token from the token table above. Create it on the account API token page, not the R2 token page. Do not add an R2 admin permission to it. Do not put the R2 access key in `CLOUDFLARE_API_TOKEN`.

The account id is not invented in git. Copy the S3 endpoint the dashboard shows for the bucket into `backend.hcl`. The default host is `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` ([S3 API](https://developers.cloudflare.com/r2/get-started/s3/)). A jurisdiction-specific bucket uses a different host. Use the host the dashboard shows. In Terraform 1.17.1, `endpoints.s3` in the backend config is chosen before `AWS_ENDPOINT_URL_S3`. Unset `AWS_ENDPOINT_URL_S3` and `AWS_S3_ENDPOINT` so a later command does not follow them.

R2's token screen does not take the IAM action names in the [S3 backend permission list](https://developer.hashicorp.com/terraform/language/backend/s3). The client in this version calls `ListObjectsV2` (workspace prefix `env:`), `GetObject` and `PutObject` on the state key, and `PutObject`, `GetObject`, and `DeleteObject` on `<key>.tflock`. Object Read & Write scoped to the bucket is the permission Cloudflare's remote-backend page asks for. It was not executed against a token.

### Bootstrap

Before init, outside this state:

1. Enable R2 on the account.
2. Create a private bucket. The name is lowercase letters, digits, and hyphens. Leave public access off. `GetBucketVersioning`, `PutBucketVersioning`, `GetPublicAccessBlock`, and `PutPublicAccessBlock` are unimplemented, so there is no S3 versioning switch and no S3 Block Public Access switch to turn on.
3. Create the scoped R2 token above.
4. Copy `backend.hcl.example` to `backend.hcl`. Replace `REPLACE_WITH_PRIVATE_STATE_BUCKET` and `REPLACE_WITH_CLOUDFLARE_ACCOUNT_ID`. Leave every other name out of the file. The object key in the example is the key this configuration uses.

This repository has no state file. With no local `terraform.tfstate` and no previous remote state, init creates a new backend and does not migrate:

```bash
cd infra/cloudflare
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export CLOUDFLARE_API_TOKEN="..."
terraform init -backend-config=backend.hcl -input=false
terraform plan -out=sdf.tfplan
```

Review that plan before any apply. Apply is a human step. GitHub Actions does not init this backend and does not apply. If Terraform offers to copy state and there is no state, stop. Do not add `-migrate-state`. Do not pass `-reconfigure` to skip a prompt you have not read. Use the default workspace. This configuration does not set `workspace_key_prefix`.

### Migration, only when state already exists

This change does not move state. Follow this only when a state file is already on disk or in a previous backend. Otherwise the init above is the whole setup.

1. While the current backend still reads, `terraform state pull` to a file that is not in git. Keep that file. It is the recovery copy. The next state write replaces the object, and R2 does not keep the previous one.
2. Local `terraform.tfstate` next to this configuration: `terraform init -backend-config=backend.hcl -migrate-state -input=false`, after the backup exists. `-reconfigure` skips the copy.
3. A previous S3 bucket, if one was created for the old backend: leave that bucket in place. Init with the R2 `backend.hcl`. Terraform offers to copy when it can still read the old backend. When it cannot, stop and use the pull backup. After init, a reviewed plan should show the same resources. The old object stays until that plan has been read. This repository's workflow does not delete it.
4. `terraform state push` overwrites the remote object. It is the way to restore the pull backup after review. It is not the migration command.

If the state object is wrong, restore that backup or import again from Cloudflare. Do not hand-edit the state. There is no previous object version in the bucket to restore.

## Trạng thái từ xa

`npm run deploy` không đọc backend này, không tạo bucket, và không cần R2. Đưa site lên Pages vẫn là lệnh Wrangler ở README gốc.

`versions.tf` dùng backend S3 của Terraform, trỏ vào API S3 của R2. Bucket, khóa object, và endpoint không nằm trong git. Cấu hình này không tạo bucket. Tạo bucket trước `terraform init`, ở ngoài state: Terraform không tạo cái bucket đang chứa chính state của nó.

Đã đối chiếu tài liệu và client Terraform 1.17.1 ngày 7 tháng 11 năm 2026. `backend/check.py` kiểm tra file đã commit và chạy đúng binary đó với một tiến trình giả lập trên `127.0.0.1`. Chưa khởi tạo bucket R2 thật và chưa chạy terraform apply.

`use_lockfile = true` giữ nguyên. Terraform 1.17.1 ghi object khóa `<key>.tflock` bằng `PutObject` với `If-None-Match: *`. Trên localhost, probe thấy header đó trên object khóa, rồi thấy lệnh xóa object khóa sau khi tiến trình giả lập lưu nó. Tài liệu R2 mô tả header này là tạo một lần; writer thứ hai nhận `412`. Phần đó chưa chạy trên R2. Lệnh sau thất bại khi `<key>.tflock` còn. Đó là khóa. `terraform force-unlock <lock-id>` chỉ khi tiến trình kia đã tắt. Một dòng `use_lockfile` trong `backend.hcl` hoặc `-backend-config` ghi đè giá trị đã commit. File ví dụ không có tên đó. Đặt `false` là tắt loại trừ lẫn nhau.

`encrypt = false` là cố ý. `encrypt = true` khiến client gửi `x-amz-server-side-encryption: AES256`. Probe localhost thấy header đó. Bảng PutObject của R2 đánh dấu header là không hỗ trợ. R2 vẫn mã hóa mọi object lúc lưu bằng AES-256-GCM, khóa do Cloudflare giữ, không có công tắc bucket (trang data security, 21 tháng 4 năm 2026). `encrypt = false` chỉ giữ header yêu cầu khỏi request. Nó không tắt mã hóa lúc lưu, và không phải mã hóa phía client. Ai đọc được bucket thì đọc được state. Đừng bật URL công khai `r2.dev` hoặc gắn custom domain cho bucket này. Đừng đặt `sse_customer_key`, `AWS_SSE_CUSTOMER_KEY`, hay `kms_key_id`.

`PutObject` của chính file state không gửi `If-None-Match`. Probe localhost thấy điều đó khi đẩy một state rỗng vào tiến trình giả lập: ghi khóa thì có điều kiện, ghi state thì thay thế object. Trên R2, lần ghi đó là bản duy nhất.

`skip_s3_checksum = true` chỉ bỏ `ChecksumAlgorithm` SHA256 trong client. Terraform 1.17.1 vẫn gửi `x-amz-checksum-crc32` khi thiếu biến môi trường. Probe thấy header đó lúc biến chưa đặt, và không thấy khi `AWS_REQUEST_CHECKSUM_CALCULATION=when_required`. Probe dùng `HOME` trống, nên không đọc `~/.aws/config`. Bảng checksum của R2 ghi CRC32 full-object là chưa triển khai. Probe không hỏi R2 có từ chối header hay không. Đặt biến đó trong shell. Biến này không phải mật khẩu. `x-amz-content-sha256` vẫn đi kèm chữ ký SigV4.

`region = "auto"`. Thiếu `skip_region_validation` thì Terraform 1.17.1 từ chối lúc init bằng `Invalid AWS Region: auto`, trước khi mở kết nối. `skip_credentials_validation`, `skip_requesting_account_id`, và `skip_metadata_api_check` bỏ STS, tra cứu account, và IMDS. `use_path_style = true` theo ví dụ remote backend của Cloudflare. Ví dụ đó ghi `access_key` và `secret_key` trong file và không bật `use_lockfile`. Repo này giữ khóa, không ghi các key đó vào file được theo dõi, và đặt `encrypt = false`. Không dùng DynamoDB. Không đặt `acl`.

`terraform init -backend=false` bỏ qua backend để `validate` và `terraform test` chạy được. `plan` hoặc `apply` sau đó dừng với `Backend initialization required` và không ghi state. Đó không phải apply bằng state local.

Hai thông tin xác thực, tách nhau. Không commit, không đưa lên đối số lệnh. Terraform lưu giá trị `-backend-config` vào `.terraform` và file plan.

1. Credential S3 của R2, chỉ cho backend. Dashboard: R2 → Manage API Tokens → tạo account API token hoặc user API token. Quyền Object Read & Write, giới hạn đúng bucket này. Trang xác nhận hiện Access Key ID và Secret Access Key một lần. Trang [token R2](https://developers.cloudflare.com/r2/api/tokens/) nói token này khác token API của dịch vụ khác, phải mua R2 rồi mới tạo được, và Object Read & Write không được `api.cloudflare.com` chấp nhận. Trong shell: `AWS_ACCESS_KEY_ID` là access key id, `AWS_SECRET_ACCESS_KEY` là secret. Nếu hai biến đang giữ key AWS, shell này sẽ gửi key AWS tới endpoint R2. Đặt giá trị R2 cho lệnh Terraform, rồi xóa khỏi shell. Đừng đặt `AWS_PROFILE`.
2. Token của provider, chỉ cho Pages và DNS khi cần. `CLOUDFLARE_API_TOKEN` là token ở bảng quyền phía trên. Tạo ở trang API token của account, không phải trang token R2. Đừng thêm quyền admin R2. Đừng ghi access key R2 vào `CLOUDFLARE_API_TOKEN`.

Account id không bịa trong git. Chép endpoint S3 mà dashboard hiện cho bucket vào `backend.hcl`. Host mặc định là `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`. Bucket theo jurisdiction có host khác; dùng đúng host dashboard hiện. Trong Terraform 1.17.1, `endpoints.s3` được chọn trước `AWS_ENDPOINT_URL_S3`. Xóa `AWS_ENDPOINT_URL_S3` và `AWS_S3_ENDPOINT` khỏi shell.

Màn hình token của R2 không nhận tên quyền IAM trong tài liệu backend S3. Client bản này gọi `ListObjectsV2` (prefix workspace `env:`), `GetObject` và `PutObject` trên khóa state, và `PutObject`, `GetObject`, `DeleteObject` trên `<key>.tflock`. Object Read & Write cho đúng bucket là quyền trang remote backend của Cloudflare yêu cầu. Chưa chạy thử với token thật.

Trước init, ở ngoài state: bật R2 trên account; tạo bucket riêng tư, tên chỉ gồm chữ thường, số, và dấu gạch ngang; để public access tắt. `GetBucketVersioning` và `PutBucketVersioning` không được triển khai, nên không có phiên bản đối tượng để bật. `GetPublicAccessBlock` cũng không có. Quyền riêng tư là để truy cập công khai tắt. Bản để khôi phục là file `terraform state pull` tự lưu, không phải phiên bản object cũ. Rồi tạo token R2 ở trên, chép `backend.hcl.example` thành `backend.hcl`, thay `REPLACE_WITH_PRIVATE_STATE_BUCKET` và `REPLACE_WITH_CLOUDFLARE_ACCOUNT_ID`. Đừng thêm tên nào khác vào file.

Repo này không có file state. Không có `terraform.tfstate` local và không có state ở backend cũ thì init là backend mới, không phải migration:

```bash
cd infra/cloudflare
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export CLOUDFLARE_API_TOKEN="..."
terraform init -backend-config=backend.hcl -input=false
terraform plan -out=sdf.tfplan
```

Xem plan trước khi apply. Apply là việc của người. GitHub Actions không init backend này và không apply. Terraform hỏi copy state mà không có state thì dừng. Đừng thêm `-migrate-state`. Đừng dùng `-reconfigure` để bỏ qua câu hỏi chưa đọc. Dùng workspace mặc định.

Chỉ migrate khi state đã tồn tại. Thay đổi này không di chuyển state.

1. Khi backend hiện tại còn đọc được, `terraform state pull` ra file ngoài git. Giữ file đó. Lần ghi sau thay thế object, và R2 không giữ bản cũ.
2. Có `terraform.tfstate` cạnh cấu hình này: `terraform init -backend-config=backend.hcl -migrate-state -input=false`, sau khi đã có bản sao. `-reconfigure` bỏ qua bước chép.
3. Đã có bucket S3 của backend cũ: giữ bucket đó. Init bằng `backend.hcl` của R2. Terraform đề nghị chép khi còn đọc được backend cũ. Không đọc được thì dừng và dùng file pull. Sau init, plan đã xem phải ra cùng các resource. Object cũ ở lại đến khi plan đó được đọc. Workflow của repo không xóa nó.
4. `terraform state push` ghi đè object từ xa. Dùng nó để khôi phục file pull sau khi đã xem. Đó không phải lệnh migration.

State sai thì khôi phục bản pull, hoặc import lại từ Cloudflare. Đừng sửa state bằng tay. Bucket không có phiên bản object cũ để lấy lại.

## Plan, review, apply

```bash
cd infra/cloudflare
cp terraform.tfvars.example terraform.tfvars   # then replace account_id
# R2 S3 keys, not the provider token. Shell only. See Remote state above.
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export CLOUDFLARE_API_TOKEN="..."
terraform init -backend-config=backend.hcl -input=false
terraform plan -out=sdf.tfplan
```

Review the plan before apply:

- The only create, on a fresh account, is `cloudflare_pages_project.site`, unless you opted in.
- No zone, MX, TXT, CAA, ruleset, Worker, or secret environment variable.
- Opt-in DNS is `CNAME` only, names are the apex and optionally `www`, content ends in `.pages.dev`.
- Git `source` is absent unless this configuration was created with `enable_git_source`. After the mode sentinel is in state, a flip plans replacement and `prevent_destroy` rejects the destroy. On an import, stop if the plan updates `source`. `prevent_destroy` does not reject that update.
- If Git source is present on a create, `preview_deployment_setting` is `none` and both deployment booleans are false, unless `enable_automatic_deployments` was set before that create.
- A second plan that only rewrites `deployment_configs` fields this configuration does not set is the known provider drift (the API fills defaults). Stop. Do not apply that diff, and do not add `ignore_changes` until the Node pin is still visible in review. `ignore_changes` on the whole block would hide a real `NODE_VERSION` edit.

`terraform apply sdf.tfplan` is a human step. This repository's GitHub Actions workflow does not run it. Apply is not transactional across resources. A failure after the project is created leaves the project in state and leaves DNS as it was. Run plan again and continue. A Pages domain can stay `pending` until DNS points at it; that is not a reason to edit mail records.

DNS and certificate changes propagate on their own schedule. Previous resolver TTLs can outlive Cloudflare's automatic TTL. Treat an address-record change as a cutover. Review the live record first. Import it only when it is already the CNAME described below.

## Rollback

A bad upload is a Pages deployment rollback, not a Terraform destroy. In the project, open **Deployments**, then **All deployments**, then the action menu on a successful production deployment, then **Rollback to this deployment**. Preview deployments are not rollback targets. Rollback does not change Terraform state.

A bad infrastructure change is a reverted commit and a new plan. `prevent_destroy` blocks `terraform destroy` and blocks a `count` change that would destroy an instance. To delete a remote object on purpose: change `prevent_destroy` to `false` in a reviewed commit, plan, and only then destroy. Destroying the project deletes its deployments. Destroying a CNAME deletes that record only. Cloudflare's domain docs remove the CNAME before the custom domain attachment.

If state is wrong, restore the uncommitted `terraform state pull` backup, or import again. Do not hand-edit the state. R2 does not keep a previous object version to restore.

## Stop managing an object without deleting it

`prevent_destroy` applies only while the `resource` block is still in configuration. Setting `manage_dns` or `enable_custom_domain` to false leaves the block and sets `count` to 0. Terraform then plans to destroy `cloudflare_dns_record.apex[0]`, and `prevent_destroy` rejects that plan. The remote object stays. That is not how you forget it.

A [`removed` block](https://developer.hashicorp.com/terraform/language/block/removed) cannot name an instance. `from = cloudflare_dns_record.apex[0]` is invalid (`Resource instance keys not allowed` in `internal/addrs/parse_target.go`). `from` is the resource address, and it drops every instance of that resource. The whole `resource` block has to be deleted in the same change. `count = 0` still declares it, and Terraform reports `Removed resource still exists`.

Deleting the block and forgetting the `removed` block also deletes `prevent_destroy`. Terraform then plans a real destroy. The semantics check shows that as action `delete`.

To forget the apex CNAME without deleting it:

1. `terraform state pull` to a file that is not committed. Keep that file until the forget plan has been applied. R2 has no object version to confirm.
2. Delete the entire `resource "cloudflare_dns_record" "apex"` block. Leave `cloudflare_dns_record.www` in place if you still want Terraform to manage `www`. Add:

```hcl
removed {
  from = cloudflare_dns_record.apex

  lifecycle {
    destroy = false
  }
}
```

3. Plan. The instance action must be `forget`, not `delete`. If the plan destroys anything, stop.
4. Apply only that plan, then delete the `removed` block once the address is gone from state.

The same resource address, with no `[0]`, is how you forget `cloudflare_dns_record.www`, `cloudflare_pages_domain.apex`, `cloudflare_pages_domain.www`, or `cloudflare_pages_project.site`. Forgetting the project does not delete it and does not change its Direct Upload or Git mode. `infra/cloudflare/semantics/check.sh` checks this shape on `terraform_data.record`: indexed `from` is rejected, `count = 0` plus `removed` is rejected, a bare delete plans `delete`, and `destroy = false` plans `forget` and leaves state empty. That fixture is not Cloudflare.

## Import

Import adopts an object that already exists. A create against it conflicts; it does not adopt it. The mode sentinel does not protect this first plan. Read the live project first. Direct Upload means `enable_git_source = false`. GitHub means `true`, with that owner and repository. Do not guess, and do not flip the mode in the same change as the import.

After `terraform import`, the acceptable plan creates `terraform_data.pages_source_mode` and does not update or replace `cloudflare_pages_project.site.source`. Stop if `source` changes. That change is an in-place update: the provider does not block it, and `prevent_destroy` does not block it. Apply only the plan that adds the sentinel. Both directions are latched only after that matching baseline is in state. A later flip plans replacement, and `prevent_destroy` rejects the destroy. Cloudflare still will not switch modes. The other mode is a new project name and a reviewed domain move, not a variable edit.

```bash
terraform import cloudflare_pages_project.site '<account_id>/<project_name>'
terraform import 'cloudflare_pages_domain.apex[0]' '<account_id>/<project_name>/<domain>'
```

The provider cannot import a Pages project that still has secret environment variables. This configuration has no secrets to put back.

DNS import is narrower. Provider v5.28.1 marks `cloudflare_dns_record.type` and `zone_id` with `RequiresReplace` (`internal/services/dns_record/schema.go` at tag v5.28.1). `name` does not have that modifier.

Import only a record that is already a `CNAME` at the exact hostname this resource manages (`domain`, or `www.<domain>`), in this zone:

```bash
terraform import 'cloudflare_dns_record.apex[0]' '<zone_id>/<cname_record_id>'
```

Use the same shape for `www[0]` only when that `www` CNAME already exists. Record ids come from the DNS API or dashboard.

Do not import an apex A, AAAA, or any other type into these resources. After that import, the plan replaces the record because `type` differs. Replacement deletes the old record and creates a CNAME. `prevent_destroy` blocks the delete, so the apply cannot finish, and the A/AAAA stays. A mistaken import is undone with a state backup and `terraform state rm 'cloudflare_dns_record.apex[0]'`, which forgets the address and does not delete the remote record.

Changing an existing A or AAAA into a CNAME is a separate, manual cutover. Inventory MX, TXT, CAA, and every other record first. This configuration never includes those types, so a plan that only mentions the one CNAME is not editing them. On Cloudflare, MX can remain beside a flattened apex CNAME. Make the website address change in the dashboard, or leave `manage_dns` false. Only import after the live record is already the CNAME you intend Terraform to own.

Then plan. A content update on that CNAME, aimed at `pages_subdomain`, is an in-place change and is the cutover. A replace, a name change, or any other record in the plan means stop.

## Validate without credentials

```bash
cd infra/cloudflare
terraform fmt -check -recursive
terraform init -backend=false -input=false
terraform validate
terraform test
python3 backend/check.py
```

`terraform test` plans against a mocked provider. It does not call Cloudflare, and it does not apply this resource. `semantics/check.sh` applies only local `terraform_data` stand-ins. `.github/workflows/terraform.yml` runs both. It does not reference GitHub secrets and does not set a Cloudflare token. It does not prove a token is absent on the runner. Do not add an apply job or a `secrets` reference there.
