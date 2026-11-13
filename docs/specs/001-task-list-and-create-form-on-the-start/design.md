# Design — 001 Task list and create form on the start page

## Decisions

- **Only the Next.js server talks to the Task API.** The list is fetched in the `/` Server Component; the create goes through a Server Action. The browser never calls the API, so there is no CORS and no `NEXT_PUBLIC_` variable (system contract, spec "Notes for this repo").
- **One server-side client module, `lib/tasks/client.ts`, owns every API call.** It reads `TASKBOARD12_API_URL` at call time, applies the 5 s timeout (`AbortSignal.timeout(5000)`), checks the response shape, and **never throws**: it returns a discriminated result. Page and action contain no `fetch` and no error parsing (AC-001.6, AC-001.7).
- **`/` is rendered per request** (`export const dynamic = "force-dynamic"`, `fetch(..., { cache: "no-store" })`), so the list is never prerendered at build time, when no API is reachable.
- **The created task is appended on the client from the action's result**, not by `revalidatePath`: AC-001.3 requires the *returned* task to appear at the end, and AC-001.7 requires the list to be unchanged on failure. The list state lives in one client component, `TaskBoard`, seeded with the server-fetched list.
- **The form is submitted through `onSubmit` + `startTransition(() => createTaskAction(...))`, with controlled inputs**, not `<form action>`: React 19 resets the fields of a `<form action>` after every submission, which would break "the form keeps their input" (AC-001.4, AC-001.5, AC-001.7). Fields are cleared only on success.
- **Validation runs in the Server Action, before any API call** (authoritative, so "no request is sent" holds whatever the browser does), using the pure `checkTitle` from `lib/tasks/validate.ts`. The form sets `noValidate` and the inputs carry no `required` / `maxLength`, so the browser never shows its own messages instead of the spec's (AC-001.4, AC-001.5).
- **Title length counts Unicode code points** (`[...trimmed].length`), matching the Python API's `len()`; trimming uses `String.prototype.trim()`.
- **The start page keeps its `h1` `taskboard12-web`, the lead and the `Check health` link** (the smoke test and `e2e/home.spec.ts` rely on them); the starter's "What's included" and "Get started" sections are replaced by the Tasks section, and the now-unused `feature-card.tsx` and `icons.tsx` are deleted (they would otherwise count as uncovered code under `app/`).
- No ADR: the decisions are local to this feature, and the server-only API access is already fixed by the system contract.

## Modules

| Module | Responsibility | New / changed |
|---|---|---|
| `lib/tasks/types.ts` | `Task`, `NewTask` types (system contract's task object) | new |
| `lib/tasks/validate.ts` | `checkTitle`, `isDueDate`, the exact message strings | new |
| `lib/tasks/client.ts` | `listTasks()`, `createTask()`: the only Task API caller; timeout, shape check, logging | new |
| `app/_actions/tasks.ts` | `"use server"` `createTaskAction`: validate, call `createTask`, map to UI state | new |
| `app/_components/task-board.tsx` | `"use client"` list + form, list state, messages | new |
| `app/page.tsx` | async Server Component: `listTasks()` → `<TaskBoard initial=… />` | changed |
| `app/globals.css` | styles for the list and form, reusing the existing tokens | changed |
| `app/_components/feature-card.tsx`, `app/_components/icons.tsx` | starter-only | deleted |
| `docs/env-vars.md` | documents `TASKBOARD12_API_URL` | changed |

## Contract

### Upstream (Task API, from the system spec; binding, not repeated in full)

`GET {TASKBOARD12_API_URL}/tasks` → success only on `200` with a JSON array whose every element is a task object. `POST {TASKBOARD12_API_URL}/tasks` with body `{"title": <trimmed>, "due_date": "YYYY-MM-DD" | null}` (always both keys, `Content-Type: application/json`) → success only on `201` with a task object. Everything else (any other status, non-JSON body, wrong shape, network error, timeout after 5000 ms, `TASKBOARD12_API_URL` unset) is a failure; the body of a failure is never parsed; no retry.

A **task object** is valid when `id` is a non-empty string, `title` a string, `due_date` a string matching `^\d{4}-\d{2}-\d{2}$` or `null`, `created_at` a string.

### Module interfaces

```ts
// lib/tasks/types.ts
export type Task = { id: string; title: string; due_date: string | null; created_at: string };
export type NewTask = { title: string; due_date: string | null };

// lib/tasks/validate.ts
export const TITLE_MAX = 200;
export const TITLE_REQUIRED = "Title is required";
export const TITLE_TOO_LONG = "Title must be at most 200 characters";
export type TitleCheck =
  | { ok: true; title: string }                                   // trimmed
  | { ok: false; error: typeof TITLE_REQUIRED | typeof TITLE_TOO_LONG };
export function checkTitle(raw: string): TitleCheck;              // trim; empty → REQUIRED; > 200 code points → TOO_LONG
export function isDueDate(value: string): boolean;                // /^\d{4}-\d{2}-\d{2}$/

// lib/tasks/client.ts  (server only; never throws)
export type ListResult = { ok: true; tasks: Task[] } | { ok: false };
export type CreateResult = { ok: true; task: Task } | { ok: false };
export async function listTasks(): Promise<ListResult>;
export async function createTask(input: NewTask): Promise<CreateResult>;

// app/_actions/tasks.ts  ("use server")
export const SAVE_FAILED = "The task could not be saved. Please try again.";
export type CreateTaskState =
  | { status: "created"; task: Task }
  | { status: "invalid"; error: typeof TITLE_REQUIRED | typeof TITLE_TOO_LONG }
  | { status: "failed"; error: typeof SAVE_FAILED };
export async function createTaskAction(input: { title: string; due_date: string }): Promise<CreateTaskState>;

// app/_components/task-board.tsx  ("use client")
export const LOAD_FAILED = "Tasks could not be loaded. Please try again later.";
export function TaskBoard(props: { initial: ListResult }): JSX.Element;
```

`createTaskAction` pseudocode:

```
check = checkTitle(input.title);            if !check.ok → { status: "invalid", error }   // no fetch
due = input.due_date === "" ? null : input.due_date
if due !== null && !isDueDate(due)          → { status: "failed", error: SAVE_FAILED }   // no fetch
r = await createTask({ title: check.title, due_date: due })
r.ok ? { status: "created", task: r.task } : { status: "failed", error: SAVE_FAILED }
```

`client.ts` logs each failure once with `logger.warn("task api call failed", { op: "list"|"create", status?: number, reason: "status"|"shape"|"network"|"timeout"|"config" })`; it never logs the title.

### Rendered page (what the acceptance tests query)

Inside `<main>`, after the hero (`h1` `taskboard12-web`):

| Element | Markup / accessible name | Criteria |
|---|---|---|
| Tasks region | `<section aria-labelledby="tasks-title">` with `<h2 id="tasks-title">Tasks</h2>` → `getByRole("region", { name: "Tasks" })` | all |
| List | `<ul aria-label="Task list">` → `getByRole("list", { name: "Task list" })`; one `<li>` per task, in API order, created tasks appended at the end | AC-001.1, AC-001.3 |
| List entry | `<li>` containing the title (`<span className="task-title">`) and either `<time dateTime={due_date}>{due_date}</time>` or the text `No due date` | AC-001.1 |
| Empty state | `<p>No tasks yet</p>` instead of the list when the load succeeded and there are no tasks (also none created) | AC-001.2 |
| Load failure | `<p role="alert">Tasks could not be loaded. Please try again later.</p>` instead of the list; the page still answers `200` and still shows the form | AC-001.6 |
| Form | `<form aria-label="New task" noValidate>` → `getByRole("form", { name: "New task" })` | AC-001.3–7 |
| Title input | `<input type="text" name="title">`, label `Title` → `getByLabelText("Title")`; `aria-invalid="true"` and `aria-describedby="title-error"` while a validation message shows | AC-001.3–5 |
| Due date input | `<input type="date" name="due_date">`, label `Due date (optional)` → `getByLabelText("Due date (optional)")` | AC-001.3, AC-001.5 |
| Submit | `<button type="submit">Add task</button>`, disabled while the action runs | AC-001.3 |
| Validation message | `<p role="alert" id="title-error">Title is required</p>` or `…Title must be at most 200 characters</p>` | AC-001.4, AC-001.5 |
| Save failure | `<p role="alert">The task could not be saved. Please try again.</p>` | AC-001.7 |

Behaviour on submit: any previous form message is cleared; on `created` the task is appended (an empty state becomes the list), both inputs become empty; on `invalid` / `failed` the inputs keep their values, the list is unchanged and the one message above shows. When the initial load failed and a create succeeds, the load-failure alert stays and a list holding only the created tasks appears below it.

### How the acceptance tests drive it

Vitest + Testing Library (jsdom), no network: set `process.env.TASKBOARD12_API_URL = "http://task-api.test"` and stub the boundary with `vi.stubGlobal("fetch", vi.fn(...))`. Page: `render(await HomePage())`. Form: `render(<TaskBoard initial={{ ok: true, tasks }} />)` and `fireEvent` on the inputs/submit; the Server Action runs in-process (the `"use server"` directive is inert under Vitest), so the stubbed `fetch` sees the real `POST`. "No request is sent" = the stub got no `POST`. "Slower than 5 seconds" = the stub rejects with `new DOMException("timeout", "TimeoutError")`, and the call passed a `signal` (`AbortSignal.timeout(5000)`). "Page loads with status 200" (AC-001.6) = `HomePage()` resolves without throwing.

## Data

None in this repo (the Task API owns storage).
