# Vision API Auth Diagnostic — Google Vision for MRZ OCR

**Date**: 2026-06-03  
**Status**: MRZ_BLOCKED_BY_GOOGLE_VISION_AUTH  
**Action required from owner**: Add credentials to Vercel → redeploy → verify

---

## Root Cause

Google Vision API returned HTTP 403 in Vercel Production because credentials were not configured in the Vercel environment. The provider returned an empty OCR result → MRZ parser received empty text → `_mrz_source=NOT_PRESENT`.

Local `.env.local` has `GOOGLE_CLOUD_VISION_API_KEY` set — this is why it works locally but not in production.

---

## What Was Fixed (code side)

### 1. `loadVisionCredentials()` — robust credentials loader

File: `apps/web/src/lib/canonical/vision/visionCredentials.ts`

Supports two auth methods in priority order:

**Priority 1: Service account JSON** (recommended for Vercel)

Checks these env var names in order:
1. `GOOGLE_VISION_SERVICE_ACCOUNT_JSON`
2. `GOOGLE_CLOUD_CREDENTIALS`
3. `GOOGLE_APPLICATION_CREDENTIALS_JSON`

Features:
- Validates required fields: `type`, `project_id`, `client_email`, `private_key`
- Normalizes `private_key` `\\n` → real newlines (Vercel stores env vars with escaped newlines)
- Masks `client_email` in diagnostics (`sa-name@***.iam.gserviceaccount.com`)
- Never logs or returns `private_key`
- Error codes: `VISION_CREDENTIALS_MISSING`, `VISION_CREDENTIALS_INVALID_JSON`, `VISION_CREDENTIALS_MISSING_FIELDS:...`

**Priority 2: API key** (legacy, simpler)
- `GOOGLE_CLOUD_VISION_API_KEY`
- `GOOGLE_VISION_API_KEY`

### 2. Vision provider updated

File: `apps/web/src/lib/ocr/providers/google-vision.ts`

Now calls `loadVisionCredentials()`. When service account JSON is found, uses `google-auth-library` to obtain a Bearer token and calls Vision API with `Authorization: Bearer <token>`. API key path unchanged.

### 3. Diagnostic endpoint added

URL: `GET /api/_diag/vision`  
Header required: `X-Internal-Diag-Token: <value of INTERNAL_DIAG_TOKEN env var>`

Returns sanitized JSON — no PII, no private_key:
```json
{
  "vision_ok": true,
  "credentials_present": true,
  "project_id_detected": "your-project-id",
  "service_account_detected_masked": "vision-sa@***.iam.gserviceaccount.com",
  "auth_method": "service_account_json",
  "text_detected_length": 0,
  "provider": "google_vision",
  "timestamp": "2026-06-03T..."
}
```

---

## Owner Action Required

### Option A: Service Account JSON (recommended for Vercel)

#### Step 1: Create service account in Google Cloud Console

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Select project where Vision API is enabled (check project with `project_id: 537268475735` or whichever is active)
3. Click **Create Service Account**
4. Name: `vision-mrz-ocr` (or similar)
5. Description: `Google Vision API OCR for MRZ passport reading`
6. Click **Create and Continue**
7. Grant role: **Cloud Vision API User** (or `roles/visionai.user`)
   - If not available: use **Basic → Viewer** + enable Vision API separately
8. Click **Done**

#### Step 2: Create and download JSON key

1. Click on the new service account
2. Go to **Keys** tab
3. Click **Add Key → Create new key → JSON**
4. Download the JSON file (contains `private_key`, `client_email`, etc.)
5. Keep this file SECURE — do not commit to git

#### Step 3: Enable Cloud Vision API

1. Go to: https://console.cloud.google.com/apis/library/vision.googleapis.com
2. Select the correct project
3. Click **Enable** (if not already enabled)
4. Ensure billing is active for the project

#### Step 4: Add credentials to Vercel

1. Go to: https://vercel.com/dashboard → your project → Settings → Environment Variables
2. Add new variable:
   - **Name**: `GOOGLE_VISION_SERVICE_ACCOUNT_JSON`
   - **Environment**: Production (and Preview if needed)
   - **Value**: paste the entire content of the downloaded JSON file (the whole JSON object as-is)
3. Click **Save**

> **Important**: Vercel stores the JSON string with `\\n` in `private_key`. The `loadVisionCredentials()` function normalizes this automatically.

#### Step 5: Add diagnostic token (optional but recommended)

1. Add another env var:
   - **Name**: `INTERNAL_DIAG_TOKEN`
   - **Value**: generate a random string, e.g. `openssl rand -hex 32`
   - **Environment**: Production

#### Step 6: Redeploy

1. Go to Vercel dashboard → Deployments
2. Click **Redeploy** on the latest deployment (or push any commit to trigger auto-deploy)

#### Step 7: Verify

```bash
curl -s -H "X-Internal-Diag-Token: <your_token>" \
  https://messenginfo.com/api/_diag/vision | jq .
```

Expected success response:
```json
{
  "vision_ok": true,
  "credentials_present": true,
  "auth_method": "service_account_json",
  "project_id_detected": "your-project-id",
  "service_account_detected_masked": "vision-mrz-ocr@***.iam.gserviceaccount.com"
}
```

---

### Option B: API Key (simpler, already partially working locally)

If the existing API key (`REDACTED_GOOGLE_API_KEY_DO_NOT_USE`) is still valid and the Vision API is enabled:

1. Go to Vercel → Settings → Environment Variables
2. Add: `GOOGLE_CLOUD_VISION_API_KEY` = `<api key value>`
3. Redeploy
4. Verify: same diagnostic endpoint call above; `auth_method` will be `api_key`

> **Note**: API keys have no project-level IAM; ensure the key has Cloud Vision API access enabled in Google Cloud Console → APIs → Credentials.

---

## Error Code Reference

| Error code | Meaning | Fix |
|---|---|---|
| `VISION_CREDENTIALS_MISSING` | No env var set | Add env var to Vercel |
| `VISION_CREDENTIALS_INVALID_JSON` | Env var is not valid JSON | Fix the JSON value in Vercel |
| `VISION_CREDENTIALS_MISSING_FIELDS:...` | JSON missing required field | Ensure full service account JSON |
| `VISION_AUTH_403` | Key/SA has no access | Enable Vision API or fix IAM |
| `VISION_API_DISABLED_OR_PERMISSION_DENIED` | API not enabled | Enable Vision API in GCloud Console |
| `VISION_BILLING_OR_QUOTA` | Billing inactive or quota exceeded | Activate billing |
| `VISION_SA_TOKEN_EMPTY` | SA token obtained but empty | Retry; check SA permissions |
| `VISION_SA_TOKEN_ERROR` | Failed to get SA token | Check private_key format, project |

---

## After Vision Confirmed

Once `/api/_diag/vision` returns `vision_ok: true`:

1. Upload real Ukrainian international passport via TPS wizard
2. Verify response contains `_mrz_source: "ocr_mrz"` (not `NOT_PRESENT`)
3. Verify `passport_number`, `family_name`, `given_name`, `date_of_birth` populated from MRZ
4. Verify `i94`, `a_number`, `ead_category`, `us_address` are NOT invented (should be null/absent)

Status will then be: `MRZ_AUTHORITY_LIVE_CONFIRMED`
