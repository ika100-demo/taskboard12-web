"use server";

import { createTask } from "@/lib/tasks/client";
import type { Task } from "@/lib/tasks/types";
import { SAVE_FAILED, checkTitle, isDueDate, type TITLE_REQUIRED, type TITLE_TOO_LONG } from "@/lib/tasks/validate";

export type CreateTaskState =
  | { status: "created"; task: Task }
  | { status: "invalid"; error: typeof TITLE_REQUIRED | typeof TITLE_TOO_LONG }
  | { status: "failed"; error: typeof SAVE_FAILED };

export async function createTaskAction(input: { title: string; due_date: string }): Promise<CreateTaskState> {
  const check = checkTitle(String(input.title));
  if (!check.ok) return { status: "invalid", error: check.error };

  const due = input.due_date === "" ? null : String(input.due_date);
  if (due !== null && !isDueDate(due)) return { status: "failed", error: SAVE_FAILED };

  const result = await createTask({ title: check.title, due_date: due });
  return result.ok ? { status: "created", task: result.task } : { status: "failed", error: SAVE_FAILED };
}
