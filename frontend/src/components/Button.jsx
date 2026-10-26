import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Reusable Legal CaseBook Button Component
 * Aligned with the shared design system:
 * - Primary Navy: #172B4D
 * - Muted Gold Accent: #B99A5B
 * - White: #FFFFFF
 * - Page Background: #F7F8FA
 * - Border: #E5E9F0
 *
 * Variants: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost'
 * Sizes: 'sm' | 'md' | 'lg'
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  loadingText,
  disabled = false,
  className = '',
  type = 'button',
  onClick,
  title,
  ...props
}) {
  const variantClass = `btn-${variant}`;
  const sizeClass = `btn-${size}`;
  const loadingClass = loading ? 'btn-loading' : '';

  return (
    <button
      type={type}
      className={`btn ${variantClass} ${sizeClass} ${loadingClass} ${className}`.trim()}
      disabled={disabled || loading}
      onClick={onClick}
      title={title}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="btn-spinner" size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />
          <span>{loadingText || children}</span>
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon className="btn-icon-svg" size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />}
          <span>{children}</span>
          {Icon && iconPosition === 'right' && <Icon className="btn-icon-svg" size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />}
        </>
      )}
    </button>
  );
}
