import React from 'react';
import { BarChart3, CheckSquare, SearchCheck, RefreshCw, Key, Layers, Timer, Clock } from 'lucide-react';
import type { JiraUser } from '../types/jira';

interface NavbarProps {
  activeTab: 'analytics' | 'logtime' | 'tasks' | 'check';
  onTabChange: (tab: 'analytics' | 'logtime' | 'tasks' | 'check') => void;
  user: JiraUser | null;
  domain: string;
  workingTasksCount: number;
  isLoading: boolean;
  countdown: number;
  onOpenAuth: () => void;
  onSync: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  user,
  domain,
  workingTasksCount,
  isLoading,
  countdown,
  onOpenAuth,
  onSync
}) => {
  const cleanDomain = domain.replace(/^https?:\/\//, '');
  const avatarLetter = (user?.displayName || user?.name || 'U').charAt(0).toUpperCase();

  // Format countdown mm:ss
  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const formattedCountdown = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <nav className="navbar">
      <div className="nav-container">
        {/* Brand */}
        <a href="#" className="brand-logo" onClick={(e) => { e.preventDefault(); onTabChange('analytics'); }}>
          <div className="brand-icon">
            <Layers size={18} strokeWidth={2.5} />
          </div>
          <div className="brand-text">
            <h1>Jira Analytics Pro</h1>
            <span>Smart Billable & Task Hub</span>
          </div>
        </a>

        {/* Navigation Tabs */}
        <div className="nav-tabs">
          <button
            className={`nav-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => onTabChange('analytics')}
          >
            <BarChart3 size={16} strokeWidth={2.2} />
            <span>Phân Tích Billable</span>
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'logtime' ? 'active' : ''}`}
            onClick={() => onTabChange('logtime')}
          >
            <Clock size={16} strokeWidth={2.2} />
            <span>Lịch Sử Log Time</span>
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => onTabChange('tasks')}
          >
            <CheckSquare size={16} strokeWidth={2.2} />
            <span>Task Working</span>
            <span className="badge-count">{workingTasksCount}</span>
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'check' ? 'active' : ''}`}
            onClick={() => onTabChange('check')}
          >
            <SearchCheck size={16} strokeWidth={2.2} />
            <span>Kiểm Tra Task</span>
          </button>
        </div>

        {/* Right Actions */}
        <div className="nav-actions">
          {/* Sync Button with Countdown Timer */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={onSync}
            disabled={isLoading}
            title="Nhấn để đồng bộ dữ liệu ngay lập tức hoặc đợi tự động sau mỗi 5 phút"
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>{isLoading ? 'Đang đồng bộ...' : 'Đồng bộ'}</span>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.72rem',
              background: 'var(--navy-light)',
              color: 'var(--navy-primary)',
              padding: '0.1rem 0.35rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--navy-border)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem'
            }}>
              <Timer size={10} />
              {formattedCountdown}
            </span>
          </button>

          {/* User Profile / Auth Modal Trigger */}
          <div
            className="user-profile-btn"
            onClick={onOpenAuth}
            title="Nhấn để đổi tài khoản hoặc cập nhật Token"
          >
            <div className="user-avatar-sm">
              {avatarLetter}
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', lineHeight: '1.2' }}>
                {user?.displayName || (domain ? 'Đã lưu cấu hình' : 'Chưa đăng nhập')}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                {cleanDomain || 'Nhập Domain & Token'}
              </div>
            </div>
            <Key size={13} style={{ color: 'var(--text-muted)', marginLeft: '0.25rem' }} />
          </div>
        </div>
      </div>
    </nav>
  );
};
