// admin-web/src/components/common/CurrencyTabs.tsx
//
// Totals in different currencies can't be added together, so pages that show
// aggregate money render one set of figures per currency and let the admin
// switch between them with these pills. Renders nothing for a single currency.
import React from 'react';

interface Props {
  currencies: string[];
  value:      string;
  onChange:   (currency: string) => void;
  label?:     string;
}

const CurrencyTabs: React.FC<Props> = ({ currencies, value, onChange, label = 'Currency' }) => {
  if (currencies.length < 2) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500 font-medium">{label}:</span>
      {currencies.map(c => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
            value === c ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
};

export default CurrencyTabs;
