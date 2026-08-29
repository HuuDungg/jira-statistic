import React from 'react';
import { DollarSign, Clock, TrendingUp, FolderKanban, Award, Target, Flame } from 'lucide-react';

interface StatCardsProps {
  totalBillable: number;
  totalLogged: number;
  delta: number;
  efficiencyRate: number;
  taskCount: number;
  projectCount: number;
  latestCycle: string;
  selectedMonth?: string;
  monthlyQuota?: number;
  onOpenReport?: () => void;
}

export const StatCards: React.FC<StatCardsProps> = ({
  totalBillable,
  totalLogged,
  delta,
  efficiencyRate,
  taskCount,
  projectCount,
  latestCycle,
  selectedMonth,
  monthlyQuota = 80,
  onOpenReport
}) => {
  const isPositiveDelta = delta >= 0;
  const isMonthSelected = Boolean(selectedMonth && selectedMonth !== 'ALL');
  const kpiPercent = (isMonthSelected && monthlyQuota > 0)
    ? Math.round((totalBillable / monthlyQuota) * 1000) / 10
    : null;

  return (
    <div className="stats-row">
      {/* 1. Official Billable Hours */}
      <div className="stat-card" style={{ '--card-accent': 'var(--emerald-accent)' } as React.CSSProperties}>
        <div className="stat-card-label">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <DollarSign size={15} color="var(--emerald-accent)" strokeWidth={2.5} />
            <span>Tổng Billable Thực Nhận</span>
          </span>
          <span style={{ color: 'var(--emerald-accent)' }}>Official</span>
        </div>
        <div className="stat-card-value">
          <span className="stat-num">{(Math.round(totalBillable * 10) / 10).toLocaleString()}</span>
          <span className="stat-unit">giờ</span>
        </div>
        <div className="stat-card-meta" style={{ color: 'var(--emerald-text)' }}>
          <Award size={14} />
          <span>Trích xuất từ trường <code>Billable Hrs</code></span>
        </div>
      </div>

      {/* 2. Monthly KPI Target (When Month is filtered) OR Actual Logged Hours (When ALL) */}
      {isMonthSelected && kpiPercent !== null ? (
        <div
          className="stat-card stat-card-interactive"
          style={{ '--card-accent': kpiPercent >= 100 ? 'var(--emerald-accent)' : 'var(--blue-accent)' } as React.CSSProperties}
          onClick={onOpenReport}
          title="Nhấp để xem bảng báo cáo chi tiết KPI"
        >
          <div className="stat-card-label">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Target size={15} color={kpiPercent >= 100 ? 'var(--emerald-accent)' : 'var(--blue-accent)'} strokeWidth={2.5} />
              <span>Tiến Độ KPI Kỳ {selectedMonth}</span>
            </span>
            <span className={`kpi-chip ${kpiPercent >= 100 ? 'chip-success' : 'chip-info'}`}>
              {kpiPercent >= 100 ? 'Đạt KPI' : 'Đang thực hiện'}
            </span>
          </div>
          <div className="stat-card-value" style={{ color: kpiPercent >= 100 ? 'var(--emerald-text)' : 'var(--navy-primary)' }}>
            <span className="stat-num">{kpiPercent}%</span>
            <span className="stat-unit">
              ({Math.round(totalBillable * 10) / 10}/{monthlyQuota}h)
            </span>
          </div>
          <div className="stat-card-meta" style={{ color: 'var(--navy-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Flame size={13} color="var(--amber-accent)" />
            <span>Mục tiêu {monthlyQuota}h • Nhấp xem báo cáo</span>
          </div>
        </div>
      ) : (
        <div className="stat-card" style={{ '--card-accent': 'var(--navy-primary)' } as React.CSSProperties}>
          <div className="stat-card-label">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Clock size={15} color="var(--navy-primary)" strokeWidth={2.5} />
              <span>Tổng Giờ Thực Tế Đã Log</span>
            </span>
            <span>Actual</span>
          </div>
          <div className="stat-card-value">
            <span className="stat-num">{(Math.round(totalLogged * 10) / 10).toLocaleString()}</span>
            <span className="stat-unit">giờ</span>
          </div>
          <div className="stat-card-meta" style={{ color: 'var(--text-muted)' }}>
            <span>{taskCount} đầu việc có phát sinh giờ</span>
          </div>
        </div>
      )}

      {/* 3. Delta & Efficiency */}
      <div className="stat-card" style={{ '--card-accent': 'var(--amber-accent)' } as React.CSSProperties}>
        <div className="stat-card-label">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <TrendingUp size={15} color="var(--amber-accent)" strokeWidth={2.5} />
            <span>Chênh Lệch (Bill vs Log)</span>
          </span>
          <span>Delta</span>
        </div>
        <div className="stat-card-value" style={{ color: isPositiveDelta ? 'var(--emerald-text)' : 'var(--rose-accent)' }}>
          <span className="stat-num">{(isPositiveDelta ? '+' : '') + (Math.round(delta * 10) / 10).toLocaleString()}</span>
          <span className="stat-unit">giờ</span>
        </div>
        <div className="stat-card-meta" style={{ color: 'var(--amber-text)' }}>
          <span>Tỷ lệ thu hồi: <b>{efficiencyRate}%</b></span>
        </div>
      </div>

      {/* 4. Projects & Cycle */}
      <div className="stat-card" style={{ '--card-accent': 'var(--purple-accent)' } as React.CSSProperties}>
        <div className="stat-card-label">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <FolderKanban size={15} color="var(--purple-accent)" strokeWidth={2.5} />
            <span>Dự Án Tham Gia</span>
          </span>
          <span>Projects</span>
        </div>
        <div className="stat-card-value">
          <span className="stat-num">{projectCount}</span>
          <span className="stat-unit">dự án</span>
        </div>
        <div className="stat-card-meta" style={{ color: 'var(--purple-accent)' }}>
          <span>Kỳ gần nhất: <b>{latestCycle || 'N/A'}</b></span>
        </div>
      </div>
    </div>
  );
};
