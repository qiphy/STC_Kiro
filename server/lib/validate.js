// Small request-body validator. No library, no mutation of the input.

export const TASK_STATUSES = ['todo', 'in_progress', 'done', 'blocked'];
export const AUDIENCES = ['customers', 'technicians'];
export const ADVISORY_STATUSES = ['draft', 'published'];

const MAX_STRING_LENGTH = 1000;

/*
 * Schema format: { fieldName: rule }
 * rule = {
 *   type:     'string' | 'number' | 'boolean' | 'id'   (required)
 *   required: boolean                                  (default false)
 *   enum:     array of allowed values                  (optional)
 *   min, max: length limits for strings, measured after trimming (optional)
 * }
 * 'id' accepts a positive integer or a numeric string such as "12" (the
 * client sends ids taken from <select> values). Use toId() to convert.
 *
 * Returns the name of the first invalid field, or null when the body is valid.
 * Values are never coerced: "5" is not a number and 1 is not a string.
 */
export function validateBody(schema, body) {
  // A body that is not a plain object is treated as having no fields.
  const data = body !== null && typeof body === 'object' && !Array.isArray(body) ? body : {};

  for (const [field, rule] of Object.entries(schema || {})) {
    if (!isFieldValid(data[field], rule || {})) return field;
  }
  return null;
}

function isFieldValid(value, rule) {
  // Missing values: only a problem when the field is required.
  if (value === undefined || value === null) return !rule.required;

  if (!hasValidType(value, rule.type)) return false;

  if (rule.enum && !rule.enum.includes(value)) return false;

  if (rule.type === 'string') {
    if (value.length > MAX_STRING_LENGTH) return false;
    const length = value.trim().length;
    // A required string must contain something unless min says otherwise.
    const min = rule.min ?? (rule.required ? 1 : 0);
    if (length < min) return false;
    if (rule.max !== undefined && length > rule.max) return false;
  }
  return true;
}

function hasValidType(value, type) {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'id':
      return toId(value) !== null;
    default:
      return false; // unknown type in the schema: reject rather than guess
  }
}

// Converts a positive integer or a numeric string ("12") to a number.
// Returns null for anything else (null, 1.5, "abc", "1e3", "-4", "0").
export function toId(value) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string' && /^[0-9]{1,15}$/.test(value)) {
    const number = Number(value);
    return number > 0 ? number : null;
  }
  return null;
}
