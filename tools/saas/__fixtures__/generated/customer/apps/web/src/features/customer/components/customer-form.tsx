import type { ReactNode } from "react";

import type { CustomerRecord } from "../domain/schemas.js";

export function CustomerForm(input: {
  action?: (formData: FormData) => void | Promise<void>;
  children?: ReactNode;
  defaultValues?: Partial<CustomerRecord>;
  submitLabel?: string;
}) {
  return (
    <form action={input.action} className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      {input.children}
      <label key={"name"} className="grid gap-2">
        <span>Name</span>
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={input.defaultValues?.name ?? ""}
          name="name"
          required
          type="text"
        />
      </label>
      <label key={"email"} className="grid gap-2">
        <span>Email</span>
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={input.defaultValues?.email ?? ""}
          name="email"
          required
          type="email"
        />
      </label>
      <label key={"isActive"} className="flex items-center gap-2">
        <input
          className="h-4 w-4"
          defaultChecked={input.defaultValues?.isActive ?? true}
          name="isActive"
          type="checkbox"
        />
        <span>Is Active</span>
      </label>
      <label key={"status"} className="grid gap-2">
        <span>Status</span>
        <select
          className="rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={input.defaultValues?.status ?? "active"}
          name="status"
          required
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label key={"externalId"} className="grid gap-2">
        <span>External Id</span>
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={input.defaultValues?.externalId ?? ""}
          name="externalId"
          
          type="text"
        />
      </label>
      <label key={"lastContactedAt"} className="grid gap-2">
        <span>Last Contacted At</span>
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={toDateTimeLocalValue(input.defaultValues?.lastContactedAt)}
          name="lastContactedAt"
          
          type="datetime-local"
        />
      </label>
      <button className="w-fit rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium" type="submit">{input.submitLabel ?? "Save Customer"}</button>
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
