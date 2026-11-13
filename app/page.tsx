import { TaskBoard } from "./_components/task-board";
import { listTasks } from "@/lib/tasks/client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initial = await listTasks();

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">
          <span className="dot" aria-hidden="true" />
          Up and running
        </p>
        <h1 id="hero-title" className="hero-title">
          taskboard12-web
        </h1>
        <p className="lead">Web UI for the taskboard12 system</p>
        <div className="actions">
          <a className="btn btn-secondary" href="/api/health">
            Check health
          </a>
        </div>
      </section>

      <TaskBoard initial={initial} />
    </>
  );
}
