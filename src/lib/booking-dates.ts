/**
 * Strict date utilities for booking flow in Asia/Kolkata timezone.
 * Display format: DD/MM/YYYY
 * Storage / Wire format: YYYY-MM-DD
 */

export function formatDateDDMMYYYY(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateYYYYMMDD(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
}

/**
 * Parses DD/MM/YYYY strictly into a valid Date object or null if invalid.
 */
export function parseDateDDMMYYYY(val: string): Date | null {
  if (!val || typeof val !== "string") return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(val.trim());
  if (!match) return null;

  const day = Number.parseInt(match[1] ?? "", 10);
  const month = Number.parseInt(match[2] ?? "", 10);
  const year = Number.parseInt(match[3] ?? "", 10);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 2024 || year > 2100) return null;

  // Verify days in month (handling leap years)
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return null;

  const date = new Date(year, month - 1, day);
  return date;
}

/**
 * Converts a YYYY-MM-DD string to DD/MM/YYYY for presentation.
 */
export function isoToDisplayDate(iso: string): string {
  if (!iso) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return iso;
  const year = match[1];
  const month = match[2];
  const day = match[3];
  return `${day}/${month}/${year}`;
}

/**
 * Converts a DD/MM/YYYY string to YYYY-MM-DD for API submission.
 */
export function displayToIsoDate(display: string): string | null {
  const parsed = parseDateDDMMYYYY(display);
  if (!parsed) return null;
  return formatDateYYYYMMDD(parsed);
}

/**
 * Computes calendar nights between two YYYY-MM-DD strings.
 */
export function calculateStayNights(checkInIso: string, checkOutIso: string): number {
  if (!checkInIso || !checkOutIso) return 0;
  if (checkInIso === checkOutIso) return 0; // Day visit (picnic)
  const d1 = new Date(checkInIso + "T00:00:00Z");
  const d2 = new Date(checkOutIso + "T00:00:00Z");
  const diffMs = d2.getTime() - d1.getTime();
  if (diffMs <= 0) return 0;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Today in Asia/Kolkata as a Date object set to 00:00:00 local.
 */
export function getKolkataToday(): Date {
  const now = new Date();
  // Format in Asia/Kolkata
  const kolkataStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
  const parts = kolkataStr.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  return new Date(year, month, day);
}
