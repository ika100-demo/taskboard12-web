---
spec_id: 001-task-list-and-create-form-on-the-start
title: Task list and create form on the start page, backed by the Task API
status: approved
priority: P1
shape: web-nextjs
parent: ika100-demo/taskboard12-gitops:001-persist-tasks-in-postgres-and-manage
---

# 001 — Task list and create form on the start page, backed by the Task API

## Problem

The taskboard12 Task API can create and list tasks (`POST /tasks`, `GET /tasks`), but keeps them in its memory only: every restart or new deployment of the API loses every task, so nobody can rely on the board. And the only way to use it is to call the API directly; the taskboard12 web UI shows nothing about tasks yet. This feature keeps tasks in a Postgres database, so that they survive restarts and deployments, and gives people a page in the web UI to see their tasks and create new ones.

## System context

Slice of the system plan `001-persist-tasks-in-postgres-and-manage` in `ika100-demo/taskboard12-gitops` for `taskboard12-web` (web-nextjs). The system criteria and the contract below are binding: every criterion of this spec implements one of them and names it: `(system AC-<NNN>.<n>)`.

### System criteria

- **AC-001.3** Given tasks exist (created through the web UI or the API), when a user opens the web UI's start page, then it shows one entry per task with its title and its due date as `YYYY-MM-DD` (or `No due date` when it has none), oldest first; with no tasks it shows `No tasks yet`.
- **AC-001.4** Given a user is on the web UI's start page, when they enter a title (and optionally pick a due date) and submit the form, then the new task appears at the end of the list without leaving the page, the form is cleared, and `GET /tasks` on the API returns it with the same title and due date.
- **AC-001.5** Given a user is on the web UI's start page, when they submit the form with a title that is empty or whitespace only, or longer than 200 characters after trimming, then no task is created, the form keeps their input and shows `Title is required` or `Title must be at most 200 characters` respectively.
- **AC-001.6** Given the API is unreachable or answers with an error status, when a user opens the start page, then the page still loads and shows `Tasks could not be loaded. Please try again later.` in place of the list.
- **AC-001.7** Given the API is unreachable or answers with an error status, when a user submits the create form, then the form keeps their input, shows `The task could not be saved. Please try again.`, and the list is unchanged.

### Contract

Caller: the taskboard12-web server (never the browser). Base URL: env `TASKBOARD12_API_URL` (dev: `http://taskboard12-api`). JSON, UTF-8, no authentication.

**Task object** (unchanged):

| Field | Type | Notes |
|---|---|---|
| `id` | string | opaque, server-generated, non-empty |
| `title` | string | trimmed, 1 to 200 characters |
| `due_date` | string `YYYY-MM-DD` or `null` | calendar date, past dates allowed |
| `created_at` | string | ISO 8601 UTC timestamp |

**`GET /tasks`**
- `200`: JSON array of all task objects, creation order (oldest first), no limit, no pagination; `[]` when none.
- `503`: `{"detail": "Task storage is unavailable"}` when the database cannot be reached.

**`POST /tasks`**
- Request: `{"title": string, "due_date": "YYYY-MM-DD" | null}`; `due_date` may be omitted; unknown fields are ignored.
- `201`: the created task object.
- `422`: FastAPI validation error (`{"detail": [{"loc": ["body", "title"|"due_date"], "msg": ..., "type": ...}]}`) for a title missing, null, empty or whitespace only, longer than 200 characters after trimming, or an invalid `due_date`. Validation happens before storage: an invalid body answers `422` even while the database is down.
- `503`: `{"detail": "Task storage is unavailable"}`; no task is created.

**`GET /ready`** (Kubernetes readiness probe): `200` `{"status": "ready"}` when the database answers, else `503`. `GET /health` stays `200` regardless of the database.

No events.

### Errors

- Error format: FastAPI's `{"detail": ...}`; `detail` is a string for `503` (exactly `Task storage is unavailable`) and a list of validation entries for `422`.
- The API answers `503` for every storage failure (connection refused, timeout, lost connection) and never `500` for one; an unexpected exception elsewhere is `500` with FastAPI's default body.
- The web treats any response it does not expect as a failure, without parsing the body: on `GET /tasks` anything but `200` with a JSON array (including `422`, `500`, `503`, a non-JSON body, a connection error) shows `Tasks could not be loaded. Please try again later.`; on `POST /tasks` anything but `201` with a task object shows `The task could not be saved. Please try again.` and keeps the input. A `422` should not occur because the web checks the same limits first; if it does, it is the same save failure. The web does not retry.

### Timeouts

- Web to API, each call (`GET /tasks`, `POST /tasks`): 5 seconds total (`AbortSignal.timeout(5000)`); on timeout or unreachable API, the failure behaviour of `### Errors` (page still loads, form keeps input). A `POST` that timed out may still have created the task; it then appears on the next page load (no live updates, per non-goals).
- API to Postgres: connect timeout 3 seconds, statement timeout 2 seconds, so a `GET`/`POST /tasks` with the database down answers `503` within 5 seconds, inside the web's budget. The connection is re-established on the next request after an outage, without a restart.
- `/ready`'s database check: at most 800 ms (the probe's own timeout is Kubernetes' default 1 second); no answer in time counts as unreachable (`503`).

### Provided by the system

The gitops part of this plan wires these for this repo; rely on them, do not ask for them again:

- env `TASKBOARD12_API_URL=http://taskboard12-api`

### Notes for this repo

The API base URL comes from the server-side env var TASKBOARD12_API_URL (set by the gitops entry to
http://taskboard12-api; document it in docs/env-vars.md). Only the Next.js server calls the API (Server
Component for the list, Server Action or route handler for the create); the browser never calls the API
directly, so no CORS and no NEXT_PUBLIC_ variable. /api/ready stays independent of the API.
Tests mock the Task API per the plan's Contract.

## Stories

<!-- As a <persona>, I want <goal>, so that <benefit>. -->

## Acceptance criteria

- **AC-001.1** Given the Task API's `GET /tasks` returns tasks, when a user opens `/`, then the page shows one entry per task in the order the API returns them (oldest first), each with its `title` and its `due_date` as `YYYY-MM-DD`, or `No due date` when `due_date` is `null` (system AC-001.3)
- **AC-001.2** Given the Task API's `GET /tasks` returns `[]`, when a user opens `/`, then the page shows `No tasks yet` (system AC-001.3)
- **AC-001.3** Given a user is on `/`, when they enter a title, optionally pick a due date and submit the form, then the web sends `POST /tasks` with `{"title": <trimmed title>, "due_date": <YYYY-MM-DD or null>}` to the Task API, the returned task appears at the end of the list without leaving the page, and the form is cleared (system AC-001.4)
- **AC-001.4** Given a user is on `/`, when they submit the form with an empty or whitespace-only title, then no request is sent to the Task API, the form keeps their input and shows `Title is required` (system AC-001.5)
- **AC-001.5** Given a user is on `/`, when they submit a title longer than 200 characters after trimming, then no request is sent to the Task API, the form keeps their input and shows `Title must be at most 200 characters`; a title of exactly 200 characters after trimming is sent; a past due date is sent as well (system AC-001.5)
- **AC-001.6** Given the Task API is unreachable, slower than 5 seconds, or answers `GET /tasks` with any status other than `200` (including `503`), when a user opens `/`, then the page loads with status `200` and shows `Tasks could not be loaded. Please try again later.` in place of the list (system AC-001.6)
- **AC-001.7** Given the Task API is unreachable, slower than 5 seconds, or answers `POST /tasks` with any status other than `201` (including `422` and `503`), when a user submits the form, then the form keeps their input, shows `The task could not be saved. Please try again.`, and the list is unchanged (system AC-001.7)

## Non-goals

## Assumptions

<!-- Spec 149: decisions taken by default, approved with the spec. One bullet each: - **A1** <the decision> (other option: <…>; affects AC-…). A revised one is struck through (~~…~~), never deleted. -->

## Open questions

<!-- Only what may not be decided by default (spec 149): security or access, money, destroying or migrating data, or a request too ambiguous to build. Approval is refused while any is open. Strike answered ones (~~…~~) and fold the answer into the criteria. -->

## Changelog

- 2026-11-13 created from the system plan, with its criteria (spec 147)
- 2026-11-13 approved
