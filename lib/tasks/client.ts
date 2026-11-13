import { logger } from "@/lib/logger";
import type { NewTask, Task } from "./types";
import { isDueDate } from "./validate";

export type ListResult = { ok: true; tasks: Task[] } | { ok: false };
export type CreateResult = { ok: true; task: Task } | { ok: false };

type Op = "list" | "create";
type Reason = "status" | "shape" | "network" | "timeout" | "config";

const TIMEOUT_MS = 5000;

function fail(op: Op, reason: Reason, status?: number): { ok: false } {
  logger.warn("task api call failed", {
    op,
    ...(status === undefined ? {} : { status }),
    reason,
  });
  return { ok: false };
}

function isTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id !== "" &&
    typeof v.title === "string" &&
    (v.due_date === null || (typeof v.due_date === "string" && isDueDate(v.due_date))) &&
    typeof v.created_at === "string"
  );
}

/** Performs the call; returns the parsed JSON body on the expected status, else a failure. */
async function call(
  op: Op,
  expectedStatus: number,
  init: { method: string; body?: string },
): Promise<{ ok: true; data: unknown } | { ok: false }> {
  const base = process.env.TASKBOARD12_API_URL?.replace(/\/+$/, "");
  if (!base) return fail(op, "config");

  let response: Response;
  try {
    response = await fetch(`${base}/tasks`, {
      method: init.method,
      body: init.body,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        accept: "application/json",
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      },
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return fail(op, timedOut ? "timeout" : "network");
  }

  if (response.status !== expectedStatus) return fail(op, "status", response.status);

  try {
    return { ok: true, data: await response.json() };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return fail(op, timedOut ? "timeout" : "shape", response.status);
  }
}

export async function listTasks(): Promise<ListResult> {
  const res = await call("list", 200, { method: "GET" });
  if (!res.ok) return res;
  if (!Array.isArray(res.data) || !res.data.every(isTask)) return fail("list", "shape", 200);
  return { ok: true, tasks: res.data };
}

export async function createTask(input: NewTask): Promise<CreateResult> {
  const res = await call("create", 201, {
    method: "POST",
    body: JSON.stringify({ title: input.title, due_date: input.due_date }),
  });
  if (!res.ok) return res;
  if (!isTask(res.data)) return fail("create", "shape", 201);
  return { ok: true, task: res.data };
}
