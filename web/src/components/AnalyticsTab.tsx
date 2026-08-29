import React, { useState, useMemo, useEffect } from 'react';
import { Filter, Search, Download, ExternalLink, Calendar, Folder, BarChart3, Award, Target, Copy, Check } from 'lucide-react';
import type { BillableItem } from '../types/jira';
import { StatCards } from './StatCards';
import { MonthlyReportModal } from './MonthlyReportModal';
import { copyTableToClipboard } from '../utils/clipboard';

interface AnalyticsTabProps {
  items: BillableItem[];
  domain: string;
  userName?: string;
  isLoading?: boolean;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ items, domain, userName, isLoading }) => {
  const currentNow = useMemo(() => new Date(), []);
  const currentYearStr = currentNow.getFullYear().toString();
  const currentMonthStr = `${currentNow.getFullYear()}-${(currentNow.getMonth() + 1).toString().padStart(2, '0')}`;

  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [copiedTable, setCopiedTable] = useState<boolean>(false);

  // Quota (target hours for month) initialized from localStorage
  const [monthlyQuota, setMonthlyQuota] = useState<number>(() => {
    const saved = localStorage.getItem(`jira_monthly_quota_${currentMonthStr}`);
    if (saved !== null) {
      const val = parseFloat(saved);
      if (!isNaN(val) && val >= 0) return val;
    }
    return 80;
  });

  const [quotaInput, setQuotaInput] = useState<string>(() => {
    const saved = localStorage.getItem(`jira_monthly_quota_${currentMonthStr}`);
    if (saved !== null) {
      const val = parseFloat(saved);
      if (!isNaN(val) && val >= 0) return val.toString();
    }
    return '80';
  });

  // Sync quota when selectedMonth changes
  useEffect(() => {
    if (selectedMonth && selectedMonth !== 'ALL') {
      const saved = localStorage.getItem(`jira_monthly_quota_${selectedMonth}`);
      if (saved !== null) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 0) {
          setMonthlyQuota(val);
          setQuotaInput(val.toString());
          return;
        }
      }
      setMonthlyQuota(80);
      setQuotaInput('80');
    }
  }, [selectedMonth]);

  const handleUpdateQuota = (newQuota: number) => {
    setMonthlyQuota(newQuota);
    setQuotaInput(newQuota.toString());
    const targetMonth = selectedMonth !== 'ALL' ? selectedMonth : currentMonthStr;
    localStorage.setItem(`jira_monthly_quota_${targetMonth}`, newQuota.toString());
  };

  const handleQuotaInputChange = (rawVal: string) => {
    setQuotaInput(rawVal);
    const targetMonth = selectedMonth !== 'ALL' ? selectedMonth : currentMonthStr;
    if (rawVal.trim() === '') {
      setMonthlyQuota(0);
      localStorage.setItem(`jira_monthly_quota_${targetMonth}`, '0');
      return;
    }
    const num = parseFloat(rawVal);
    if (!isNaN(num) && num >= 0) {
      setMonthlyQuota(num);
      localStorage.setItem(`jira_monthly_quota_${targetMonth}`, num.toString());
    }
  };

  const handleQuotaInputBlur = () => {
    if (quotaInput.trim() === '' || isNaN(parseFloat(quotaInput))) {
      setQuotaInput('0');
      handleUpdateQuota(0);
    } else {
      const num = parseFloat(quotaInput);
      setQuotaInput(num.toString());
      handleUpdateQuota(num);
    }
  };

  // Extract distinct years, months, projects (Hooks ALWAYS declared at the top)
  const years = useMemo(() => {
    const list = [...new Set([currentYearStr, ...items.map(i => i.billedYear).filter(Boolean)])]
      .sort()
      .reverse();
    return list;
  }, [items, currentYearStr]);

  const months = useMemo(() => {
    let filtered = items;
    if (selectedYear !== 'ALL') {
      filtered = filtered.filter(i => i.billedYear === selectedYear || (selectedYear === currentYearStr && i.billedYear === 'Khác'));
    }
    const list = [...new Set(filtered.map(i => i.billedMonth).filter(Boolean))].sort().reverse();
    return list;
  }, [items, selectedYear, currentYearStr]);

  const projects = useMemo(() => {
    const list = [...new Set(items.map(i => i.projectName))].sort();
    return list;
  }, [items]);

  // Filtered dataset
  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return items.filter(item => {
      const matchYear = selectedYear === 'ALL' || item.billedYear === selectedYear;
      const matchMonth = selectedMonth === 'ALL' || item.billedMonth === selectedMonth;
      const matchProject = selectedProject === 'ALL' || item.projectName === selectedProject;
      const matchSearch = !query ||
        item.key.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query) ||
        item.projectName.toLowerCase().includes(query);

      return matchYear && matchMonth && matchProject && matchSearch;
    });
  }, [items, selectedYear, selectedMonth, selectedProject, searchQuery]);

  // Summary Metrics
  const totalBillable = useMemo(() => filteredItems.reduce((acc, i) => acc + i.billableHrs, 0), [filteredItems]);
  const totalLogged = useMemo(() => filteredItems.reduce((acc, i) => acc + i.loggedHours, 0), [filteredItems]);
  const delta = totalBillable - totalLogged;
  const efficiencyRate = totalLogged > 0 ? Math.round((totalBillable / totalLogged) * 100) : 100;
  const uniqueProjectsCount = useMemo(() => new Set(filteredItems.map(i => i.projectKey)).size, [filteredItems]);
  const latestCycle = months[0] || '2026-08';

  // Project Breakdown Data
  const projectBreakdown = useMemo(() => {
    const map: Record<string, { name: string; key: string; billable: number; logged: number; count: number }> = {};
    filteredItems.forEach(i => {
      if (!map[i.projectName]) {
        map[i.projectName] = { name: i.projectName, key: i.projectKey, billable: 0, logged: 0, count: 0 };
      }
      map[i.projectName].billable += i.billableHrs;
      map[i.projectName].logged += i.loggedHours;
      map[i.projectName].count++;
    });
    return Object.values(map).sort((a, b) => b.billable - a.billable);
  }, [filteredItems]);

  // Monthly Trends Data
  const monthlyBreakdown = useMemo(() => {
    const map: Record<string, { month: string; billable: number; logged: number; count: number }> = {};
    filteredItems.forEach(i => {
      const m = i.billedMonth || 'Chưa gắn kỳ';
      if (!map[m]) {
        map[m] = { month: m, billable: 0, logged: 0, count: 0 };
      }
      map[m].billable += i.billableHrs;
      map[m].logged += i.loggedHours;
      map[m].count++;
    });
    return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
  }, [filteredItems]);

  const maxMonthBillable = useMemo(() => {
    return Math.max(...monthlyBreakdown.map(m => m.billable), 1);
  }, [monthlyBreakdown]);

  // Export JSON
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredItems, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `billable_report_${userName || 'jira'}_${selectedYear}.json`;
    a.click();
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Ticket', 'Summary', 'Project', 'Billed Date', 'Billed Month', 'Billable Hrs', 'Logged Hrs', 'Status'];
    const rows = filteredItems.map(i => [
      i.key,
      `"${i.summary.replace(/"/g, '""')}"`,
      `"${i.projectName.replace(/"/g, '""')}"`,
      i.billedDate || '',
      i.billedMonth || '',
      i.billableHrs,
      i.loggedHours,
      i.status
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csvContent);
    a.download = `billable_report_${userName || 'jira'}_${selectedYear}.csv`;
    a.click();
  };

  // Quick Copy Table to Clipboard (Rich HTML Table for Teams/Jira + Clean TSV)
  const handleCopyTable = async () => {
    if (filteredItems.length === 0) return;

    const columns = [
      { title: 'Ticket', align: 'left' as const },
      { title: 'Tên Công Việc / Task', align: 'left' as const },
      { title: 'Dự Án', align: 'left' as const },
      { title: 'Kỳ Billed', align: 'center' as const },
      { title: 'Billable', align: 'right' as const },
      { title: 'Logged', align: 'right' as const },
      { title: 'Trạng Thái', align: 'center' as const }
    ];

    const rows = filteredItems.map(i => [
      i.key,
      i.summary,
      i.projectName,
      i.billedDate || 'Chưa gán',
      `${i.billableHrs}h`,
      `${i.loggedHours}h`,
      i.status
    ]);

    const summary = `Tổng cộng: ${filteredItems.length} tasks • Billable: ${Math.round(totalBillable * 10) / 10}h • Logged: ${Math.round(totalLogged * 10) / 10}h`;

    const success = await copyTableToClipboard(columns, rows, summary);
    if (success) {
      setCopiedTable(true);
      setTimeout(() => setCopiedTable(false), 2000);
    }
  };

  const getStatusClass = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('progress')) return 'status-in-progress';
    if (s.includes('done') || s.includes('closed')) return 'status-done';
    if (s.includes('resolve')) return 'status-resolved';
    if (s.includes('review')) return 'status-review';
    if (s.includes('reopen')) return 'status-reopened';
    return 'status-open';
  };

  // If loading and no items yet, render Skeleton screen (AFTER all hooks)
  if (isLoading && items.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="skeleton" style={{ width: '280px', height: '28px', marginBottom: '8px' }} />
            <div className="skeleton" style={{ width: '420px', height: '14px' }} />
          </div>
        </div>

        {/* 4 Skeleton Stat Cards */}
        <div className="stats-row">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="stat-card">
              <div className="skeleton" style={{ width: '120px', height: '12px', marginBottom: '12px' }} />
              <div className="skeleton" style={{ width: '160px', height: '36px', marginBottom: '12px' }} />
              <div className="skeleton" style={{ width: '180px', height: '12px' }} />
            </div>
          ))}
        </div>

        {/* Skeleton Filter Bar */}
        <div className="filter-panel" style={{ height: '64px' }}>
          <div className="skeleton" style={{ width: '100%', height: '34px' }} />
        </div>

        {/* Skeleton Grid */}
        <div className="dashboard-grid">
          <div className="panel" style={{ height: '420px', padding: '1.25rem' }}>
            <div className="skeleton" style={{ width: '100%', height: '32px', marginBottom: '16px' }} />
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="skeleton" style={{ width: '100%', height: '38px', marginBottom: '10px' }} />
            ))}
          </div>
          <div className="panel" style={{ height: '420px', padding: '1.25rem' }}>
            <div className="skeleton" style={{ width: '100%', height: '32px', marginBottom: '16px' }} />
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton" style={{ width: '100%', height: '48px', marginBottom: '12px' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title">
          <h2>Báo Cáo & Phân Tích Billable Hours</h2>
          <p>Thống kê chính xác số giờ tính phí (<code>customfield_12200</code>) đối soát với Actual Logged Hours</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setIsReportModalOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontWeight: 700
            }}
          >
            <Award size={15} />
            <span>Xem Báo Cáo KPI</span>
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
            <Download size={14} />
            <span>Xuất CSV</span>
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExportJSON}>
            <Download size={14} />
            <span>Xuất JSON</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <StatCards
        totalBillable={totalBillable}
        totalLogged={totalLogged}
        delta={delta}
        efficiencyRate={efficiencyRate}
        taskCount={filteredItems.length}
        projectCount={uniqueProjectsCount}
        latestCycle={latestCycle}
        selectedMonth={selectedMonth}
        monthlyQuota={monthlyQuota}
        onOpenReport={() => setIsReportModalOpen(true)}
      />

      {/* Filter Bar */}
      <div className="filter-panel">
        <div className="filter-group">
          <label className="filter-label">Năm</label>
          <select
            className="filter-select select-year"
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setSelectedMonth('ALL');
            }}
          >
            <option value="ALL">Tất cả năm</option>
            {years.map(y => <option key={y} value={y}>Năm {y}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Kỳ Billed</label>
          <select
            className="filter-select select-month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="ALL">Tất cả kỳ</option>
            {months.map(m => <option key={m} value={m}>Kỳ {m}</option>)}
          </select>
        </div>

        {/* Monthly Quota Input (Visible when specific month is selected) */}
        {selectedMonth !== 'ALL' && (
          <div className="filter-group quota-filter-group">
            <label className="filter-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Target size={12} color="var(--navy-primary)" />
              <span>Định Mức</span>
            </label>
            <div className="quota-input-wrapper">
              <input
                type="number"
                min="0"
                max="500"
                step="1"
                className="filter-input quota-input-box"
                value={quotaInput}
                onChange={(e) => handleQuotaInputChange(e.target.value)}
                onBlur={handleQuotaInputBlur}
                title="Mục tiêu số giờ billable trong tháng để đạt 100% KPI (cho phép xoá về 0)"
              />
              <span className="quota-unit-label">h</span>
            </div>
          </div>
        )}

        <div className="filter-group">
          <label className="filter-label">Dự Án</label>
          <select
            className="filter-select select-project"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <option value="ALL">Tất cả dự án</option>
            {projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="filter-group search-filter-group">
          <label className="filter-label">Tìm Kiếm</label>
          <div className="search-input-box-wrap">
            <input
              type="text"
              className="filter-input search-input-ctrl"
              placeholder="Ticket, task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={13} className="search-inline-icon" />
          </div>
        </div>

        <div className="filter-group filter-actions-end">
          <button
            type="button"
            className="btn btn-kpi-pill"
            onClick={() => setIsReportModalOpen(true)}
            title="Xem báo cáo phân tích KPI chi tiết"
          >
            <Award size={14} />
            <span>Báo Cáo KPI</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Data Table & Sidebar */}
      <div className="dashboard-grid">
        {/* Left: Detail Task Table */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <Filter size={15} color="var(--navy-primary)" />
              <span>Chi Tiết Đầu Việc & Billable Hours</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={handleCopyTable}
                title="Sao chép toàn bộ bảng dữ liệu vào Clipboard (dán được vào Excel / Google Sheets / Chat)"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.74rem', padding: '0.2rem 0.55rem' }}
              >
                {copiedTable ? <Check size={12} color="var(--emerald-accent)" /> : <Copy size={12} />}
                <span>{copiedTable ? 'Đã Copy Bảng!' : 'Copy Bảng'}</span>
              </button>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {filteredItems.length} kết quả
              </span>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Tên Công Việc / Task</th>
                  <th>Kỳ Billed</th>
                  <th>Billable</th>
                  <th>Logged</th>
                  <th>Trạng Thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      Không tìm thấy công việc nào phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => (
                    <tr key={item.key}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <a
                          href={`${domain}/browse/${item.key}`}
                          target="_blank"
                          rel="noreferrer"
                          className="badge-ticket"
                        >
                          <span>{item.key}</span>
                          <ExternalLink size={11} opacity={0.7} />
                        </a>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.15rem' }}>
                          {item.summary}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Folder size={11} />
                          <span>{item.projectName}</span>
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {item.billedDate ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Calendar size={12} color="var(--text-muted)" />
                            {item.billedDate}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>Chưa gán</span>
                        )}
                      </td>
                      <td>
                        <span className="badge-billable">
                          {item.billableHrs}h
                        </span>
                      </td>
                      <td>
                        <span className="badge-logged">
                          {item.loggedHours}h
                        </span>
                      </td>
                      <td>
                        <span className={`badge-status ${getStatusClass(item.status)}`}>
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

        {/* Right Sidebar: Visual Distribution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Project Distribution */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <Folder size={15} color="var(--navy-primary)" />
                <span>Tỷ Trọng Theo Dự Án</span>
              </div>
            </div>
            <div className="panel-body">
              {projectBreakdown.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.85rem' }}>Không có dữ liệu</div>
              ) : (
                projectBreakdown.map(p => {
                  const percent = totalBillable > 0 ? Math.round((p.billable / totalBillable) * 100) : 0;
                  return (
                    <div key={p.key} className="bar-group">
                      <div className="bar-label-row">
                        <span style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>{p.name}</span>
                        <span style={{ color: 'var(--emerald-text)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {Math.round(p.billable * 10) / 10}h ({percent}%)
                        </span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill-billable" style={{ width: `${percent}%` }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        <span>{p.count} tasks</span>
                        <span>Logged: {Math.round(p.logged * 10) / 10}h</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Monthly Trends */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <BarChart3 size={15} color="var(--navy-primary)" />
                <span>Tổng Hợp Theo Kỳ (Tháng)</span>
              </div>
            </div>
            <div className="panel-body">
              {monthlyBreakdown.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.85rem' }}>Không có dữ liệu</div>
              ) : (
                monthlyBreakdown.map(m => {
                  const barWidth = Math.round((m.billable / maxMonthBillable) * 100);
                  return (
                    <div key={m.month} className="bar-group">
                      <div className="bar-label-row">
                        <span style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>Kỳ {m.month}</span>
                        <span style={{ color: 'var(--emerald-text)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {Math.round(m.billable * 10) / 10}h Billable
                        </span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill-billable" style={{ width: `${barWidth}%` }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        <span>{m.count} tasks</span>
                        <span>Logged: {Math.round(m.logged * 10) / 10}h</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly KPI Report Modal */}
      <MonthlyReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        selectedMonth={selectedMonth}
        quota={monthlyQuota}
        onUpdateQuota={handleUpdateQuota}
        items={filteredItems}
        userName={userName}
        domain={domain}
      />
    </div>
  );
};
