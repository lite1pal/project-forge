import type { CustomerRecord } from "../domain/schemas.js";

export function CustomerTable(input: {
  items: readonly CustomerRecord[];
  organizationId?: string;
  projectId?: string;
  resourceBasePath?: string;
}) {
  const showActions = Boolean(input.organizationId && input.resourceBasePath);

  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Is Active</th>
          <th>Status</th>
          <th>External Id</th>
          <th>Last Contacted At</th>
          {showActions ? <th>Actions</th> : null}
        </tr>
      </thead>
      <tbody>
        {input.items.map((item) => (
          <tr key={item.id}>
            <td>{item.name?.toString()}</td>
            <td>{item.email?.toString()}</td>
            <td>{item.isActive?.toString()}</td>
            <td>{item.status?.toString()}</td>
            <td>{item.externalId?.toString()}</td>
            <td>{item.lastContactedAt?.toString()}</td>
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
  input: Pick<CustomerTableParameters, "organizationId" | "projectId" | "resourceBasePath">,
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
  input: Pick<CustomerTableParameters, "organizationId" | "projectId" | "resourceBasePath">,
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

interface CustomerTableParameters {
  items: readonly CustomerRecord[];
  organizationId?: string;
  projectId?: string;
  resourceBasePath?: string;
}
