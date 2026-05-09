import { URDANETA_BARANGAYS } from '@/constants/index.js';

const COORDINATE_PARENS_PATTERN = /\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)/g;
const PINNED_COORDINATE_PATTERN = /^Pinned at\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/i;

export function normalizeIncidentLocationLabel(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const stripped = raw
    .replace(COORDINATE_PARENS_PATTERN, '')
    .replace(PINNED_COORDINATE_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!stripped) return '';

  const lower = stripped.toLowerCase();
  if (lower.includes('old city hall')) return 'Old City Hall (Poblacion)';
  if (lower.includes('new city hall')) return 'New City Hall (Anonas)';

  const directMatch = URDANETA_BARANGAYS.find((barangay) => barangay.toLowerCase() === lower);
  if (directMatch) return directMatch;

  const containsMatch = URDANETA_BARANGAYS.find((barangay) => lower.includes(barangay.toLowerCase()));
  if (containsMatch) return containsMatch;

  const withoutBarangayPrefix = stripped.replace(/^barangay\s+/i, '').trim();
  const prefixedMatch = URDANETA_BARANGAYS.find((barangay) => {
    const normalizedBarangay = barangay
      .replace(/^Old City Hall\s*\(Poblacion\)$/i, 'Poblacion')
      .replace(/^New City Hall\s*\(Anonas\)$/i, 'Anonas')
      .toLowerCase();
    return normalizedBarangay === withoutBarangayPrefix.toLowerCase();
  });

  return prefixedMatch ?? stripped;
}
