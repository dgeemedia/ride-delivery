import React from 'react';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type SpinnerVariant = 'primary' | 'white' | 'gray';

interface SpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  label?: string;        // accessible label, also shown as text when `showLabel` is true
  showLabel?: boolean;   // render the label as visible text below the spinner
  className?: string;
  fullPage?: boolean;    // center spinner in the full viewport
}

const sizeClasses: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3 border-[1.5px]',
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
  xl: 'h-12 w-12 border-4',
};

const variantClasses: Record<SpinnerVariant, string> = {
  primary: 'border-primary-200 border-t-primary-600',
  white:   'border-white/30 border-t-white',
  gray:    'border-gray-200 border-t-gray-600',
};

const labelSizeClasses: Record<SpinnerSize, string> = {
  xs: 'text-xs',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-sm',
  xl: 'text-base',
};

const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  variant = 'primary',
  label = 'Loading…',
  showLabel = false,
  className = '',
  fullPage = false,
}) => {
  const spinner = (
    <div
      className={`
        inline-flex flex-col items-center justify-center gap-2
        ${fullPage ? 'fixed inset-0 z-50' : ''}
        ${className}
      `}
      role="status"
      aria-label={label}
    >
      <div
        className={`
          rounded-full animate-spin
          ${sizeClasses[size]}
          ${variantClasses[variant]}
        `}
      />
      {showLabel && (
        <p className={`text-gray-500 ${labelSizeClasses[size]}`}>{label}</p>
      )}
      {/* always keep an sr-only label for accessibility */}
      {!showLabel && <span className="sr-only">{label}</span>}
    </div>
  );

  return spinner;
};

export default Spinner;