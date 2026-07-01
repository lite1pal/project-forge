import type { TodoRecord } from "../domain/schemas.js";

export function TodoTable(input: {
  items: readonly TodoRecord[];
  organizationId?: string;
  projectId?: string;
  resourceBasePath?: string;
}) {
  const showActions = Boolean(input.organizationId && input.resourceBasePath);

  return (
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Details</th>
          <th>Status</th>
          <th>Due At</th>
          {showActions ? <th>Actions</th> : null}
        </tr>
      </thead>
      <tbody>
        {input.items.map((item) => (
          <tr key={item.id}>
            <td>{item.title?.toString()}</td>
            <td>{item.details?.toString()}</td>
            <td>{item.status?.toString()}</td>
            <td>{item.dueAt?.toString()}</td>
            {showActions ? (
              <td>
                <div className="flex gap-3">
                  <a href={buildResourceHref(input, item.id)}>View</a>
                  <a href={buildEditHref(input, item.id)}>Edit</a>
                </div>
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function buildResourceHref(
  input: Pick<TodoTableParameters, "organizationId" | "projectId" | "resourceBasePath">,
  id: string
) {
  const query = new URLSearchParams({
    organizationId: input.organizationId ?? ""
  });

  if (input.projectId) {
    query.set("projectId", input.projectId);
  }

  return `${input.resourceBasePath}/${id}?${query.toString()}`;
}

function buildEditHref(
  input: Pick<TodoTableParameters, "organizationId" | "projectId" | "resourceBasePath">,
  id: string
) {
  const query = new URLSearchParams({
    organizationId: input.organizationId ?? ""
  });

  if (input.projectId) {
    query.set("projectId", input.projectId);
  }

  return `${input.resourceBasePath}/${id}/edit?${query.toString()}`;
}

interface TodoTableParameters {
  items: readonly TodoRecord[];
  organizationId?: string;
  projectId?: string;
  resourceBasePath?: string;
}
