/**
 * Date formatting utilities for standard MM/DD/YYYY representation across the portal.
 */

export function formatDate(val?: string | Date | number | null): string {
  if (!val) return '—';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '—';
    // If already in MM/DD/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return trimmed;
    }
    // If in YYYY-MM-DD or ISO format
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
    if (isoMatch) {
      const [, yyyy, mm, dd] = isoMatch;
      return `${mm}/${dd}/${yyyy}`;
    }
  }

  const d = typeof val === 'object' && val instanceof Date ? val : new Date(val as any);
  if (isNaN(d.getTime())) return String(val);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export function formatDateTime(val?: string | Date | number | null): string {
  if (!val) return '—';
  const d = typeof val === 'object' && val instanceof Date ? val : new Date(val as any);
  if (isNaN(d.getTime())) return String(val);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hh = String(hours).padStart(2, '0');
  return `${mm}/${dd}/${yyyy} ${hh}:${minutes} ${ampm}`;
}

/**
 * Converts a YYYY-MM-DD string to MM/DD/YYYY string.
 * If already MM/DD/YYYY or non-matching, returns it as-is.
 */
export function toMMDDYYYY(val: string): string {
  if (!val) return '';
  const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[2]}/${match[3]}/${match[1]}`;
  }
  return val;
}

/**
 * Converts MM/DD/YYYY to YYYY-MM-DD for storage/ISO compliance if needed.
 */
export function toYYYYMMDD(val: string): string {
  if (!val) return '';
  const match = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[1]}-${match[2]}`;
  }
  return val;
}
