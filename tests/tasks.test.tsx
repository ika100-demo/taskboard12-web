import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";
import { TaskBoard } from "@/app/_components/task-board";

const API = "http://task-api.test";
const LOAD_FAILED = "Tasks could not be loaded. Please try again later.";
const SAVE_FAILED = "The task could not be saved. Please try again.";

type Task = { id: string; title: string; due_date: string | null; created_at: string };

const task = (id: string, title: string, due: string | null = null): Task => ({
  id,
  title,
  due_date: due,
  created_at: "2026-01-01T00:00:00Z",
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function stubFetch(handler: Handler) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init));
  vi.stubGlobal("fetch", fn);
  return fn;
}

const posts = (fn: ReturnType<typeof stubFetch>) => fn.mock.calls.filter(([, init]) => init?.method === "POST");

const timeoutError = () => new DOMException("timeout", "TimeoutError");

beforeEach(() => {
  process.env.TASKBOARD12_API_URL = API;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.TASKBOARD12_API_URL;
});

async function renderPage() {
  render(await HomePage());
  return screen.getByRole("region", { name: "Tasks" });
}

const tasksRegion = () => screen.getByRole("region", { name: "Tasks" });

function fillAndSubmit(title: string, due?: string) {
  const form = screen.getByRole("form", { name: "New task" });
  fireEvent.change(within(form).getByLabelText("Title"), { target: { value: title } });
  if (due !== undefined) fireEvent.change(within(form).getByLabelText("Due date (optional)"), { target: { value: due } });
  fireEvent.click(within(form).getByRole("button", { name: "Add task" }));
  return form;
}

describe("task list (page)", () => {
  it("AC-001.1 shows one entry per task in API order with title and due date or 'No due date'", async () => {
    stubFetch(() => json(200, [task("1", "Write spec", "2026-03-05"), task("2", "Ship it"), task("3", "Alpha", "2025-12-31")]));
    const region = await renderPage();
    const items = within(within(region).getByRole("list", { name: "Task list" })).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Write spec");
    expect(items[0]).toHaveTextContent("2026-03-05");
    expect(items[1]).toHaveTextContent("Ship it");
    expect(items[1]).toHaveTextContent("No due date");
    expect(items[2]).toHaveTextContent("Alpha");
    expect(items[2]).toHaveTextContent("2025-12-31");
  });

  it("AC-001.2 shows 'No tasks yet' when the API returns an empty list", async () => {
    stubFetch(() => json(200, []));
    const region = await renderPage();
    expect(within(region).getByText("No tasks yet")).toBeInTheDocument();
    expect(within(region).queryByRole("list", { name: "Task list" })).not.toBeInTheDocument();
  });

  it("AC-001.6 shows the load error when the API times out", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const fn = stubFetch(() => {
      throw timeoutError();
    });
    const region = await renderPage();
    expect(within(region).getByText(LOAD_FAILED)).toBeInTheDocument();
    expect(within(region).queryByRole("list", { name: "Task list" })).not.toBeInTheDocument();
    expect(fn.mock.calls[0][1]?.signal).toBeTruthy();
    expect(timeoutSpy).toHaveBeenCalledWith(5000);
    timeoutSpy.mockRestore();
  });

  it("AC-001.6 shows the load error when the API is unreachable", async () => {
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    const region = await renderPage();
    expect(within(region).getByText(LOAD_FAILED)).toBeInTheDocument();
  });

  it.each([500, 503, 404])("AC-001.6 shows the load error when GET /tasks answers %i", async (status) => {
    stubFetch(() => json(status, { detail: "nope" }));
    const region = await renderPage();
    expect(within(region).getByText(LOAD_FAILED)).toBeInTheDocument();
    expect(within(region).queryByRole("list", { name: "Task list" })).not.toBeInTheDocument();
  });
});

describe("create form", () => {
  it("AC-001.3 posts the trimmed title and due date, appends the returned task and clears the form", async () => {
    const fn = stubFetch((_url, init) =>
      init?.method === "POST" ? json(201, task("9", "New one", "2026-05-01")) : json(200, []),
    );
    render(<TaskBoard initial={{ ok: true, tasks: [task("1", "First")] }} />);
    const form = fillAndSubmit("  New one  ", "2026-05-01");

    await waitFor(() => expect(screen.getByRole("list", { name: "Task list" })).toHaveTextContent("New one"));
    const items = within(screen.getByRole("list", { name: "Task list" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("First");
    expect(items[1]).toHaveTextContent("New one");
    expect(items[1]).toHaveTextContent("2026-05-01");

    const sent = posts(fn);
    expect(sent).toHaveLength(1);
    expect(String(sent[0][0])).toBe(`${API}/tasks`);
    expect(JSON.parse(String(sent[0][1]?.body))).toEqual({ title: "New one", due_date: "2026-05-01" });
    await waitFor(() => expect(within(form).getByLabelText("Title")).toHaveValue(""));
    expect(within(form).getByLabelText("Due date (optional)")).toHaveValue("");
  });

  it("AC-001.3 sends due_date null when no date is given and replaces the empty state", async () => {
    const fn = stubFetch(() => json(201, task("9", "Solo")));
    render(<TaskBoard initial={{ ok: true, tasks: [] }} />);
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    fillAndSubmit("Solo");
    await waitFor(() => expect(screen.getByRole("list", { name: "Task list" })).toHaveTextContent("Solo"));
    expect(screen.queryByText("No tasks yet")).not.toBeInTheDocument();
    expect(JSON.parse(String(posts(fn)[0][1]?.body))).toEqual({ title: "Solo", due_date: null });
  });

  it.each([["empty", ""], ["whitespace-only", "   \t "]])(
    "AC-001.4 rejects an %s title without a request",
    async (_name, value) => {
      const fn = stubFetch(() => json(201, task("9", "x")));
      render(<TaskBoard initial={{ ok: true, tasks: [task("1", "First")] }} />);
      const form = fillAndSubmit(value, "2026-05-01");
      expect(await within(tasksRegion()).findByText("Title is required")).toBeInTheDocument();
      expect(posts(fn)).toHaveLength(0);
      expect(within(form).getByLabelText("Title")).toHaveValue(value);
      expect(within(form).getByLabelText("Due date (optional)")).toHaveValue("2026-05-01");
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
    },
  );

  it("AC-001.5 rejects a title over 200 characters after trimming without a request", async () => {
    const fn = stubFetch(() => json(201, task("9", "x")));
    render(<TaskBoard initial={{ ok: true, tasks: [] }} />);
    const long = "a".repeat(201);
    const form = fillAndSubmit(`  ${long}  `);
    expect(await within(tasksRegion()).findByText("Title must be at most 200 characters")).toBeInTheDocument();
    expect(posts(fn)).toHaveLength(0);
    expect(within(form).getByLabelText("Title")).toHaveValue(`  ${long}  `);
  });

  it("AC-001.5 sends a title of exactly 200 characters after trimming", async () => {
    const exact = "b".repeat(200);
    const fn = stubFetch(() => json(201, task("9", exact)));
    render(<TaskBoard initial={{ ok: true, tasks: [] }} />);
    fillAndSubmit(` ${exact} `);
    await waitFor(() => expect(posts(fn)).toHaveLength(1));
    expect(JSON.parse(String(posts(fn)[0][1]?.body)).title).toBe(exact);
    expect(screen.queryByText("Title must be at most 200 characters")).not.toBeInTheDocument();
  });

  it("AC-001.5 sends a past due date", async () => {
    const fn = stubFetch(() => json(201, task("9", "Old", "2000-01-01")));
    render(<TaskBoard initial={{ ok: true, tasks: [] }} />);
    fillAndSubmit("Old", "2000-01-01");
    await waitFor(() => expect(posts(fn)).toHaveLength(1));
    expect(JSON.parse(String(posts(fn)[0][1]?.body))).toEqual({ title: "Old", due_date: "2000-01-01" });
  });

  it("AC-001.7 keeps input and list and shows the save error when the API times out", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const fn = stubFetch(() => {
      throw timeoutError();
    });
    render(<TaskBoard initial={{ ok: true, tasks: [task("1", "First")] }} />);
    const form = fillAndSubmit("Keep me", "2026-06-01");
    expect(await within(tasksRegion()).findByText(SAVE_FAILED)).toBeInTheDocument();
    expect(fn.mock.calls[0][1]?.signal).toBeTruthy();
    expect(timeoutSpy).toHaveBeenCalledWith(5000);
    timeoutSpy.mockRestore();
    expect(within(form).getByLabelText("Title")).toHaveValue("Keep me");
    expect(within(form).getByLabelText("Due date (optional)")).toHaveValue("2026-06-01");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("AC-001.7 shows the save error when the API is unreachable", async () => {
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    render(<TaskBoard initial={{ ok: true, tasks: [] }} />);
    const form = fillAndSubmit("Keep me");
    expect(await within(tasksRegion()).findByText(SAVE_FAILED)).toBeInTheDocument();
    expect(within(form).getByLabelText("Title")).toHaveValue("Keep me");
  });

  it.each([422, 503, 200])("AC-001.7 keeps input and list and shows the save error when POST answers %i", async (status) => {
    stubFetch(() => json(status, task("9", "Keep me")));
    render(<TaskBoard initial={{ ok: true, tasks: [task("1", "First")] }} />);
    const form = fillAndSubmit("Keep me", "2026-06-01");
    expect(await within(tasksRegion()).findByText(SAVE_FAILED)).toBeInTheDocument();
    expect(within(form).getByLabelText("Title")).toHaveValue("Keep me");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});
