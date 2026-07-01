import type { ReactNode } from "react";

import type { TodoRecord } from "../domain/schemas.js";

export function TodoForm(input: {
  action?: (formData: FormData) => void | Promise<void>;
  children?: ReactNode;
  defaultValues?: Partial<TodoRecord>;
  submitLabel?: string;
}) {
  return (
    <form action={input.action} className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      {input.children}
      <label key={"title"} className="grid gap-2">
        <span>Title</span>
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={input.defaultValues?.title ?? ""}
          name="title"
          required
          type="text"
        />
      </label>
      <label key={"details"} className="grid gap-2">
        <span>Details</span>
        <textarea
          className="min-h-24 rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={input.defaultValues?.details ?? ""}
          name="details"
          
        />
      </label>
      <label key={"status"} className="grid gap-2">
        <span>Status</span>
        <select
          className="rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={input.defaultValues?.status ?? "todo"}
          name="status"
          required
        >
          <option value="todo">Todo</option>
          <option value="done">Done</option>
        </select>
      </label>
      <label key={"dueAt"} className="grid gap-2">
        <span>Due At</span>
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={toDateTimeLocalValue(input.defaultValues?.dueAt)}
          name="dueAt"
          
          type="datetime-local"
        />
      </label>
      <button className="w-fit rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium" type="submit">{input.submitLabel ?? "Save Todo"}</button>
    </form>
  );
}

function toDateTimeLocalValue(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 16);
}
