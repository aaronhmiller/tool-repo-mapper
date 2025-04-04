/// <reference lib="deno.ns" />

import { utils, writeFile } from "npm:xlsx@0.18.5";

// Create sample data
const data = [
  ["Application Name", "Project ID"],  // headers
  ["github.com/org/repo1", "SecurityProject1"],
  ["github.com/org/repo2", "DependencyCheck2"],
  ["github.com/org/repo3", "SecurityScan3"],
  ["github.com/org/repo4", "AppSec4"],
];

// Create a new workbook
const wb = utils.book_new();
const ws = utils.aoa_to_sheet(data);

// Add worksheet to workbook
utils.book_append_sheet(wb, ws, "Mappings");

// Write to Excel files
writeFile(wb, "sample.xlsx");
writeFile(wb, "sample.xls", { bookType: "xls" });

// Write to CSV file
const csvContent = data.map(row => row.map(cell => 
  // Escape cells containing commas or quotes with quotes
  cell.includes(',') || cell.includes('"') 
    ? `"${cell.replace(/"/g, '""')}"` 
    : cell
).join(',')).join('\n');

await Deno.writeTextFile("sample.csv", csvContent);
