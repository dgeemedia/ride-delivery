// admin-web/src/components/common/index.ts
// Central barrel — import all shared UI components from here.

export { default as Card } from './Card';
export { default as Button } from './Button';
export { default as Badge } from './Badge';
export { default as Modal } from './Modal';
export { default as Input } from './Input';
export { default as Pagination } from './Pagination';

// Table sub-components
export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './Table';

export { default as Alert } from './Alert';
export { default as Select } from './Select';
export type { SelectOption } from './Select';
export { default as Spinner } from './Spinner';