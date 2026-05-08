import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DataTableProps {
  data: Record<string, string>[];
  columns: string[];
}

const DataTable = ({ data, columns }: DataTableProps) => {
  const preview = data.slice(0, 50);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12 text-center font-mono text-xs">#</TableHead>
              {columns.map((col) => (
                <TableHead key={col} className="font-mono text-xs whitespace-nowrap">
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.map((row, i) => (
              <TableRow key={i} className="animate-fade-in" style={{ animationDelay: `${i * 20}ms` }}>
                <TableCell className="text-center font-mono text-xs text-muted-foreground">
                  {i + 1}
                </TableCell>
                {columns.map((col) => (
                  <TableCell key={col} className="font-mono text-sm whitespace-nowrap max-w-[200px] truncate">
                    {String(row[col] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data.length > 50 && (
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          Показано 50 из {data.length} строк
        </div>
      )}
    </div>
  );
};

export default DataTable;
