export function TodoForm() {
  return (
    <form className="grid gap-4">
      <label key={"title"} className="flex flex-col gap-2">
        <span>Title</span>
        <input name="title" type="text" />
      </label>
      <label key={"details"} className="flex flex-col gap-2">
        <span>Details</span>
        <input name="details" type="text" />
      </label>
      <label key={"status"} className="flex flex-col gap-2">
        <span>Status</span>
        <input name="status" type="text" />
      </label>
      <label key={"dueAt"} className="flex flex-col gap-2">
        <span>Due At</span>
        <input name="dueAt" type="datetime-local" />
      </label>
      <button type="submit">Save Todo</button>
    </form>
  );
}
