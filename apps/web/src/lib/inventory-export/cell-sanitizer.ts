export function sanitizeSpreadsheetCell(value: unknown) {
  const text = String(value ?? "");

  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}
