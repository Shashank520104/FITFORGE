# FITFORGE Personalization Service

This separately deployed service stores wellness preferences, encrypts uploaded health reports, and uses the local Ollama model for general seven-day meal and workout ideas. It does not diagnose, assess medical risk, prescribe recovery plans, or use reports to decide exercise clearance.

## Sensitive report handling

- Reports are private and scoped to the signed-in account. Supported uploads are PDF, JPEG, and PNG, up to 8 MB.
- File bytes are encrypted with AES-256-GCM before being stored in PostgreSQL. `REPORT_ENCRYPTION_KEY` must be a base64url-encoded random 32-byte key. Keep it separate from the database, back it up securely, and never commit or log it; losing it makes stored reports unreadable.
- Files remain until the user deletes them. Extracted report text and AI summaries are not persisted.
- PDF text extraction and image OCR run locally. Report text is sent to the configured local Ollama model only when the user explicitly requests a summary. The model is instructed to restate visible information, not interpret results or recommend treatment. Summaries can still be wrong and must be checked against the original with a clinician.
- Uploading a report automatically revokes workout confirmation and removes workout details from the saved plan. A user must explicitly confirm that a qualified clinician has cleared exercise before general workout ideas are generated again. Removing a report does not restore that confirmation.
- Meal suggestions are general food ideas, not a medical or therapeutic diet. The model receives height, weight, diet preference, and experience, but is instructed not to calculate calorie or weight-loss targets. Report contents are never sent to plan generation.

## Configuration

```env
PORT=3007
DATABASE_URL=postgres://personalization_owner:...@postgres:5432/fitforge_personalization
JWT_SECRET=the-same-secret-used-by-Auth-and-Gateway
REPORT_ENCRYPTION_KEY=<base64url-encoded-random-32-byte-key>
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=qwen2.5:3b
```

The database migration creates preferences, report, and current-plan tables. The runtime image installs Poppler and Tesseract for local PDF extraction and OCR.

## API

Protected routes require an Auth Service bearer access token. See [`openapi.yaml`](./openapi.yaml).

| Method        | Path                                         | Purpose                                                                 |
| ------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| `GET`, `PUT`  | `/api/v1/wellness/profile`                   | Read or save size, diet, experience, and explicit exercise confirmation |
| `GET`, `POST` | `/api/v1/wellness/reports`                   | List report metadata or upload an encrypted report                      |
| `POST`        | `/api/v1/wellness/reports/:reportId/summary` | Create an ephemeral, non-diagnostic report summary                      |
| `DELETE`      | `/api/v1/wellness/reports/:reportId`         | Delete an owned report                                                  |
| `GET`         | `/api/v1/wellness/plan`                      | Read the saved plan, hiding workouts unless currently cleared           |
| `POST`        | `/api/v1/wellness/plan/generate`             | Generate general seven-day meal ideas and, if cleared, workout ideas    |

This local setup is not a clinical product or a production medical-record system. Before public launch, add a formal privacy/legal review, secure key management, backup/retention policy, malware scanning, and appropriate compliance controls.
