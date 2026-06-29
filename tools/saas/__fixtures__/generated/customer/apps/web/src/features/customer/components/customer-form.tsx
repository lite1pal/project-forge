export function CustomerForm() {
  return (
    <form className="grid gap-4">
      <label key={"name"} className="flex flex-col gap-2">
        <span>Name</span>
        <input name="name" type="text" />
      </label>
      <label key={"email"} className="flex flex-col gap-2">
        <span>Email</span>
        <input name="email" type="email" />
      </label>
      <label key={"isActive"} className="flex flex-col gap-2">
        <span>Is Active</span>
        <input name="isActive" type="checkbox" />
      </label>
      <label key={"status"} className="flex flex-col gap-2">
        <span>Status</span>
        <input name="status" type="text" />
      </label>
      <label key={"externalId"} className="flex flex-col gap-2">
        <span>External Id</span>
        <input name="externalId" type="text" />
      </label>
      <label key={"lastContactedAt"} className="flex flex-col gap-2">
        <span>Last Contacted At</span>
        <input name="lastContactedAt" type="datetime-local" />
      </label>
      <button type="submit">Save Customer</button>
    </form>
  );
}
