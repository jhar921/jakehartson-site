# Hosting

Canonical host: **https://lifts.jakehartson.com/** (subdomain root), Worker `lifts`,
behind Cloudflare Access. Not `jakehartson.com/lifts/`; the earlier Astro route was removed.
Keep `workers_dev = false` and `preview_urls = false`.

## Deploy-time steps (wait for Jake's go)

1. `npx wrangler d1 create lifts` and paste the real `database_id` into `wrangler.toml` in place of the placeholder `00000000-0000-0000-0000-000000000000`.
2. `npx wrangler d1 migrations apply lifts --remote`.
3. Set Worker env vars (dashboard or wrangler), not in the repo:
   - `ACCESS_TEAM_DOMAIN`
   - `ACCESS_AUD`
   - `ACCESS_SERVICE_AUD` if the vault path uses a second Access app
   - Do not set `LIFTS_DEV_BYPASS_ACCESS`.
4. Add the Access service-token policy for `/api/vault/*` described in the phase 1 `ENDPOINTS.md`. Leave the human Access policy in place for everything else.
5. `npx wrangler deploy` from this directory.
6. Confirm `/health` still 302s to Access when logged out, and that a signed-in visit loads Today.
7. Rollback if needed: promote the currently live Worker version `042a9133` (rollback id `8f336115`) back to 100%.
