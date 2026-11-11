import { type AsyncTableData } from "@/src/components/design-system/table/Table";

/** Maps a tRPC list query onto the table's loading / error / data states. */
export function asyncTableData<T>(query: {
  isPending: boolean;
  error: { message: string } | null;
  data: T[] | undefined;
}): AsyncTableData<T[]> {
  if (query.isPending) return { status: "loading" };
  if (query.error) return { status: "error", error: query.error.message };
  return { status: "success", data: query.data ?? [] };
}
