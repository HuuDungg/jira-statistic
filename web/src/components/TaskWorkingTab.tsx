import React, { useState, useMemo } from 'react';
import {
  Search,
  Folder,
  Clock,
  Zap,
  ExternalLink,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Scale,
  Award,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import type { WorkingTask } from '../types/jira';
import { copyTableToClipboard } from '../utils/clipboard';

interface TaskWorkingTabProps {
  tasks: WorkingTask[];
  domain: string;
  isLoading?: boolean;
}

export const TaskWorkingTab: React.FC<TaskWorkingTabProps> = ({ tasks, domain, isLoading }) => {
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedProfitFilter, setSelectedProfitFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedTasks, setCopiedTasks] = useState<boolean>(false);

  // Hooks ALWAYS declared at the top
  const projects = useMemo(() => {
    return [...new Set(tasks.map(t => t.projectName))].sort();
  }, [tasks]);

  const statuses = useMemo(() => {
    return [...new Set(tasks.map(t => t.status))].sort();
  }, [tasks]);

  const priorities = useMemo(() => {
    return [...new Set(tasks.map(t => t.priority))].sort();
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return tasks.filter(task => {
      const billable = task.billableHrs ?? 0;
      const logged = task.loggedHours ?? 0;
      const delta = billable - logged;

      const matchProject = selectedProject === 'ALL' || task.projectName === selectedProject;
      const matchStatus = selectedStatus === 'ALL' || task.status.toLowerCase() === selectedStatus.toLowerCase();
      const matchPriority = selectedPriority === 'ALL' || task.priority.toLowerCase() === selectedPriority.toLowerCase();

      // Profit / Loss Filter
      let matchProfit = true;
      if (selectedProfitFilter === 'PROFIT') {
        matchProfit = billable > 0 && delta > 0;
      } else if (selectedProfitFilter === 'LOSS') {
        matchProfit = logged > 0 && delta < 0;
      } else if (selectedProfitFilter === 'BREAKEVEN') {
        matchProfit = billable > 0 && delta === 0;
      } else if (selectedProfitFilter === 'HAS_BILLABLE') {
        matchProfit = billable > 0;
      } else if (selectedProfitFilter === 'NO_BILLABLE') {
        matchProfit = billable === 0;
      }

      const matchSearch = !query ||
        task.key.toLowerCase().includes(query) ||
        task.summary.toLowerCase().includes(query) ||
        task.projectName.toLowerCase().includes(query);

      return matchProject && matchStatus && matchPriority && matchProfit && matchSearch;
    });
  }, [tasks, selectedProject, selectedStatus, selectedPriority, selectedProfitFilter, searchQuery]);

  // Overall Financial / Efficiency Summary on Active Working Tasks
  const summary = useMemo(() => {
    let totalBillable = 0;
    let totalLogged = 0;
    let billableTaskCount = 0;

    filteredTasks.forEach(t => {
      if (t.billableHrs != null && t.billableHrs > 0) {
        totalBillable += t.billableHrs;
        billableTaskCount++;
      }
      if (t.loggedHours != null && t.loggedHours > 0) {
        totalLogged += t.loggedHours;
      }
    });

    const delta = totalBillable - totalLogged;
    const isProfit = delta >= 0;
    const profitRate = totalLogged > 0
      ? Math.round(((totalBillable - totalLogged) / totalLogged) * 1000) / 10
      : (totalBillable > 0 ? 100 : 0);

    return {
      totalBillable: Math.round(totalBillable * 10) / 10,
      totalLogged: Math.round(totalLogged * 10) / 10,
      delta: Math.round(delta * 10) / 10,
      isProfit,
      profitRate,
      billableTaskCount
    };
  }, [filteredTasks]);

  const getStatusClass = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('progress')) return 'status-in-progress';
    if (s.includes('done') || s.includes('closed')) return 'status-done';
    if (s.includes('resolve')) return 'status-resolved';
    if (s.includes('review')) return 'status-review';
    if (s.includes('reopen')) return 'status-reopened';
    return 'status-open';
  };

  const getPriorityClass = (prio: string) => {
    const p = prio.toLowerCase();
    if (p.includes('high') || p.includes('highest') || p.includes('blocker')) return 'prio-high';
    if (p.includes('low') || p.includes('lowest')) return 'prio-low';
    return 'prio-medium';
  };

  // If loading and no tasks yet, render Skeleton screen (AFTER all hooks)
  if (isLoading && tasks.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="skeleton" style={{ width: '320px', height: '28px', marginBottom: '8px' }} />
            <div className="skeleton" style={{ width: '460px', height: '14px' }} />
          </div>
        </div>

        {/* 3 KPI cards skeleton */}
        <div className="stats-row" style={{ marginBottom: '1.5rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="stat-card">
              <div className="skeleton" style={{ width: '140px', height: '12px', marginBottom: '12px' }} />
              <div className="skeleton" style={{ width: '160px', height: '36px', marginBottom: '12px' }} />
              <div className="skeleton" style={{ width: '200px', height: '12px' }} />
            </div>
          ))}
        </div>

        {/* Filter Bar skeleton */}
        <div className="filter-panel" style={{ height: '64px', marginBottom: '1.5rem' }}>
          <div className="skeleton" style={{ width: '100%', height: '34px' }} />
        </div>

        {/* Task Cards Grid skeleton */}
        <div className="task-cards-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="skeleton-card" style={{ height: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div className="skeleton" style={{ width: '90px', height: '22px' }} />
                  <div className="skeleton" style={{ width: '70px', height: '20px' }} />
                </div>
                <div className="skeleton" style={{ width: '90%', height: '18px', marginBottom: '8px' }} />
                <div className="skeleton" style={{ width: '60%', height: '12px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                <div className="skeleton" style={{ width: '100px', height: '12px' }} />
                <div className="skeleton" style={{ width: '80px', height: '12px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Quick Copy Working Tasks to Clipboard (Rich HTML Table for Teams/Jira)
  const handleCopyTasks = async () => {
    if (filteredTasks.length === 0) return;

    const columns = [
      { title: 'Ticket', align: 'left' as const },
      { title: 'Tên Công Việc / Task', align: 'left' as const },
      { title: 'Dự Án', align: 'left' as const },
      { title: 'Trạng Thái', align: 'center' as const },
      { title: 'Độ Ưu Tiên', align: 'center' as const },
      { title: 'Billable', align: 'right' as const },
      { title: 'Logged', align: 'right' as const },
      { title: 'Chênh Lệch', align: 'right' as const }
    ];

    const rows = filteredTasks.map(t => {
      const b = t.billableHrs ?? 0;
      const l = t.loggedHours ?? 0;
      const d = Math.round((b - l) * 10) / 10;
      return [
        t.key,
        t.summary,
        t.projectName,
        t.status,
        t.priority,
        `${b}h`,
        `${l}h`,
        `${d >= 0 ? '+' : ''}${d}h`
      ];
    });

    const summaryText = `Tổng hợp task đang phụ trách: ${filteredTasks.length} tasks • Billable: ${summary.totalBillable}h • Logged: ${summary.totalLogged}h`;

    const success = await copyTableToClipboard(columns, rows, summaryText);
    if (success) {
      setCopiedTasks(true);
      setTimeout(() => setCopiedTasks(false), 2000);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title">
          <h2>Nhiệm Vụ Đang Làm (Task Working)</h2>
          <p>Toàn bộ công việc đang được giao trực tiếp cho bạn trên Jira (Trạng thái chưa Closed/Done)</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleCopyTasks}
            title="Sao chép danh sách task đang làm vào Clipboard (dán Excel / Google Sheets / Chat)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}
          >
            {copiedTasks ? <Check size={14} color="var(--emerald-accent)" /> : <Copy size={14} />}
            <span>{copiedTasks ? 'Đã Copy Danh Sách!' : 'Copy Danh Sách'}</span>
          </button>
          <span className="badge-status status-in-progress" style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}>
            <Clock size={13} />
            <span>{tasks.length} Task đang phụ trách</span>
          </span>
        </div>
      </div>

      {/* Summary KPI Row on Working Tasks (Total Logged, Total Billable, Lãi/Lỗ) */}
      <div className="stats-row" style={{ marginBottom: '1.5rem' }}>
        {/* Total Working Billable */}
        <div className="stat-card" style={{ '--card-accent': 'var(--emerald-accent)' } as React.CSSProperties}>
          <div className="stat-card-label">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <DollarSign size={15} color="var(--emerald-accent)" strokeWidth={2.5} />
              <span>Tổng Billable Tasks Này</span>
            </span>
            <span style={{ color: 'var(--emerald-accent)' }}>Billed</span>
          </div>
          <div className="stat-card-value">
            <span>{summary.totalBillable.toLocaleString()}</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)' }}>giờ</span>
          </div>
          <div className="stat-card-meta" style={{ color: 'var(--emerald-text)' }}>
            <Award size={14} />
            <span>{summary.billableTaskCount} tasks có gắn Billable Hrs</span>
          </div>
        </div>

        {/* Total Working Logged */}
        <div className="stat-card" style={{ '--card-accent': 'var(--navy-primary)' } as React.CSSProperties}>
          <div className="stat-card-label">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Clock size={15} color="var(--navy-primary)" strokeWidth={2.5} />
              <span>Tổng Time Log Đã Log</span>
            </span>
            <span>Actual</span>
          </div>
          <div className="stat-card-value">
            <span>{summary.totalLogged.toLocaleString()}</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)' }}>giờ</span>
          </div>
          <div className="stat-card-meta" style={{ color: 'var(--text-muted)' }}>
            <span>Số giờ thực tế đã tiêu tốn trên các task này</span>
          </div>
        </div>

        {/* Profit / Loss (Lãi / Lỗ) */}
        <div className="stat-card" style={{ '--card-accent': summary.isProfit ? 'var(--emerald-accent)' : 'var(--rose-accent)' } as React.CSSProperties}>
          <div className="stat-card-label">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Scale size={15} color={summary.isProfit ? 'var(--emerald-accent)' : 'var(--rose-accent)'} strokeWidth={2.5} />
              <span>Chênh Lệch Lãi / Lỗ</span>
            </span>
            <span style={{ color: summary.isProfit ? 'var(--emerald-accent)' : 'var(--rose-accent)', fontWeight: 700 }}>
              {summary.isProfit ? 'LÃI' : 'LỖ'}
            </span>
          </div>
          <div className="stat-card-value" style={{ color: summary.isProfit ? 'var(--emerald-text)' : 'var(--rose-accent)' }}>
            <span>{(summary.delta >= 0 ? '+' : '') + summary.delta.toLocaleString()}</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)' }}>giờ</span>
          </div>
          <div className="stat-card-meta" style={{ color: summary.isProfit ? 'var(--emerald-text)' : 'var(--rose-accent)' }}>
            {summary.isProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>Tỷ suất: <b>{(summary.profitRate >= 0 ? '+' : '') + summary.profitRate}%</b></span>
          </div>
        </div>
      </div>

      {/* Filter Bar with Profit/Loss Filter */}
      <div className="filter-panel">
        <div className="filter-group">
          <label className="filter-label">Dự Án</label>
          <select
            className="filter-select"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <option value="ALL">Tất cả dự án ({projects.length})</option>
            {projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Trạng Thái</label>
          <select
            className="filter-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Mức Độ Ưu Tiên</label>
          <select
            className="filter-select"
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
          >
            <option value="ALL">Tất cả ưu tiên</option>
            {priorities.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Lọc Lãi / Lỗ Time */}
        <div className="filter-group">
          <label className="filter-label">Hiệu Suất (Lãi / Lỗ)</label>
          <select
            className="filter-select"
            value={selectedProfitFilter}
            onChange={(e) => setSelectedProfitFilter(e.target.value)}
            style={{ fontWeight: 600 }}
          >
            <option value="ALL">Tất cả hiệu suất</option>
            <option value="PROFIT">Chỉ Task Có Lãi (Bill &gt; Log)</option>
            <option value="LOSS">Chỉ Task Bị Lỗ (Log &gt; Bill)</option>
            <option value="BREAKEVEN">Hòa Giờ (Bill = Log)</option>
            <option value="HAS_BILLABLE">Có gắn Billable Hrs</option>
            <option value="NO_BILLABLE">Chưa gắn Billable</option>
          </select>
        </div>

        <div className="filter-group search-input-wrap">
          <label className="filter-label">Tìm Kiếm Nhiệm Vụ</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="filter-input"
              style={{ width: '100%', paddingLeft: '2rem' }}
              placeholder="Tìm theo mã ticket, tên task, dự án..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>
        </div>
      </div>

      {/* Task Cards Grid */}
      {filteredTasks.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3.5rem',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-muted)'
        }}>
          <CheckCircle2 size={36} color="var(--text-dim)" style={{ margin: '0 auto 0.75rem' }} />
          <div style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>Không có task nào phù hợp với bộ lọc</div>
          <div style={{ fontSize: '0.84rem' }}>Hãy thử điều chỉnh lại bộ lọc dự án hoặc hiệu suất.</div>
        </div>
      ) : (
        <div className="task-cards-grid">
          {filteredTasks.map(task => {
            const billable = task.billableHrs ?? 0;
            const logged = task.loggedHours ?? 0;
            const hasFinancials = billable > 0 || logged > 0;
            const itemDelta = billable - logged;
            const isItemProfit = itemDelta >= 0;
            const itemProfitPercent = logged > 0
              ? Math.round(((billable - logged) / logged) * 1000) / 10
              : (billable > 0 ? 100 : 0);

            return (
              <div key={task.key} className="task-item-card">
                <div>
                  <div className="task-card-top">
                    <a
                      href={`${domain}/browse/${task.key}`}
                      target="_blank"
                      rel="noreferrer"
                      className="badge-ticket"
                    >
                      <span>{task.key}</span>
                      <ExternalLink size={11} opacity={0.7} />
                    </a>
                    <span className={`badge-status ${getStatusClass(task.status)}`}>
                      {task.status}
                    </span>
                  </div>

                  <div className="task-card-title">
                    {task.summary}
                  </div>

                  <div className="task-card-project">
                    <Folder size={12} />
                    <span>{task.projectName}</span>
                  </div>
                </div>

                <div>
                  {/* Badges Row */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem', alignItems: 'center' }}>
                    <span className={`badge-priority ${getPriorityClass(task.priority)}`}>
                      <Zap size={11} />
                      <span>{task.priority}</span>
                    </span>

                    {billable > 0 && (
                      <span className="badge-billable">
                        <DollarSign size={11} strokeWidth={2.5} />
                        <span>Bill: {billable}h</span>
                      </span>
                    )}

                    <span className="badge-logged">
                      <Clock size={11} />
                      <span>Log: {logged}h</span>
                    </span>

                    {task.leaderEstimate != null && task.leaderEstimate > 0 && (
                      <span className="badge-logged" style={{ color: 'var(--text-muted)' }}>
                        Est: {task.leaderEstimate}h
                      </span>
                    )}

                    {/* Profit/Loss badge on item */}
                    {hasFinancials && billable > 0 && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.45rem',
                          borderRadius: 'var(--radius-sm)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          background: isItemProfit ? 'var(--emerald-pastel)' : 'var(--rose-pastel)',
                          color: isItemProfit ? 'var(--emerald-text)' : 'var(--rose-accent)',
                          border: isItemProfit ? '1px solid #a7f3d0' : '1px solid #fecdd3'
                        }}
                      >
                        {isItemProfit ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        <span>{(itemDelta >= 0 ? '+' : '') + Math.round(itemDelta * 10) / 10}h ({(itemProfitPercent >= 0 ? '+' : '') + itemProfitPercent}%)</span>
                      </span>
                    )}
                  </div>

                  <div className="task-card-footer">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={11} />
                      <span>Cập nhật: {task.updated}</span>
                    </span>

                    {task.duedate ? (
                      <span style={{ color: 'var(--rose-accent)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <AlertCircle size={11} />
                        <span>Hạn: {task.duedate}</span>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-dim)' }}>Không có hạn</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
