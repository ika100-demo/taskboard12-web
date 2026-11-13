export const TITLE_MAX = 200;
export const TITLE_REQUIRED = "Title is required";
export const TITLE_TOO_LONG = "Title must be at most 200 characters";
// Lives here, not in app/_actions/tasks.ts: a "use server" file may export only async functions.
export const SAVE_FAILED = "The task could not be saved. Please try again.";

export type TitleCheck =
  | { ok: true; title: string }
  | { ok: false; error: typeof TITLE_REQUIRED | typeof TITLE_TOO_LONG };

export function checkTitle(raw: string): TitleCheck {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, error: TITLE_REQUIRED };
  if ([...trimmed].length > TITLE_MAX) return { ok: false, error: TITLE_TOO_LONG };
  return { ok: true, title: trimmed };
}

export function isDueDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
