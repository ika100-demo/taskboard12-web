export const TITLE_MAX = 200;
export const TITLE_REQUIRED = "Title is required";
export const TITLE_TOO_LONG = "Title must be at most 200 characters";

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
