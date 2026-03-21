// admin-web/src/utils/exportToExcel.ts
//
// Client-side Excel export using SheetJS (the 'xlsx' package).
// Install if not already present:  pnpm add xlsx
//
// Usage:
//   exportToExcel(rows, columns, 'drivers-export')
//
// columns is an array of { header, key, width? } objects.

import * as XLSX from 'xlsx';

export interface ExcelColumn<T = any> {
  /** Column header label shown in row 1 */
  header: string;
  /** Key to pull from each row object (supports dot-notation e.g. 'user.email') */
  key: string;
  /** Optional column width in characters */
  width?: number;
  /** Optional value formatter */
  format?: (value: any, row: T) => string | number;
}

/** Safely read a nested key like 'user.email' from an object */
const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((acc, part) => (acc != null ? acc[part] : ''), obj);
};

/**
 * Export an array of objects to a formatted .xlsx file and trigger a download.
 *
 * @param data     Array of row objects
 * @param columns  Column definitions
 * @param filename Filename without extension (e.g. 'drivers-2026-03-21')
 * @param sheetName Optional worksheet name (default: 'Sheet1')
 */
export const exportToExcel = <T = any>(
  data: T[],
  columns: ExcelColumn<T>[],
  filename: string,
  sheetName = 'Sheet1',
): void => {
  // ── Build rows ──────────────────────────────────────────────────────────────
  const headerRow = columns.map(c => c.header);

  const dataRows = data.map(row =>
    columns.map(col => {
      const raw = getNestedValue(row, col.key);
      if (col.format) return col.format(raw, row);
      if (raw == null) return '';
      return raw;
    })
  );

  const worksheetData = [headerRow, ...dataRows];

  // ── Create workbook ─────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // ── Column widths ───────────────────────────────────────────────────────────
  ws['!cols'] = columns.map(col => ({
    wch: col.width ?? Math.max(col.header.length + 2, 14),
  }));

  // ── Header row styling — bold + light blue background ──────────────────────
  // SheetJS CE supports basic cell styles via the xlsx-style fork, but the
  // standard 'xlsx' package supports styles in the Pro version only.
  // We use a workaround: write the header row as a separate styled pass
  // if the user has xlsx-style, otherwise skip silently.
  try {
    const headerStyle = {
      font:    { bold: true, color: { rgb: 'FFFFFF' } },
      fill:    { fgColor: { rgb: '2563EB' } },   // primary-600
      alignment: { horizontal: 'center' },
    };
    columns.forEach((_, colIdx) => {
      const cellAddr = XLSX.utils.encode_cell({ r: 0, c: colIdx });
      if (ws[cellAddr]) {
        ws[cellAddr].s = headerStyle;
      }
    });
  } catch {
    // styling not supported in current xlsx version — skip silently
  }

  // ── Freeze header row ───────────────────────────────────────────────────────
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // ── Trigger download ────────────────────────────────────────────────────────
  const safeFilename = `${filename.replace(/[^a-z0-9_-]/gi, '-')}.xlsx`;
  XLSX.writeFile(wb, safeFilename);
};

// ── Pre-built column sets ────────────────────────────────────────────────────

/** Columns for the drivers export */
export const DRIVER_EXPORT_COLUMNS: ExcelColumn[] = [
  { header: 'First Name',        key: 'user.firstName',  width: 16 },
  { header: 'Last Name',         key: 'user.lastName',   width: 16 },
  { header: 'Email',             key: 'user.email',      width: 28 },
  { header: 'Phone',             key: 'user.phone',      width: 16 },
  { header: 'Vehicle Type',      key: 'vehicleType',     width: 14 },
  { header: 'Make',              key: 'vehicleMake',     width: 14 },
  { header: 'Model',             key: 'vehicleModel',    width: 14 },
  { header: 'Year',              key: 'vehicleYear',     width: 8  },
  { header: 'Color',             key: 'vehicleColor',    width: 12 },
  { header: 'Plate',             key: 'vehiclePlate',    width: 14 },
  { header: 'License No.',       key: 'licenseNumber',   width: 18 },
  { header: 'Rating',            key: 'rating',          width: 10,
    format: v => (typeof v === 'number' ? v.toFixed(2) : v ?? '') },
  { header: 'Total Rides',       key: 'totalRides',      width: 12 },
  { header: 'Approved',          key: 'isApproved',      width: 10,
    format: v => (v ? 'Yes' : 'No') },
  { header: 'Online',            key: 'isOnline',        width: 10,
    format: v => (v ? 'Yes' : 'No') },
  { header: 'Account Active',    key: 'user.isActive',   width: 14,
    format: v => (v ? 'Yes' : 'No') },
  { header: 'Suspended',         key: 'user.isSuspended', width: 12,
    format: v => (v ? 'Yes' : 'No') },
  { header: 'Joined',            key: 'createdAt',       width: 20,
    format: v => (v ? new Date(v).toLocaleDateString('en-GB') : '') },
];

/** Columns for the delivery partners export */
export const PARTNER_EXPORT_COLUMNS: ExcelColumn[] = [
  { header: 'First Name',        key: 'user.firstName',  width: 16 },
  { header: 'Last Name',         key: 'user.lastName',   width: 16 },
  { header: 'Email',             key: 'user.email',      width: 28 },
  { header: 'Phone',             key: 'user.phone',      width: 16 },
  { header: 'Vehicle Type',      key: 'vehicleType',     width: 14 },
  { header: 'Plate',             key: 'vehiclePlate',    width: 14 },
  { header: 'Rating',            key: 'rating',          width: 10,
    format: v => (typeof v === 'number' ? v.toFixed(2) : v ?? '') },
  { header: 'Total Deliveries',  key: 'totalDeliveries', width: 16 },
  { header: 'Approved',          key: 'isApproved',      width: 10,
    format: v => (v ? 'Yes' : 'No') },
  { header: 'Online',            key: 'isOnline',        width: 10,
    format: v => (v ? 'Yes' : 'No') },
  { header: 'Account Active',    key: 'user.isActive',   width: 14,
    format: v => (v ? 'Yes' : 'No') },
  { header: 'Suspended',         key: 'user.isSuspended', width: 12,
    format: v => (v ? 'Yes' : 'No') },
  { header: 'Joined',            key: 'createdAt',       width: 20,
    format: v => (v ? new Date(v).toLocaleDateString('en-GB') : '') },
];