import React, { useState, useMemo } from 'react';
import {
  X,
  Award,
  Target,
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Copy,
  Check,
  ExternalLink,
  Folder,
  BarChart2
} from 'lucide-react';
import type { BillableItem } from '../types/jira';
import { copyTableToClipboard } from '../utils/clipboard';

interface MonthlyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: string;
  quota: number;
  onUpdateQuota: (newQuota: number) => void;
  items: BillableItem[];
  userName?: string;
  domain: string;
}

export const MonthlyReportModal: React.FC<MonthlyReportModalProps> = ({
  isOpen,
  onClose,
  selectedMonth,
  quota,
  onUpdateQuota,
  items,
  userName,
  domain
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedProjects, setCopiedProjects] = useState<boolean>(false);
  const [copiedTasks, setCopiedTasks] = useState<boolean>(false);
  const [tempQuota, setTempQuota] = useState<string>(quota.toString());

  // Keep tempQuota in sync when modal opens or quota changes
  React.useEffect(() => {
    setTempQuota(quota.toString());
  }, [quota, isOpen]);

  // Metrics calculations
  const totalBillable = useMemo(() => {
    return Math.round(items.reduce((acc, i) => acc + (i.billableHrs || 0), 0) * 10) / 10;
  }, [items]);

  const totalLogged = useMemo(() => {
    return Math.round(items.reduce((acc, i) => acc + (i.loggedHours || 0), 0) * 10) / 10;
  }, [items]);

  const kpiPercent = useMemo(() => {
    if (!quota || quota <= 0) return 0;
    return Math.round((totalBillable / quota) * 1000) / 10; // e.g. 105.5%
  }, [totalBillable, quota]);

  const deltaQuota = useMemo(() => {
    return Math.round((totalBillable - quota) * 10) / 10;
  }, [totalBillable, quota]);

  const efficiencyRate = useMemo(() => {
    return totalLogged > 0 ? Math.round((totalBillable / totalLogged) * 100) : 100;
  }, [totalBillable, totalLogged]);

  // Project Breakdown
  const projectBreakdown = useMemo(() => {
    const map: Record<string, { name: string; key: string; billable: number; logged: number; count: number }> = {};
    items.forEach(i => {
      if (!map[i.projectName]) {
        map[i.projectName] = { name: i.projectName, key: i.projectKey, billable: 0, logged: 0, count: 0 };
      }
      map[i.projectName].billable += i.billableHrs || 0;
      map[i.projectName].logged += i.loggedHours || 0;
      map[i.projectName].count++;
    });

    return Object.values(map)
      .map(p => ({
        ...p,
        billable: Math.round(p.billable * 10) / 10,
        logged: Math.round(p.logged * 10) / 10,
        kpiShare: quota > 0 ? Math.round((p.billable / quota) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.billable - a.billable);
  }, [items, quota]);

  if (!isOpen) return null;

  // KPI Status calculation
  const getKpiStatus = () => {
    if (kpiPercent >= 100) {
      return {
        label: 'Đạt / Vượt KPI',
        icon: Flame,
        color: 'var(--emerald-accent)',
        bg: 'var(--emerald-pastel)',
        textColor: 'var(--emerald-text)',
        desc: deltaQuota >= 0 ? `Vượt mục tiêu +${deltaQuota}h billable` : 'Đạt 100% mục tiêu'
      };
    }
    if (kpiPercent >= 80) {
      return {
        label: 'Tiến độ tốt (≥80%)',
        icon: CheckCircle2,
        color: 'var(--amber-accent)',
        bg: 'var(--amber-pastel)',
        textColor: 'var(--amber-text)',
        desc: `Còn thiếu ${Math.abs(deltaQuota)}h để đạt 100%`
      };
    }
    return {
      label: 'Cần nỗ lực (<80%)',
      icon: AlertTriangle,
      color: 'var(--rose-accent)',
      bg: 'var(--rose-pastel)',
      textColor: 'var(--rose-accent)',
      desc: `Còn thiếu ${Math.abs(deltaQuota)}h để đạt chỉ tiêu`
    };
  };

  const kpiStatus = getKpiStatus();
  const StatusIcon = kpiStatus.icon;

  const handleQuotaChange = (val: string) => {
    setTempQuota(val);
    if (val.trim() === '') {
      onUpdateQuota(0);
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      onUpdateQuota(num);
    }
  };

  const handleQuotaBlur = () => {
    if (tempQuota.trim() === '' || isNaN(parseFloat(tempQuota))) {
      setTempQuota('0');
      onUpdateQuota(0);
    } else {
      const formatted = parseFloat(tempQuota).toString();
      setTempQuota(formatted);
      onUpdateQuota(parseFloat(tempQuota));
    }
  };

  // Copy Project Breakdown Table (Rich HTML Table for Teams/Jira)
  const handleCopyProjectsTable = async () => {
    if (projectBreakdown.length === 0) return;

    const columns = [
      { title: 'Dự Án', align: 'left' as const },
      { title: 'Số Task', align: 'center' as const },
      { title: 'Billable', align: 'right' as const },
      { title: 'Logged', align: 'right' as const },
      { title: '% KPI Tháng', align: 'right' as const }
    ];

    const rows = projectBreakdown.map(p => [
      p.name,
      p.count,
      `${p.billable}h`,
      `${p.logged}h`,
      `${p.kpiShare}%`
    ]);

    const success = await copyTableToClipboard(columns, rows, `Đóng góp dự án kỳ ${selectedMonth} - Tổng billable: ${totalBillable}h`);
    if (success) {
      setCopiedProjects(true);
      setTimeout(() => setCopiedProjects(false), 2000);
    }
  };

  // Copy Task List Table (Rich HTML Table for Teams/Jira)
  const handleCopyTasksTable = async () => {
    if (items.length === 0) return;

    const columns = [
      { title: 'Ticket', align: 'left' as const },
      { title: 'Tên Công Việc / Task', align: 'left' as const },
      { title: 'Billable', align: 'right' as const },
      { title: 'Trạng Thái', align: 'center' as const }
    ];

    const rows = items.map(i => [
      i.key,
      i.summary,
      `${i.billableHrs}h`,
      i.status
    ]);

    const success = await copyTableToClipboard(columns, rows, `Danh sách đầu việc billed kỳ ${selectedMonth} (${items.length} tasks)`);
    if (success) {
      setCopiedTasks(true);
      setTimeout(() => setCopiedTasks(false), 2000);
    }
  };

  // Copy Summary text for messaging / reporting (Clean text without emojis)
  const handleCopySummary = () => {
    const summaryText = `[BÁO CÁO HIỆU SUẤT & KPI KỲ ${selectedMonth}]
- Nhân sự: ${userName || 'Thành viên'}
- Định mức mục tiêu: ${quota}h Billable (100% KPI)
- Thực tế đạt được: ${totalBillable}h Billable
- Tỷ lệ hoàn thành KPI: ${kpiPercent}% (${deltaQuota >= 0 ? '+' : ''}${deltaQuota}h)
- Tổng giờ Logged thực tế: ${totalLogged}h (Tỷ lệ thu hồi: ${efficiencyRate}%)
- Số dự án đóng góp: ${projectBreakdown.length} dự án (${items.length} đầu việc)

[Đóng góp theo từng dự án]
${projectBreakdown.map(p => `- ${p.name}: ${p.billable}h bill (${p.kpiShare}% KPI) - ${p.count} tasks`).join('\n')}
`;
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box report-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <Award size={20} color="var(--navy-primary)" />
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
                Báo Cáo KPI Tháng {selectedMonth === 'ALL' ? 'Tất cả kỳ' : selectedMonth}
              </div>
              {userName && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Nhân sự: <strong style={{ color: 'var(--navy-primary)' }}>{userName}</strong>
                </div>
              )}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} title="Đóng">
            <X size={16} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="report-modal-body">
          {/* Main KPI Achievement Card */}
          <div className="kpi-banner-card" style={{ borderLeft: `4px solid ${kpiStatus.color}` }}>
            <div className="kpi-banner-header">
              <div>
                <div className="kpi-banner-subtitle">Tỷ Lệ Hoàn Thành KPI</div>
                <div className="kpi-banner-main-val" style={{ color: kpiStatus.color }}>
                  {kpiPercent}%
                  <span className="kpi-banner-status-badge" style={{ background: kpiStatus.bg, color: kpiStatus.textColor }}>
                    <StatusIcon size={13} />
                    <span>{kpiStatus.label}</span>
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Mục tiêu tháng</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    step="1"
                    className="quota-inline-input"
                    value={tempQuota}
                    onChange={(e) => handleQuotaChange(e.target.value)}
                    onBlur={handleQuotaBlur}
                    title="Nhấp để sửa định mức tháng"
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy-dark)' }}>giờ</span>
                </div>
              </div>
            </div>

            {/* Visual KPI Progress Bar */}
            <div className="kpi-progress-wrap">
              <div className="kpi-progress-track">
                <div
                  className="kpi-progress-fill"
                  style={{
                    width: `${Math.min(kpiPercent, 100)}%`,
                    background: kpiStatus.color
                  }}
                />
              </div>
              <div className="kpi-progress-meta">
                <span>0h (0%)</span>
                <span>{kpiStatus.desc}</span>
                <span>{quota}h (100%)</span>
              </div>
            </div>
          </div>

          {/* 4 Summary Mini Cards */}
          <div className="report-metric-grid">
            <div className="report-metric-item">
              <div className="report-metric-label">
                <Target size={13} color="var(--navy-primary)" />
                <span>Định mức</span>
              </div>
              <div className="report-metric-val">{quota}h</div>
              <div className="report-metric-sub">100% KPI chuẩn</div>
            </div>

            <div className="report-metric-item">
              <div className="report-metric-label">
                <Award size={13} color="var(--emerald-accent)" />
                <span>Thực nhận</span>
              </div>
              <div className="report-metric-val" style={{ color: 'var(--emerald-text)' }}>
                {totalBillable}h
              </div>
              <div className="report-metric-sub">Tổng Billable thực</div>
            </div>

            <div className="report-metric-item">
              <div className="report-metric-label">
                <TrendingUp size={13} color={deltaQuota >= 0 ? 'var(--emerald-accent)' : 'var(--rose-accent)'} />
                <span>Chênh lệch</span>
              </div>
              <div
                className="report-metric-val"
                style={{ color: deltaQuota >= 0 ? 'var(--emerald-text)' : 'var(--rose-accent)' }}
              >
                {deltaQuota >= 0 ? `+${deltaQuota}h` : `${deltaQuota}h`}
              </div>
              <div className="report-metric-sub">{deltaQuota >= 0 ? 'Vượt chỉ tiêu' : 'Còn thiếu'}</div>
            </div>

            <div className="report-metric-item">
              <div className="report-metric-label">
                <Clock size={13} color="var(--purple-accent)" />
                <span>Hiệu suất</span>
              </div>
              <div className="report-metric-val" style={{ color: 'var(--purple-accent)' }}>
                {efficiencyRate}%
              </div>
              <div className="report-metric-sub">Log {totalLogged}h thực tế</div>
            </div>
          </div>

          {/* Project Contribution Breakdown Table */}
          <div className="report-section">
            <div className="report-section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.88rem', color: 'var(--navy-dark)' }}>
                <Folder size={15} color="var(--navy-primary)" />
                <span>Đóng Góp Theo Dự Án ({projectBreakdown.length})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={handleCopyProjectsTable}
                  title="Sao chép bảng dự án vào Clipboard"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}
                >
                  {copiedProjects ? <Check size={11} color="var(--emerald-accent)" /> : <Copy size={11} />}
                  <span>{copiedProjects ? 'Đã Copy!' : 'Copy Bảng'}</span>
                </button>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {items.length} tasks
                </span>
              </div>
            </div>

            <div className="table-responsive" style={{ maxHeight: '220px', overflowY: 'auto' }}>
              <table className="data-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Dự Án</th>
                    <th style={{ textAlign: 'center' }}>Số Task</th>
                    <th style={{ textAlign: 'right' }}>Billable</th>
                    <th style={{ textAlign: 'right' }}>Logged</th>
                    <th style={{ textAlign: 'right' }}>% KPI Tháng</th>
                  </tr>
                </thead>
                <tbody>
                  {projectBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        Không có dữ liệu trong kỳ này.
                      </td>
                    </tr>
                  ) : (
                    projectBreakdown.map((p) => (
                      <tr key={p.key}>
                        <td style={{ fontWeight: 600, color: 'var(--navy-dark)' }}>{p.name}</td>
                        <td style={{ textAlign: 'center' }}>{p.count}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--emerald-text)' }}>
                          {p.billable}h
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                          {p.logged}h
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: p.kpiShare >= 50 ? 'var(--emerald-text)' : 'var(--navy-primary)'
                            }}
                          >
                            {p.kpiShare}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* List of Tasks in Month */}
          <div className="report-section">
            <div className="report-section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.88rem', color: 'var(--navy-dark)' }}>
                <BarChart2 size={15} color="var(--navy-primary)" />
                <span>Danh Sách Đầu Việc Billed ({items.length})</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={handleCopyTasksTable}
                title="Sao chép danh sách công việc vào Clipboard"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}
              >
                {copiedTasks ? <Check size={11} color="var(--emerald-accent)" /> : <Copy size={11} />}
                <span>{copiedTasks ? 'Đã Copy!' : 'Copy Bảng'}</span>
              </button>
            </div>

            <div className="table-responsive" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              <table className="data-table" style={{ fontSize: '0.78rem' }}>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Tên Task</th>
                    <th style={{ textAlign: 'right' }}>Billable</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        Chưa có đầu việc nào được ghi nhận billable.
                      </td>
                    </tr>
                  ) : (
                    items.map(item => (
                      <tr key={item.key}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <a
                            href={`${domain}/browse/${item.key}`}
                            target="_blank"
                            rel="noreferrer"
                            className="badge-ticket"
                            style={{ fontSize: '0.72rem', padding: '0.15rem 0.4rem' }}
                          >
                            <span>{item.key}</span>
                            <ExternalLink size={10} opacity={0.7} />
                          </a>
                        </td>
                        <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.summary}>
                          {item.summary}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--emerald-text)' }}>
                          {item.billableHrs}h
                        </td>
                        <td>
                          <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleCopySummary}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            {copied ? <Check size={14} color="var(--emerald-accent)" /> : <Copy size={14} />}
            <span>{copied ? 'Đã Sao Chép Báo Cáo!' : 'Sao Chép Báo Cáo'}</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onClose}
          >
            Đóng Báo Cáo
          </button>
        </div>
      </div>
    </div>
  );
};
