import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const variantConfig: Record<
  AlertVariant,
  { container: string; icon: string; Icon: React.FC<{ className?: string }> }
> = {
  info: {
    container: 'bg-blue-50 border-blue-200 text-blue-800',
    icon: 'text-blue-500',
    Icon: Info,
  },
  success: {
    container: 'bg-green-50 border-green-200 text-green-800',
    icon: 'text-green-500',
    Icon: CheckCircle2,
  },
  warning: {
    container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    icon: 'text-yellow-500',
    Icon: AlertTriangle,
  },
  error: {
    container: 'bg-red-50 border-red-200 text-red-800',
    icon: 'text-red-500',
    Icon: AlertCircle,
  },
};

const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  dismissible = false,
  onDismiss,
  className = '',
}) => {
  const { container, icon, Icon } = variantConfig[variant];

  return (
    <div
      role="alert"
      className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${container} ${className}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${icon}`} />

      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div className="leading-relaxed">{children}</div>
      </div>

      {dismissible && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 ml-auto -mr-1 -mt-0.5 p-1 rounded-md opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default Alert;