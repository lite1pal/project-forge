export interface UtcMonthWindow {
  periodEnd: string;
  periodStart: string;
}

export function getUtcMonthWindow(date: Date): UtcMonthWindow {
  const periodStart = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0)
  );
  const periodEnd = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0)
  );

  return {
    periodEnd: periodEnd.toISOString(),
    periodStart: periodStart.toISOString()
  };
}
