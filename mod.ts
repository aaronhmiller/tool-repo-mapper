/// <reference lib="deno.ns" />

import { parseArgs, read, utils } from "./deps.ts";

interface MappingObject {
  externalToolProject: string;
  externalToolProjectVersionToSkip: string[];
  externalToolProjectVersionToInclude: string[];
  oxRepo: string[];
}

interface ReportingArgs {
  appNameColumn: string;
  mapColumn: string;
  collection1: string[];
  collection2: string[];
}

async function readCsvFile(filename: string): Promise<string[][]> {
  const content = await Deno.readTextFile(filename);
  const lines = content.trim().split('\n');
  const result: string[][] = [];
  
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;
  
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          // Handle escaped quotes
          currentCell += '"';
          i++;
        } else {
          // Toggle quote state
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        // End of cell
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    
    if (!insideQuotes) {
      // End of row
      currentRow.push(currentCell.trim());
      result.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      // Inside a quoted cell, add newline
      currentCell += '\n';
    }
  }
  
  return result;
}

async function readExcelFile(filename: string): Promise<string[][]> {
  const workbook = read(await Deno.readFile(filename));
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  // Use raw: false to get formatted strings and header: 1 to get array format
  const data = utils.sheet_to_json(sheet, { header: 1, raw: false }) as (string | number | boolean | null)[][];
  
  // Convert all values to strings
  return data.map(row => 
    row.map(cell => 
      cell === null || cell === undefined ? '' : String(cell).trim()
    )
  );
}

async function pullFields(args: ReportingArgs, filename: string): Promise<ReportingArgs> {
  const isExcel = filename.toLowerCase().endsWith('.xlsx') || filename.toLowerCase().endsWith('.xls');
  const data = isExcel ? await readExcelFile(filename) : await readCsvFile(filename);

  const collection1: string[] = [];
  const collection2: string[] = [];

  // For Excel files, we use column letters (A, B, C, etc.)
  // For CSV files, we use column numbers (1, 2, 3, etc.)
  const appNameIdx = isExcel ? utils.decode_col(args.appNameColumn) : parseInt(args.appNameColumn) - 1;
  const mapIdx = isExcel ? utils.decode_col(args.mapColumn) : parseInt(args.mapColumn) - 1;

  // Validate column indices
  if (isNaN(appNameIdx) || isNaN(mapIdx)) {
    throw new Error(
      isExcel 
        ? 'For Excel files, columns should be letters (A, B, C, etc.)'
        : 'For CSV files, columns should be numbers (1, 2, 3, etc.)'
    );
  }

  // Skip header row and process data
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[appNameIdx] && row[mapIdx]) {
      // Split cell contents on newlines and filter out empty strings
      const repos = row[appNameIdx]
        .replace(/^"|"$/g, '') // Remove surrounding quotes
        .split(/[\n\r]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      repos.forEach(repo => {
        collection1.push(repo);
        collection2.push(row[mapIdx].trim());
      });
    }
  }

  return {
    ...args,
    collection1,
    collection2,
  };
}

function createMapping(collection1: string[], collection2: string[], mapType: string): MappingObject[] {
  // Create a map to group repositories by project
  const projectMap = new Map<string, Set<string>>();

  // Group repositories by project
  collection2.forEach((project, index) => {
    const repo = collection1[index];
    if (!projectMap.has(project)) {
      projectMap.set(project, new Set());
    }
    projectMap.get(project)?.add(repo);
  });

  // Convert the map to our desired output format
  return Array.from(projectMap.entries()).map(([project, repos]) => ({
    externalToolProject: project,
    externalToolProjectVersionToSkip: [],
    externalToolProjectVersionToInclude: [],
    oxRepo: Array.from(repos).sort(), // Sort for consistent output
  }));
}

async function createMappingJSON(): Promise<void> {
  const args = parseArgs(Deno.args);

  // Validate required parameters
  const inputFile = args.inputfile;
  if (!inputFile) {
    console.error("You must include parameter --inputfile (filename) as an input file (can be .xlsx, .xls, or .csv)");
    Deno.exit(1);
  }
  if (!await exists(inputFile)) {
    console.error(`Input file '${inputFile}' does not exist`);
    Deno.exit(1);
  }

  const isExcel = inputFile.toLowerCase().endsWith('.xlsx') || inputFile.toLowerCase().endsWith('.xls');
  const isCsv = inputFile.toLowerCase().endsWith('.csv');

  if (!isExcel && !isCsv) {
    console.error("Input file must be either an Excel file (.xlsx, .xls) or a CSV file (.csv)");
    Deno.exit(1);
  }

  const jsonFile = args.outputfile;
  if (!jsonFile) {
    console.error("You must include parameter --outputfile (filename) as an output for the json file");
    Deno.exit(1);
  }

  const mapType = args.maptype?.toLowerCase();
  if (!mapType || !['blackduck', 'polaris', 'veracode', 'checkmarx', 'sonatype'].includes(mapType)) {
    console.error("You must include parameter --maptype (type) with one of: blackduck, polaris, veracode, checkmarx, sonatype");
    Deno.exit(1);
  }

  const appNameCol = args.appname;
  if (!appNameCol) {
    console.error(
      isExcel
        ? "You must include parameter --appname (column letter, e.g., 'A')"
        : "You must include parameter --appname (column number, e.g., '1')"
    );
    Deno.exit(1);
  }

  const mapCol = args.map;
  if (!mapCol) {
    console.error(
      isExcel
        ? "You must include parameter --map (column letter, e.g., 'B')"
        : "You must include parameter --map (column number, e.g., '2')"
    );
    Deno.exit(1);
  }

  // Process input file
  const reportArgs: ReportingArgs = {
    appNameColumn: appNameCol,
    mapColumn: mapCol,
    collection1: [],
    collection2: [],
  };

  try {
    const processedArgs = await pullFields(reportArgs, inputFile);
    
    console.log(`Collection1: ${processedArgs.collection1.length}`);
    console.log(`Collection2: ${processedArgs.collection2.length}`);

    // Create and save JSON
    const mappings = createMapping(processedArgs.collection1, processedArgs.collection2, mapType);
    await Deno.writeTextFile(jsonFile, JSON.stringify(mappings, null, 2));
    console.log(`File saved: ${jsonFile}`);
  } catch (error) {
    console.error("Error:", error.message);
    Deno.exit(1);
  }
}

async function exists(filename: string): Promise<boolean> {
  try {
    await Deno.stat(filename);
    return true;
  } catch {
    return false;
  }
}

if (import.meta.main) {
  createMappingJSON();
}
