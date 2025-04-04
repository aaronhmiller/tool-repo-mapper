# tool-repo-mapper
Mapping tool for 3rd party projects to OX apps (repos)

A Deno TypeScript program that converts a CSV/XLS/XLSX file with 3rd party project to application mappings delivered in a JSON format.

## Requirements

- [Deno](https://deno.land/) installed on your system

## Usage

```bash
deno run --allow-read --allow-write --allow-net mod.ts \
  --inputfile your_file.[csv|xls|xlsx] \
  --outputfile output.json \
  --maptype veracode \
  --appname [1|A] \  # Use numbers for CSV, letters for Excel
  --map [2|B]        # Use numbers for CSV, letters for Excel
```

### Input Format

The input file should have two columns in this order:
1. Application Name
2. Project Name

Example:
```csv
applicationName,projectName
my-github-repo,project-x
another-repo,project-y
```
### Output JSON Format

The program will generate a JSON file containing an array of objects with this structure:
```json
[
  {
    "externalToolProject": "project-x",
    "externalToolProjectVersionToSkip": [],
    "externalToolProjectVersionToInclude": [],
    "oxRepo": "my-github-repo"
  }
]
```
