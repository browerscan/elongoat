import { readFile } from "node:fs/promises";
import path from "node:path";

import { getDb } from "../lib/db";

// ============================================================================
// SQL Validation Constants
// ============================================================================

/**
 * Allowed SQL statement prefixes for schema application
 * Only safe DDL operations are permitted
 */
const ALLOWED_SQL_STATEMENTS = [
  "CREATE",
  "ALTER",
  "DROP",
  "GRANT",
  "REVOKE",
  "COMMENT",
  "BEGIN",
  "COMMIT",
  "--", // SQL comments
  "", // Empty lines
] as const;

/**
 * Blocked SQL patterns that could indicate SQL injection attempts
 * or unsafe operations
 */
const BLOCKED_PATTERNS = [
  /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|EXEC|EXECUTE)\b/i, // DML (should use proper migrations)
  /\b(COPY\s+|LOAD\s+DATA|INFILE)\b/i, // File operations
  /\b(SHELL\s*\'|SYSTEM\s*\(|\|\s*\w+|&&)\b/i, // Command execution attempts
  /\b(DO\s+\$\$|SELECT\s+pg_)\b/i, // Direct function calls without migration
];

// ============================================================================
// Path Validation
// ============================================================================

/**
 * Validate that the SQL file path is within the expected directory
 * Prevents path traversal attacks
 */
function validateSqlPath(sqlPath: string, expectedDir: string): void {
  const resolvedPath = path.resolve(sqlPath);
  const resolvedDir = path.resolve(expectedDir);

  if (!resolvedPath.startsWith(resolvedDir)) {
    throw new Error(
      `Security error: SQL file path is outside expected directory. ` +
        `Expected: ${resolvedDir}, Got: ${resolvedPath}`,
    );
  }

  // Ensure the file has .sql extension
  if (!resolvedPath.endsWith(".sql")) {
    throw new Error(
      `Security error: Only .sql files are allowed. Got: ${resolvedPath}`,
    );
  }
}

// ============================================================================
// SQL Content Validation
// ============================================================================

/**
 * Validate SQL content for safe operations only
 * Checks for blocked patterns and ensures only allowed statements are used
 */
function validateSqlContent(sql: string): void {
  const lines = sql.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and comments
    if (!line || line.startsWith("--") || line.startsWith("/*")) {
      continue;
    }

    // Check for blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(line)) {
        throw new Error(
          `Security error: Blocked SQL pattern detected at line ${i + 1}: "${line}"`,
        );
      }
    }

    // Check that line starts with allowed statement
    const firstWord = line.split(/\s+/)[0]?.toUpperCase();
    if (firstWord && !ALLOWED_SQL_STATEMENTS.includes(firstWord as any)) {
      throw new Error(
        `Security error: Unexpected SQL statement at line ${i + 1}: "${firstWord}". ` +
          `Allowed: ${ALLOWED_SQL_STATEMENTS.filter((s) => s !== "" && s !== "--").join(", ")}`,
      );
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const schemaDir = path.join(process.cwd(), "backend", "supabase");
  const sqlPath = path.join(schemaDir, "schema.sql");

  // Validate file path is within expected directory
  validateSqlPath(sqlPath, schemaDir);

  // Read SQL file
  const sql = await readFile(sqlPath, "utf-8");

  // Validate SQL content
  validateSqlContent(sql);

  const db = getDb();
  console.log(`[schema] Applying ${sqlPath}`);
  await db.query(sql);
  console.log("[schema] Done");
  await db.end();
}

main().catch((err) => {
  console.error("[schema] Failed:", err);
  process.exitCode = 1;
});
