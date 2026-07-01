import type { CustomerRecord } from "../domain/schemas.js";

export function CustomerTable(input: {
  items: readonly CustomerRecord[];
}) {
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
          </tr>
        ))}
      </tbody>
    </table>
  );
}
