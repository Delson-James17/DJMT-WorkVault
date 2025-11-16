import React, { useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { DataGrid } from "react-data-grid";
import type { Column } from "react-data-grid"; // type-only import

interface RowData {
  [key: string]: string | number | undefined;
}

export const ExcelEditor: React.FC<{ url: string; onSave: (data: Uint8Array) => void }> = ({ url, onSave }) => {
  const [rows, setRows] = useState<RowData[]>([]);
  const [columns, setColumns] = useState<Column<RowData>[]>([]);

  const loadExcel = async () => {
    const data = await fetch(url).then((res) => res.arrayBuffer());
    const workbook = XLSX.read(data, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as (string | number)[][];

    setColumns(
      json[0].map((col, i) => ({
        key: `col${i}`,
        name: String(col),
        editable: true,
      }))
    );

    setRows(
      json.slice(1).map((row) =>
        Object.fromEntries(row.map((val, i) => [`col${i}`, val]))
      )
    );
  };

  const saveExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      rows.map((r) => columns.map((c) => r[c.key] ?? ""))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    onSave(new Uint8Array(wbout));
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    saveAs(blob, "edited.xlsx");
  };

  return (
    <div>
      <button onClick={loadExcel}>Load Excel</button>
      {rows.length > 0 && (
        <>
          <DataGrid columns={columns} rows={rows} onRowsChange={setRows} />
          <button onClick={saveExcel}>Save Excel</button>
        </>
      )}
    </div>
  );
};
