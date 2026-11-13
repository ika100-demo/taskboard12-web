---
spec_id: 001-task-list-and-create-form-on-the-start
shape: web-nextjs
spec_hash: d65c137b5358
summary: Start page lists tasks from the Task API and creates them through a Server Action
tasks:
- id: t2
  title: Task list and create form on the start page
  files: [app/_actions/tasks.ts, app/_components/task-board.tsx, app/page.tsx, app/globals.css, app/_components/feature-card.tsx,
    app/_components/icons.tsx, tests/page.test.tsx, e2e/smoke.spec.ts, lib/tasks/types.ts, lib/tasks/validate.ts, lib/tasks/client.ts,
    tests/tasks-client.test.ts, tests/tasks-validate.test.ts, docs/env-vars.md]
  covers: [AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.7]
  parallel_safe: false
  depends_on: []
  done: true
---

# Plan — 001 Task list and create form on the start page

Contract, module interfaces and the rendered markup are in [design.md](design.md); follow them exactly, the acceptance tests are written against them.

## t2 — Task list and create form on the start page

**Files:** app/_actions/tasks.ts, app/_components/task-board.tsx, app/page.tsx, app/globals.css, app/_components/feature-card.tsx, app/_components/icons.tsx, tests/page.test.tsx, e2e/smoke.spec.ts, lib/tasks/types.ts, lib/tasks/validate.ts, lib/tasks/client.ts, tests/tasks-client.test.ts, tests/tasks-validate.test.ts, docs/env-vars.md
**Covers:** AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.7
**Goal:** the start page shows the task list (or `No tasks yet`, or the load-failure message) and a create form whose result is appended without leaving the page.

**Implementation notes:**
- `app/_actions/tasks.ts` (`"use server"`): `createTaskAction` per the design pseudocode; validation before any API call; `SAVE_FAILED` constant.
- `app/_components/task-board.tsx` (`"use client"`): `TaskBoard({ initial })`, list state seeded from `initial`, controlled `title` / `due_date` inputs, `onSubmit` with `preventDefault` + `startTransition(async () => ...)` calling `createTaskAction`; never `<form action>`. Markup, labels, roles and messages exactly as design.md "Rendered page"; `noValidate`, no `required` / `maxLength`.
- On `created`: append, clear both inputs; on `invalid` / `failed`: keep inputs, list unchanged, show the one message; clear the previous message on each submit; disable the button while pending.
- `app/page.tsx`: async Server Component, `export const dynamic = "force-dynamic"`; keep the hero `h1` `taskboard12-web`, the lead and the `Check health` link, drop the `Get started` link and the two starter sections; render the Tasks section with `<TaskBoard initial={await listTasks()} />`.
- Delete `app/_components/feature-card.tsx` and `app/_components/icons.tsx` (only the old page used them).
- `app/globals.css`: list and form styles from the existing tokens; no horizontal scroll at 375 px (`e2e/home.spec.ts`).
- `tests/page.test.tsx`: rewrite for the new page (`render(await HomePage())` with `fetch` stubbed): heading, `Check health` link, single `h1`, Tasks region; keep coverage of `app/**` at 80 %.
- `e2e/smoke.spec.ts`: add `the task list loads @smoke` (read-only: Tasks region visible, load-failure text absent) and `a task can be created @smoke @writes` (title `smoke-<uuid>`, submit, the entry appears); keep the existing check.

**Done when:** all acceptance tests for AC-001.1 to AC-001.7 pass, `tests/page.test.tsx` and `e2e/home.spec.ts` pass, and `devbox run ci` is green.

**Merged from t1 — Add the server-side Task API client and title validation** (t1 cannot pass typecheck: the acceptance test tests/tasks.test.tsx imports app/ modules that only t2 creates, so the split leaves quality red between the tasks):

**Files:** lib/tasks/types.ts, lib/tasks/validate.ts, lib/tasks/client.ts, tests/tasks-client.test.ts, tests/tasks-validate.test.ts, docs/env-vars.md
**Covers:** AC-001.1, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.7
**Goal:** one module that is the only caller of the Task API (`GET /tasks`, `POST /tasks`) and returns a never-throwing result, plus the pure title/due-date checks with the spec's exact messages.

**Implementation notes:**
- `types.ts`, `validate.ts`, `client.ts` with exactly the signatures and constants of design.md "Module interfaces".
- `checkTitle`: `trim()`, empty → `TITLE_REQUIRED`, `[...trimmed].length > 200` → `TITLE_TOO_LONG`, else `{ ok: true, title: trimmed }` (exactly 200 is valid).
- `client.ts`: read `process.env.TASKBOARD12_API_URL` per call, strip trailing `/`; unset → `{ ok: false }` with `reason: "config"`.
- Every `fetch`: `cache: "no-store"`, `signal: AbortSignal.timeout(5000)`, `accept: application/json`; `POST` sends `content-type: application/json` and body `{"title", "due_date"}` (both keys always).
- Success only on `200` + array of valid task objects (list) / `201` + valid task object (create); validate the shape with a type guard (design.md "Upstream"); everything else, including thrown errors and `TimeoutError`, → `{ ok: false }`. Never parse an error body, never retry.
- Log each failure once via `@/lib/logger` `warn` with `op`, `status` (when there is one) and `reason`; never the title.
- Unit tests stub `fetch` with `vi.stubGlobal` and cover: success paths, non-200/201 statuses (422, 500, 503), non-JSON body, wrong shape, network error, timeout, unset URL, trailing slash.
- `docs/env-vars.md`: new "Task API" section: `TASKBOARD12_API_URL`, default unset (list and create then fail gracefully), server-side only, set by the gitops entry to `http://taskboard12-api`.

**Done when:** the t1 unit tests pass and `devbox run quality` is clean; the acceptance tests pass only after t2.

