import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTask, listTasks } from "@/lib/tasks/client";

const task = { id: "1", title: "A", due_date: "2026-01-02", created_at: "2026-01-01T00:00:00Z" };

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.TASKBOARD12_API_URL = "http://api.test";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TASKBOARD12_API_URL;
});

describe("listTasks", () => {
  it("returns tasks on 200 and sends the right request", async () => {
    fetchMock.mockResolvedValue(json([task, { ...task, id: "2", due_date: null }], 200));
    const res = await listTasks();
    expect(res.ok && res.tasks).toHaveLength(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/tasks");
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.headers.accept).toBe("application/json");
  });

  it("strips a trailing slash", async () => {
    process.env.TASKBOARD12_API_URL = "http://api.test/";
    fetchMock.mockResolvedValue(json([], 200));
    await listTasks();
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/tasks");
  });

  it.each([422, 500, 503])("fails on status %i", async (status) => {
    fetchMock.mockResolvedValue(json([task], status));
    expect(await listTasks()).toEqual({ ok: false });
  });

  it("fails on non-JSON body", async () => {
    fetchMock.mockResolvedValue(new Response("<html>", { status: 200 }));
    expect(await listTasks()).toEqual({ ok: false });
  });

  it("fails on wrong shape", async () => {
    fetchMock.mockResolvedValue(json({ tasks: [] }, 200));
    expect(await listTasks()).toEqual({ ok: false });
    fetchMock.mockResolvedValue(json([{ ...task, id: "" }], 200));
    expect(await listTasks()).toEqual({ ok: false });
    fetchMock.mockResolvedValue(json([{ ...task, due_date: "tomorrow" }], 200));
    expect(await listTasks()).toEqual({ ok: false });
  });

  it("fails on network error and timeout", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await listTasks()).toEqual({ ok: false });
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    expect(await listTasks()).toEqual({ ok: false });
  });

  it("fails without calling fetch when the URL is unset", async () => {
    delete process.env.TASKBOARD12_API_URL;
    expect(await listTasks()).toEqual({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("createTask", () => {
  it("returns the task on 201 and posts both keys", async () => {
    fetchMock.mockResolvedValue(json(task, 201));
    const res = await createTask({ title: "A", due_date: null });
    expect(res).toEqual({ ok: true, task });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/tasks");
    expect(init.method).toBe("POST");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ title: "A", due_date: null });
  });

  it.each([200, 422, 500, 503])("fails on status %i", async (status) => {
    fetchMock.mockResolvedValue(json(task, status));
    expect(await createTask({ title: "A", due_date: null })).toEqual({ ok: false });
  });

  it("fails on wrong shape, non-JSON, network error, timeout, unset URL", async () => {
    const input = { title: "A", due_date: null };
    fetchMock.mockResolvedValue(json({ id: 1 }, 201));
    expect(await createTask(input)).toEqual({ ok: false });
    fetchMock.mockResolvedValue(new Response("nope", { status: 201 }));
    expect(await createTask(input)).toEqual({ ok: false });
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await createTask(input)).toEqual({ ok: false });
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    expect(await createTask(input)).toEqual({ ok: false });
    delete process.env.TASKBOARD12_API_URL;
    fetchMock.mockClear();
    expect(await createTask(input)).toEqual({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
