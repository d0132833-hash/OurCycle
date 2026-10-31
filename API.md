# REST API Documentation — Our Cycle

All application routes are served by Next.js Server Route Handlers located under `src/app/api/`. Except for authentication initialization (`/api/auth/setup` and `/api/auth/login`), all routes require a valid session cookie (`oc_session`).

---

## Authentication & Headers

| Header | Description | Required |
|---|---|---|
| `Cookie` | `oc_session=<jwt_signature>` HTTP-only cookie | Yes (protected routes) |
| `Content-Type` | `application/json` | On `POST` / `PATCH` requests |
| `Origin` | Validated for CSRF protection against `req.nextUrl.host` | On mutating requests |

---

## Endpoints

### 1. Authentication

#### `POST /api/auth/setup`
Initializes the vault with an Argon2id-hashed numerical PIN on first run.
- **Request Body**: `{ "code": "string (numerical digits only, 4–32 digits)", "setupToken": "optional string" }`
- **Response**: `{ "ok": true }` + `Set-Cookie: oc_session`
- **Errors**: `400 Bad Request`, `401 Unauthorized` (if `SETUP_TOKEN` mismatch), `409 Conflict` (if vault already created)

#### `POST /api/auth/login`
Unlocks the vault with the numerical PIN.
- **Request Body**: `{ "code": "string (numerical digits)" }`
- **Rate Limit & Lockout**: 5 failed attempts per client IP locks that IP for 10 minutes (returns `429 Too Many Requests`).
- **Response**: `{ "ok": true }` + `Set-Cookie: oc_session`
- **Errors**: `401 Unauthorized`, `403 Forbidden` (cross-site origin), `429 Too Many Requests`

#### `POST /api/auth/rotate`
Rotates the vault PIN and increments `session_epoch`. Invalidates all previously issued sessions across all devices.
- **Request Body**: `{ "current": "string", "next": "string (numerical digits only, 4–32 digits)" }`
- **Response**: `{ "ok": true }` + fresh `Set-Cookie: oc_session`
- **Errors**: `400 Bad Request`, `401 Unauthorized`, `429 Too Many Requests`

#### `POST /api/auth/logout`
Clears the session cookie.
- **Response**: `{ "ok": true }` + expired cookie

---

### 2. Period Episodes (`/api/periods`)

#### `GET /api/periods`
Returns all logged period episodes sorted ascending by `start_date`.
- **Response**: `{ "periods": PeriodEpisode[] }`

#### `POST /api/periods`
Records a new period start or completed episode. Triggers an automatic recompute of all future forecasts and prediction logs.
- When `end_date` is omitted or null, `end_date` is automatically calculated according to the configured `period_length` (`start_date + period_length - 1`), and the first date and all following days in the duration are automatically logged into `day_entries` with the episode's flow.
- Supports `upsert: true` to update existing period on that start date without 409 conflict errors.
- **Request Body**:
  ```json
  {
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD | null (optional; auto-calculated from period_length if omitted)",
    "flow": "spotting | light | medium | heavy",
    "upsert": "boolean (optional, default false)"
  }
  ```
- **Response**: `{ "period": PeriodEpisode, "prediction": Prediction }` (`201 Created` or `200 OK` on upsert)

#### `PATCH /api/periods`
Updates an existing period episode (e.g. logging period end date or amending flow). Trims and cleans up trailing auto-logged days when a period ends early.
- **Request Body**: `{ "id": "string", "end_date": "YYYY-MM-DD | null", "flow": "..." }`
- **Response**: `{ "period": PeriodEpisode, "prediction": Prediction }`

#### `DELETE /api/periods?id=<uuid>`
Removes an episode and re-evaluates forecasting baseline. Automatically cascades cleanup to remove auto-logged day flow entries.
- **Response**: `{ "ok": true, "prediction": Prediction }`

---

### 3. Daily Symptom & Lifestyle Logs (`/api/days`)

#### `GET /api/days?from=YYYY-MM-DD&to=YYYY-MM-DD`
Retrieves daily logs for the requested date window.
- **Response**: `{ "days": DayEntry[] }`

#### `POST /api/days` & `PATCH /api/days`
Upsert-merge semantics: updates only the specified fields for that calendar day without overwriting omitted metrics.
- **Automatic Period Start**: When menstrual flow (`light`, `medium`, `heavy`) is logged or `is_period_start: true`, the API automatically ensures a period episode in `period_logs` is created/updated from `date` to `date + period_length - 1` and auto-upserts `day_entries` for all following days across the period duration with that flow.
- **Request Body**:
  ```json
  {
    "date": "YYYY-MM-DD",
    "flow": "none | spotting | light | medium | heavy",
    "is_period_start": "boolean (optional; defaults to true when menstrual flow logged on a new date)",
    "period_length": "1-14 (optional; defaults to configured settings.period_length)",
    "mood": 1-5,
    "energy": 1-5,
    "libido": 1-5,
    "cramps": 0-3,
    "headache": 0-3,
    "back_pain": 0-3,
    "breast_tenderness": 0-3,
    "acne": 0-3,
    "bloating": 0-3,
    "fatigue": 0-3,
    "bbt": 36.45,
    "weight": 62.5,
    "sleep_hours": 7.5,
    "water_glasses": 8,
    "note": "Optional journal note #heatingpad"
  }
  ```
- **Response**: `{ "entry": DayEntry }`

#### `DELETE /api/days?date=YYYY-MM-DD`
Deletes the day entry for the specified date.

---

### 4. Forecasting & Health Analytics

#### `GET /api/predictions`
Returns the freshly calculated cycle forecast and model accuracy metrics.
- **Response**:
  ```json
  {
    "prediction": {
      "today": "YYYY-MM-DD",
      "cycleLength": 28,
      "nextPeriodStart": "YYYY-MM-DD",
      "range": ["YYYY-MM-DD", "YYYY-MM-DD"],
      "confidence": "high | medium | low",
      "todayPhase": "menstrual | follicular | ovulation | luteal",
      "regularity": { "label": "Regular", "sigma": 1.2 }
    },
    "accuracy": {
      "evaluated": 6,
      "hits": 5,
      "window": 1
    }
  }
  ```

---

### 5. Calendar Integration & Export

#### `GET /api/calendar/ics`
Generates and downloads a standard RFC 5545 iCalendar (`.ics`) file.
- **Content-Type**: `text/calendar; charset=utf-8`
- **Content-Disposition**: `attachment; filename="our-cycle.ics"`
- **Events included**: Past periods, predicted upcoming periods with alarms, fertile windows, and PMS heads-up alerts.

#### `GET /api/partner/calendar`
Generates and downloads a discreet partner-care companion RFC 5545 iCalendar (`.ics`) file.
- **Content-Type**: `text/calendar; charset=utf-8`
- **Content-Disposition**: `attachment; filename="ourcycle-partner-companion.ics"`
- **Events included**: Privacy-first phase reminders ("Cycle: Rest & Comfort Window", "Cycle: High Energy & Ideas", "Cycle: Peak Vitality & Romance", "Cycle: Gentle Care & Support").

#### `GET /api/export?format=json|csv`
Exports the complete historical database archive as a structured download.
- **Headers**: `Cache-Control: no-store, no-cache, must-revalidate, private` (never cached by intermediary proxies or browsers).
- **Security**: In CSV mode, cells starting with formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) are automatically escaped with a leading single quote (`'`) to neutralize CSV Formula Injection (CWE-1236).

---

### 6. Settings & Administration

#### `GET /api/settings`
Returns application settings (timezone, cycle override, period length).

#### `PATCH /api/settings`
Updates settings:
- `period_length`: number between 1 and 14 (default 5; controls how many days are automatically logged on period start).
- `cycle_length_override`: number between 21 and 45 or null (fixed cycle duration).
- `bootstrap_cycle_length`: number between 21 and 45 (cold-start prior).
- `timezone`: valid IANA timezone string.

#### `POST /api/reset`
Wipes all period, day, and prediction data while preserving the vault password hash.
- **Security (Sudo Mode)**: Requires re-authenticating with the current vault PIN in the request body: `{ "code": "string" }`.
- **Rate Limit**: 5 attempts per 5 minutes per IP.
- **Errors**: `400 Bad Request`, `401 Unauthorized` (incorrect PIN).

