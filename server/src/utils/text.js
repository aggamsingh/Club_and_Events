/** Escapes user input for safe use inside a RegExp (prevents regex injection / ReDoS). */
export function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function slugify(input) {
  return (
    input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_-]+/g, '-')
      .slice(0, 60) || 'event'
  );
}

/**
 * Quotes one CSV cell. Cells that begin with = + - @ (or tab/CR) are prefixed with a
 * single quote so spreadsheet apps don't execute them as formulas (CSV injection).
 */
export function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
