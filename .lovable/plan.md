<final-text>Goal: fix the external FileMaker connection for tenant `00000000-0000-0000-0000-000000000002` and make tenant selection/port handling reliable.

What I found
- The edge function is already using the correct tenant. Recent logs show:
  - `Tenant: 00000000-0000-0000-0000-000000000002`
  - `BaseURL: https://remote.jansen-keukens.be/fmi/data/vLatest/databases/CrownBasePro-Jansen`
- The saved DB config is also correct for that tenant in `external_api_configs`.
- Current code already connects to whatever port is inside `base_url`. Right now the saved URL has no explicit port, so it uses HTTPS default port `443`.
- `X-Powered-By: ARR/3.0` is not the problem.
- Sending `{}` on `POST /sessions` is valid for FileMaker Data API and matches Claris docs.
- So this is not a “wrong tenant” bug in the current edge-function call. The likely remaining issue is connection strategy: only one URL/port/path is tried, and the timeout handling is too limited to diagnose or recover.

Plan
1. Harden tenant-scoped config loading in the settings UI
- Update `ExternalDatabaseSettings.tsx` so config loading reruns when `tenant?.id` becomes available.
- Keep explicit tenant filtering everywhere in the settings screen.
- Ensure saved config always carries the active tenant explicitly, not only via trigger behavior.

2. Add explicit port-aware configuration support
- Treat `base_url` as the source of truth for host + optional port.
- Normalize URLs safely in the UI and edge functions so these are supported:
  - `https://host/...` → uses 443
  - `https://host:5003/...` → uses 5003
- Show the normalized auth URL in the UI so it is obvious which tenant and port are being tested.

3. Improve `external-db-proxy` authentication flow
- Refactor auth URL construction with `URL` parsing instead of string concatenation.
- Add richer diagnostics for:
  - timeout
  - connection refused
  - TLS/handshake errors
  - non-JSON responses
- Add controlled fallback attempts for auth:
  - first: configured URL exactly as saved
  - optional fallback: same URL on `:5003` when the configured URL has no explicit port and the first attempt times out
- Return which URL/port was attempted so the UI can show the real target.

4. Bring `orders-api-proxy` to the same standard
- Apply the same tenant, timeout, port, and diagnostic logic there too.
- This avoids one tenant appearing “partly connected” because projects and orders proxies behave differently.

5. Improve the Test Connection UX
- In `ExternalDatabaseSettings.tsx`, show:
  - active tenant ID being tested
  - normalized URL being called
  - clearer error message from the edge function
  - whether fallback to port `5003` was attempted
- This will make future debugging immediate instead of “rolling until timeout”.

Technical details
- Files to update:
  - `src/components/settings/ExternalDatabaseSettings.tsx`
  - `supabase/functions/external-db-proxy/index.ts`
  - `supabase/functions/orders-api-proxy/index.ts`
- No DB schema change is required.
- Important behavior after the fix:
  - if you save `https://remote.jansen-keukens.be:5003/fmi/data/vLatest/databases/CrownBasePro-Jansen`, the proxy will use `5003`
  - if you save the current URL without a port, it will use `443`, and optionally retry `5003` on timeout
- This directly addresses your question: yes, it can be a port/path reachability issue, but the current app has no robust fallback or visibility. I’ll make that explicit and tenant-safe so the demo tenant can be tested correctly and consistently.</final-text>