import React, { useState, useEffect } from 'react';
import { Key, Globe, X, ArrowRight, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: string;
  token: string;
  onSubmit: (domain: string, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  domain,
  token,
  onSubmit
}) => {
  const [inputDomain, setInputDomain] = useState(domain || '');
  const [inputToken, setInputToken] = useState(token || '');

  useEffect(() => {
    setInputDomain(domain || '');
    setInputToken(token || '');
  }, [domain, token]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputDomain.trim()) {
      alert('Vui lòng nhập Jira Domain URL!');
      return;
    }
    if (!inputToken.trim()) {
      alert('Vui lòng nhập Personal Access Token!');
      return;
    }
    onSubmit(inputDomain.trim(), inputToken.trim());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <ShieldCheck size={20} color="var(--navy-primary)" />
            <span>Cấu Hình Tài Khoản Jira</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Globe size={14} color="var(--text-muted)" />
              <span>Jira Domain URL</span>
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="https://jira.yourcompany.com"
              value={inputDomain}
              onChange={(e) => setInputDomain(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Key size={14} color="var(--text-muted)" />
              <span>Personal Access Token (PAT / API Key)</span>
            </label>
            <input
              type="password"
              className="form-control"
              placeholder="Nhập mã token cá nhân Jira của bạn..."
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              required
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
              Nhập domain và token của bạn để kéo toàn bộ thông tin cá nhân, Billable Hours và task working. Token được lưu cục bộ 100% trong trình duyệt (localStorage).
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary">
              <span>Đăng Nhập & Kéo Dữ Liệu</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
