# FITFORGE Nutrition Service

The Nutrition Service owns its PostgreSQL database. It supports user-owned foods and dated meal logs with nutrient snapshots. Users can request AI-generated estimates for a food, review and edit the values, and then save them. Estimates are labeled as such and are not laboratory measurements or medical advice. Meal totals are arithmetic calculations from the saved values.

## Configuration

```env
PORT=3004
DATABASE_URL=postgres://nutrition_owner:local-password@localhost:5432/fitforge_nutrition
JWT_SECRET=the-same-random-secret-used-by-auth-service
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=qwen2.5:3b
```

The JWT secret must match Auth and Gateway. Run the versioned database migration before starting the service. In the local Compose setup, a PostgreSQL bootstrap script creates a distinct nutrition database and owner role.

Food estimation and the AI Coach use the local Ollama API with the configured model (`qwen2.5:3b` by default). No paid API key is needed. The first setup downloads the model; the Compose stack stores it in a persistent volume. Without Ollama or the model available, AI requests return a clear service/model error, while manual food entry and meal logging remain available. The coach provides general fitness and healthy-habit education, does not diagnose or prescribe, and does not receive profile, nutrition, or workout data unless the user includes information in a question. Conversations stay in the browser for the current page session and are not stored by the service.

## API

All API routes require a valid Auth Service bearer access token. Each food and log query is scoped by the verified token subject.

| Method   | Path                                     | Behavior                                                      |
| -------- | ---------------------------------------- | ------------------------------------------------------------- |
| `GET`    | `/health`                                | Liveness                                                      |
| `GET`    | `/ready`                                 | PostgreSQL readiness                                          |
| `GET`    | `/api/v1/foods?search=&page=&limit=`     | List caller-owned foods                                       |
| `POST`   | `/api/v1/foods/estimate`                 | Estimate nutrients per 100 g/ml with local Ollama             |
| `POST`   | `/api/v1/coach/chat`                     | Ask the local AI coach a fitness or healthy-habit question    |
| `POST`   | `/api/v1/coach/stream`                   | Stream the coach answer as server-sent events                 |
| `POST`   | `/api/v1/foods`                          | Create a food with per-100-unit values and source attribution |
| `PATCH`  | `/api/v1/foods/:id`                      | Update a caller-owned food                                    |
| `DELETE` | `/api/v1/foods/:id`                      | Delete a caller-owned food; historical log snapshots remain   |
| `POST`   | `/api/v1/nutrition/logs`                 | Create a dated meal log from caller-owned foods               |
| `GET`    | `/api/v1/nutrition/logs?date=YYYY-MM-DD` | Read meals and daily totals                                   |
| `DELETE` | `/api/v1/nutrition/logs/:id`             | Delete a caller-owned log                                     |

Nutrition values are stored per 100 g or 100 ml and multiplied by the submitted serving amount. Calories, protein, carbohydrates, fat, fiber, sodium, calcium, iron, potassium, and magnesium are supported. Each log item snapshots the food name, source, and nutrients transactionally so later edits/deletion of a food do not rewrite history. Local model output is an estimate, may be inaccurate, and should be checked against a trusted label or source. No shared verified Indian food catalogue or substitutions are included yet.

## Run and test

```powershell
npm ci
npm run migrate
npm run build
npm test
npm start
```

The database integration test is enabled only with `NUTRITION_TEST_DATABASE_URL` pointing to an isolated database whose name includes `test`. See the root Compose setup for local database initialization.
