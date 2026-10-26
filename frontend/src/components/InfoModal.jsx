import React, { useEffect } from 'react';
import { X, Info, ShieldAlert, KeyRound, UserPlus } from 'lucide-react';

/**
 * InfoModal Component
 * -------------------
 * An accessible modal dialog used to inform the user about features
 * scheduled for future stages (e.g., password reset, registration, privacy policy).
 */
export default function InfoModal({ isOpen, onClose, title, message, type = 'info' }) {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const renderIcon = () => {
    switch (type) {
      case 'password':
        return <KeyRound className="modal-icon-badge gold" size={28} />;
      case 'register':
        return <UserPlus className="modal-icon-badge navy" size={28} />;
      case 'security':
        return <ShieldAlert className="modal-icon-badge gold" size={28} />;
      default:
        return <Info className="modal-icon-badge navy" size={28} />;
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()} // Prevent click through to backdrop
      >
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>

        <div className="modal-header">
          {renderIcon()}
          <h3 id="modal-title" className="modal-title">{title}</h3>
        </div>

        <div className="modal-body">
          <p>{message}</p>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn-modal-primary"
            onClick={onClose}
            autoFocus
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}
