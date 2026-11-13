import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";

beforeEach(() => {
  process.env.TASKBOARD12_API_URL = "http://task-api.test";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("[]", { status: 200, headers: { "content-type": "application/json" } })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TASKBOARD12_API_URL;
});

describe("HomePage", () => {
  it("renders the project heading", async () => {
    render(await HomePage());
    expect(screen.getByRole("heading", { level: 1, name: "taskboard12-web" })).toBeInTheDocument();
  });

  it("links to the health check", async () => {
    render(await HomePage());
    expect(screen.getByRole("link", { name: "Check health" })).toHaveAttribute("href", "/api/health");
  });

  it("renders the Tasks region", async () => {
    render(await HomePage());
    expect(within(screen.getByRole("region", { name: "Tasks" })).getByRole("form", { name: "New task" })).toBeInTheDocument();
  });

  it("keeps a single level-1 heading", async () => {
    render(await HomePage());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Tasks"]);
  });
});
