import type { TodoRecord } from "../domain/schemas.js";

export function TodoTable(input: {
  items: readonly TodoRecord[];
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Details</th>
          <th>Status</th>
          <th>Due At</th>
        </tr>
      </thead>
      <tbody>
        {input.items.map((item) => (
          <tr key={item.id}>
            <td>{item.title?.toString()}</td>
            <td>{item.details?.toString()}</td>
            <td>{item.status?.toString()}</td>
            <td>{item.dueAt?.toString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
