/**
 * SQL Security Utilities
 *
 * Functions to prevent SQL injection attacks, particularly for LIKE/ILIKE queries.
 */

/**
 * Escape special characters for PostgreSQL LIKE/ILIKE patterns.
 *
 * LIKE patterns use % and _ as wildcards:
 * - % matches any sequence of characters
 * - _ matches any single character
 * - \ is used as an escape character
 *
 * Without escaping, user input like "100%" would match "1000", "100 apples", etc.
 *
 * @param input - The user input to escape
 * @returns The escaped string safe for use in LIKE patterns with ESCAPE '\\'
 *
 * @example
 * ```ts
 * const userInput = "50% off";
 * const escaped = escapeLikePattern(userInput);
 * // escaped = "50\% off"
 *
 * await pool.query(
 *   `SELECT * FROM products WHERE name ILIKE '%' || $1 || '%' ESCAPE '\\'`,
 *   [escaped]
 * );
 * ```
 */
export function escapeLikePattern(input: string): string {
  return input
    .replace(/\\/g, "\\\\") // Escape backslashes first
    .replace(/%/g, "\\%") // Escape percent signs
    .replace(/_/g, "\\_"); // Escape underscores
}

/**
 * Validate that a string is safe for use as a database identifier.
 *
 * Database identifiers (table names, column names, schema names) should be
 * alphanumeric with underscores only. This prevents SQL injection in cases
 * where parameterized queries cannot be used (e.g., dynamic table names).
 *
 * @param identifier - The identifier to validate
 * @returns true if the identifier is safe, false otherwise
 *
 * @example
 * ```ts
 * if (!isValidIdentifier(tableName)) {
 *   throw new Error("Invalid table name");
 * }
 * ```
 */
export function isValidIdentifier(identifier: string): boolean {
  // Only allow alphanumeric, underscores, and must start with letter/underscore
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier);
}

/**
 * Validate and sanitize a schema-qualified table name.
 *
 * @param schemaTable - The schema.table name to validate (e.g., "elongoat.content_cache")
 * @returns true if valid, false otherwise
 */
export function isValidSchemaTable(schemaTable: string): boolean {
  const parts = schemaTable.split(".");
  if (parts.length !== 2) return false;

  return parts.every((part) => isValidIdentifier(part));
}
