import React from 'react';

// ── Table ──────────────────────────────────────────────────────────────────
interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export const Table: React.FC<TableProps> = ({ children, className = '' }) => (
  <div className="overflow-x-auto">
    <table className={`w-full text-sm text-left ${className}`}>
      {children}
    </table>
  </div>
);

// ── TableHeader ────────────────────────────────────────────────────────────
export const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead className="bg-gray-50 border-b border-gray-100">
    {children}
  </thead>
);

// ── TableBody ──────────────────────────────────────────────────────────────
export const TableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tbody className="divide-y divide-gray-50">
    {children}
  </tbody>
);

// ── TableRow ───────────────────────────────────────────────────────────────
interface TableRowProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const TableRow: React.FC<TableRowProps> = ({ children, onClick, className = '' }) => (
  <tr
    onClick={onClick}
    className={`
      hover:bg-gray-50 transition-colors duration-100
      ${onClick ? 'cursor-pointer' : ''}
      ${className}
    `}
  >
    {children}
  </tr>
);

// ── TableHead ──────────────────────────────────────────────────────────────
interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
}

export const TableHead: React.FC<TableHeadProps> = ({ children, className = '' }) => (
  <th className={`px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${className}`}>
    {children}
  </th>
);

// ── TableCell ──────────────────────────────────────────────────────────────
interface TableCellProps {
  children: React.ReactNode;
  className?: string;
}

export const TableCell: React.FC<TableCellProps> = ({ children, className = '' }) => (
  <td className={`px-6 py-4 text-gray-700 ${className}`}>
    {children}
  </td>
);