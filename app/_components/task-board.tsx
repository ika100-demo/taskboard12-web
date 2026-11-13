"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import { createTaskAction } from "@/app/_actions/tasks";
import type { ListResult } from "@/lib/tasks/client";
import type { Task } from "@/lib/tasks/types";

export const LOAD_FAILED = "Tasks could not be loaded. Please try again later.";

type Message = { kind: "invalid" | "failed"; text: string } | null;

export function TaskBoard({ initial }: { initial: ListResult }) {
  const [tasks, setTasks] = useState<Task[]>(initial.ok ? initial.tasks : []);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await createTaskAction({ title, due_date: dueDate });
      if (result.status === "created") {
        setTasks((prev) => [...prev, result.task]);
        setTitle("");
        setDueDate("");
      } else {
        setMessage({ kind: result.status, text: result.error });
      }
    });
  }

  const invalid = message?.kind === "invalid";

  return (
    <section className="section" aria-labelledby="tasks-title">
      <div className="section-head">
        <h2 id="tasks-title" className="section-title">
          Tasks
        </h2>
      </div>

      {!initial.ok && <p role="alert">{LOAD_FAILED}</p>}
      {tasks.length > 0 ? (
        <ul className="task-list" aria-label="Task list">
          {tasks.map((task) => (
            <li key={task.id} className="task-item">
              <span className="task-title">{task.title}</span>
              {task.due_date === null ? (
                <span className="task-due">No due date</span>
              ) : (
                <time className="task-due" dateTime={task.due_date}>
                  {task.due_date}
                </time>
              )}
            </li>
          ))}
        </ul>
      ) : (
        initial.ok && <p>No tasks yet</p>
      )}

      <form className="task-form" aria-label="New task" noValidate onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="task-title">Title</label>
          <input
            id="task-title"
            type="text"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={invalid ? "true" : undefined}
            aria-describedby={invalid ? "title-error" : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor="task-due-date">Due date (optional)</label>
          <input id="task-due-date" type="date" name="due_date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          Add task
        </button>
        {message &&
          (invalid ? (
            <p role="alert" id="title-error">
              {message.text}
            </p>
          ) : (
            <p role="alert">{message.text}</p>
          ))}
      </form>
    </section>
  );
}
