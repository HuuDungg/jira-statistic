import React, { useState, useMemo } from 'react';
import {
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Search,
  Download,
  Copy,
  Check,
  ExternalLink,
  Folder,
  Calendar,
  Scale
} from 'lucide-react';
import type { BillableItem } from '../types/jira';
import { copyTableToClipboard } from '../utils/clipboard';

interface LogtimeTabProps {
  items: BillableItem[];
  domain: string;
  userName?: string;
  isLoading?: boolean;
}

export const LogtimeTab: React.FC<LogtimeTabProps> = ({
  items,
  domain,
  userName,
  isLoading
}) => {
  const currentNow = useMemo(() => new Date(), []);
  const currentYearStr = currentNow.getFullYear().toString();
  const currentMonthStr = `${currentNow.getFullYear()}-${(currentNow.getMonth() + 1).toString().padStart(2, '0')}`;

  // Default auto-select to current year & current month
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [selectedCloseStatus, setSelectedCloseStatus] = useState<string>('ALL'); // ALL | CLOSED | OPEN
  const [selectedBillStatus, setSelectedBillStatus] = useState<string>('ALL'); // ALL | BILLED | UNBILLED
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedTable, setCopiedTable] = useState<boolean>(false);

  // Helper check if status is closed/done
  const isStatusClosed = (status: string) => {
    const s = status.toLowerCase();
    return s.includes('done') || s.includes('closed') || s.includes('resolve');
  };

  // Extract distinct years from items (strictly based on actual worklog years)
  const years = useMemo(() => {
    const yearSet = new Set<string>();
    items.forEach(i => {
      if (i.worklogYears && i.worklogYears.length > 0) {
        i.worklogYears.forEach(y => yearSet.add(y));
      }
    });
    if (yearSet.size === 0) yearSet.add(currentYearStr);
    return [...yearSet].filter(Boolean).sort().reverse();
  }, [items, currentYearStr]);

  // Extract distinct months strictly based on actual worklog months
  const months = useMemo(() => {
    const monthSet = new Set<string>();
    items.forEach(i => {
      if (i.worklogMonths && i.worklogMonths.length > 0) {
        i.worklogMonths.forEach(m => {
          if (selectedYear === 'ALL' || m.startsWith(selectedYear)) {
            monthSet.add(m);
          }
        });
      }
    });
    if (monthSet.size === 0 && (selectedYear === 'ALL' || selectedYear === currentYearStr)) {
      monthSet.add(currentMonthStr);
    }
    return [...monthSet].filter(Boolean).sort().reverse();
  }, [items, selectedYear, currentMonthStr]);

  // Distinct projects
  const projects = useMemo(() => {
    return [...new Set(items.map(i => i.projectName))].sort();
  }, [items]);

  // Filtered Items strictly based on actual working/logged time
  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return items.filter(item => {
      const isClosed = isStatusClosed(item.status);
      const isBilled = item.billableHrs > 0 || Boolean(item.billedDate);

      // Match Year (strictly actual working time / worklog year)
      let matchYear = selectedYear === 'ALL';
      if (!matchYear) {
        matchYear = Boolean(item.worklogYears && item.worklogYears.includes(selectedYear));
      }

      // Match Month (strictly actual working time / worklog month)
      let matchMonth = selectedMonth === 'ALL';
      if (!matchMonth) {
        matchMonth = Boolean(item.worklogMonths && item.worklogMonths.includes(selectedMonth));
      }

      // Match Project
      const matchProject = selectedProject === 'ALL' || item.projectName === selectedProject;

      // Match Close Status
      let matchClose = true;
      if (selectedCloseStatus === 'CLOSED') matchClose = isClosed;
      else if (selectedCloseStatus === 'OPEN') matchClose = !isClosed;

      // Match Bill Status
      let matchBill = true;
      if (selectedBillStatus === 'BILLED') matchBill = isBilled;
      else if (selectedBillStatus === 'UNBILLED') matchBill = !isBilled;

      // Match Search
      const matchSearch = !query ||
        item.key.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query) ||
        item.projectName.toLowerCase().includes(query);

      return matchYear && matchMonth && matchProject && matchClose && matchBill && matchSearch;
    });
  }, [items, selectedYear, selectedMonth, selectedProject, selectedCloseStatus, selectedBillStatus, searchQuery]);

  // Summary Metrics on filtered list (calculating actual working hours for selected month if specified)
  const totalLogged = useMemo(() => {
    return Math.round(
      filteredItems.reduce((acc, i) => {
        const h = (selectedMonth !== 'ALL' && i.worklogsByMonth?.[selectedMonth] !== undefined)
          ? i.worklogsByMonth[selectedMonth]
          : (i.loggedHours || 0);
        return acc + h;
      }, 0) * 10
    ) / 10;
  }, [filteredItems, selectedMonth]);

  const totalBillable = useMemo(() => {
    return Math.round(filteredItems.reduce((acc, i) => acc + (i.billableHrs || 0), 0) * 10) / 10;
  }, [filteredItems]);

  const closedCount = useMemo(() => {
    return filteredItems.filter(i => isStatusClosed(i.status)).length;
  }, [filteredItems]);

  const openCount = filteredItems.length - closedCount;

  const billedCount = useMemo(() => {
    return filteredItems.filter(i => i.billableHrs > 0 || Boolean(i.billedDate)).length;
  }, [filteredItems]);

  const unbilledCount = filteredItems.length - billedCount;

  const closeRate = filteredItems.length > 0
    ? Math.round((closedCount / filteredItems.length) * 100)
    : 0;

  const billedRate = filteredItems.length > 0
    ? Math.round((billedCount / filteredItems.length) * 100)
    : 0;

  const delta = Math.round((totalBillable - totalLogged) * 10) / 10;

  // Copy table handler (Rich HTML Table for Teams/Jira + Clean TSV)
  const handleCopyTable = async () => {
    if (filteredItems.length === 0) return;

    const columns = [
      { title: 'Ticket', align: 'left' as const },
      { title: 'Tên Công Việc / Task', align: 'left' as const },
      { title: 'Dự Án', align: 'left' as const },
      { title: 'Trạng Thái', align: 'center' as const },
      { title: 'Đóng Task', align: 'center' as const },
      { title: 'Giờ Log', align: 'right' as const },
      { title: 'Giờ Bill', align: 'right' as const },
      { title: 'Trả Bill?', align: 'center' as const },
      { title: 'Kỳ Billed', align: 'center' as const }
    ];

    const rows = filteredItems.map(i => {
      const isClosed = isStatusClosed(i.status) ? 'Closed' : 'Open';
      const isBilled = (i.billableHrs > 0 || i.billedDate) ? 'Đã trả bill' : 'Chưa có bill';
      const logH = (selectedMonth !== 'ALL' && i.worklogsByMonth?.[selectedMonth] !== undefined)
        ? i.worklogsByMonth[selectedMonth]
        : i.loggedHours;
      return [
        i.key,
        i.summary,
        i.projectName,
        i.status,
        isClosed,
        `${logH}h`,
        `${i.billableHrs}h`,
        isBilled,
        i.billedDate || 'Chưa gán'
      ];
    });

    const summary = `Tổng hợp: ${filteredItems.length} tasks • Logged: ${totalLogged}h • Billed: ${totalBillable}h (Đã đóng: ${closedCount}/${filteredItems.length} • Đã trả bill: ${billedCount}/${filteredItems.length})`;

    const success = await copyTableToClipboard(columns, rows, summary);
    if (success) {
      setCopiedTable(true);
      setTimeout(() => setCopiedTable(false), 2000);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Ticket', 'Summary', 'Project', 'Status', 'Is Closed', 'Logged Hrs', 'Billable Hrs', 'Is Billed', 'Billed Date', 'Updated'];
    const rows = filteredItems.map(i => [
      i.key,
      `"${i.summary.replace(/"/g, '""')}"`,
      `"${i.projectName.replace(/"/g, '""')}"`,
      i.status,
      isStatusClosed(i.status) ? 'Closed' : 'Open',
      (selectedMonth !== 'ALL' && i.worklogsByMonth?.[selectedMonth] !== undefined)
        ? i.worklogsByMonth[selectedMonth]
        : i.loggedHours,
      i.billableHrs,
      (i.billableHrs > 0 || i.billedDate) ? 'Billed' : 'Unbilled',
      i.billedDate || '',
      i.updatedDate || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csvContent);
    a.download = `logtime_history_${userName || 'jira'}_${selectedYear}.csv`;
    a.click();
  };

  const getStatusBadgeClass = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('done') || s.includes('closed')) return 'status-done';
    if (s.includes('resolve')) return 'status-resolved';
    if (s.includes('progress')) return 'status-in-progress';
    if (s.includes('review')) return 'status-review';
    if (s.includes('reopen')) return 'status-reopened';
    return 'status-open';
  };

  if (isLoading && items.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div className="page-title">
            <h2>Báo Cáo & Lịch Sử Log Time</h2>
            <p>Đang tải dữ liệu từ Jira...</p>
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
          <h2>Báo Cáo & Lịch Sử Log Time</h2>
          <p>Thống kê chi tiết toàn bộ các task bạn đã log giờ, đối soát trạng thái <strong>Đã Close / Chưa Close</strong> và <strong>Đã Trả Bill / Chưa Trả Bill</strong></p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
            <Download size={14} />
            <span>Xuất CSV</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="stats-row">
        {/* 1. Total Logged Time */}
        <div className="stat-card" style={{ '--card-accent': 'var(--navy-primary)' } as React.CSSProperties}>
          <div className="stat-card-label">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Clock size={15} color="var(--navy-primary)" strokeWidth={2.5} />
              <span>Tổng Giờ Đã Log</span>
            </span>
            <span>Logged</span>
          </div>
          <div className="stat-card-value">
            <span className="stat-num">{totalLogged.toLocaleString()}</span>
            <span className="stat-unit">giờ</span>
          </div>
          <div className="stat-card-meta" style={{ color: 'var(--text-muted)' }}>
            <span>{filteredItems.length} đầu việc có phát sinh giờ</span>
          </div>
        </div>

        {/* 2. Total Billable Received */}
        <div className="stat-card" style={{ '--card-accent': 'var(--emerald-accent)' } as React.CSSProperties}>
          <div className="stat-card-label">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <DollarSign size={15} color="var(--emerald-accent)" strokeWidth={2.5} />
              <span>Tổng Giờ Được Trả Bill</span>
            </span>
            <span style={{ color: 'var(--emerald-accent)' }}>Billed</span>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--emerald-text)' }}>
            <span className="stat-num">{totalBillable.toLocaleString()}</span>
            <span className="stat-unit">giờ</span>
          </div>
          <div className="stat-card-meta" style={{ color: delta >= 0 ? 'var(--emerald-text)' : 'var(--rose-accent)' }}>
            <span>Chênh lệch: <b>{delta >= 0 ? `+${delta}h` : `${delta}h`}</b> so với log</span>
          </div>
        </div>

        {/* 3. Task Close Rate */}
        <div className="stat-card" style={{ '--card-accent': 'var(--purple-accent)' } as React.CSSProperties}>
          <div className="stat-card-label">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckCircle2 size={15} color="var(--purple-accent)" strokeWidth={2.5} />
              <span>Tiến Độ Đóng Task</span>
            </span>
            <span>{closeRate}%</span>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--purple-accent)' }}>
            <span className="stat-num">{closedCount}</span>
            <span className="stat-unit">/{filteredItems.length} task</span>
          </div>
          <div className="stat-card-meta" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <CheckCircle2 size={12} color="var(--emerald-accent)" />
            <span>{closedCount} Đã đóng</span>
            <span>•</span>
            <Clock size={12} color="var(--navy-primary)" />
            <span>{openCount} Đang mở</span>
          </div>
        </div>

        {/* 4. Bill Payment Status */}
        <div className="stat-card" style={{ '--card-accent': 'var(--amber-accent)' } as React.CSSProperties}>
          <div className="stat-card-label">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Scale size={15} color="var(--amber-accent)" strokeWidth={2.5} />
              <span>Tình Trạng Trả Bill</span>
            </span>
            <span>{billedRate}%</span>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--amber-text)' }}>
            <span className="stat-num">{billedCount}</span>
            <span className="stat-unit">/{filteredItems.length} task</span>
          </div>
          <div className="stat-card-meta" style={{ color: unbilledCount > 0 ? 'var(--rose-accent)' : 'var(--emerald-text)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <DollarSign size={12} color="var(--emerald-accent)" />
            <span>{billedCount} Đã trả bill</span>
            <span>•</span>
            <AlertCircle size={12} color="var(--amber-accent)" />
            <span>{unbilledCount} Chưa có bill</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-panel">
        {/* Năm */}
        <div className="filter-group" style={{ minWidth: '125px' }}>
          <label className="filter-label">Năm</label>
          <select
            className="filter-select"
            style={{ width: '100%' }}
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

        {/* Tháng */}
        <div className="filter-group" style={{ minWidth: '155px' }}>
          <label className="filter-label">Tháng Làm Việc</label>
          <select
            className="filter-select"
            style={{ width: '100%' }}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="ALL">Tất cả các tháng</option>
            {months.map(m => <option key={m} value={m}>Tháng {m}</option>)}
          </select>
        </div>

        {/* Lọc Trạng thái Close */}
        <div className="filter-group" style={{ minWidth: '195px' }}>
          <label className="filter-label">Trạng Thái Đóng Task</label>
          <select
            className="filter-select"
            style={{ width: '100%' }}
            value={selectedCloseStatus}
            onChange={(e) => setSelectedCloseStatus(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái ({filteredItems.length})</option>
            <option value="CLOSED">Đã Close / Done ({closedCount})</option>
            <option value="OPEN">Chưa Close / Đang mở ({openCount})</option>
          </select>
        </div>

        {/* Lọc Trạng thái Trả Bill */}
        <div className="filter-group" style={{ minWidth: '195px' }}>
          <label className="filter-label">Tình Trạng Trả Bill</label>
          <select
            className="filter-select"
            style={{ width: '100%' }}
            value={selectedBillStatus}
            onChange={(e) => setSelectedBillStatus(e.target.value)}
          >
            <option value="ALL">Tất cả trả bill ({filteredItems.length})</option>
            <option value="BILLED">Đã Trả Bill ({billedCount})</option>
            <option value="UNBILLED">Chưa Có Bill ({unbilledCount})</option>
          </select>
        </div>

        {/* Dự án */}
        <div className="filter-group" style={{ minWidth: '210px' }}>
          <label className="filter-label">Dự Án</label>
          <select
            className="filter-select"
            style={{ width: '100%' }}
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <option value="ALL">Tất cả dự án ({projects.length})</option>
            {projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Tìm kiếm */}
        <div className="filter-group" style={{ flex: '1 1 200px', minWidth: '180px' }}>
          <label className="filter-label">Tìm Kiếm Task</label>
          <div className="search-input-box-wrap">
            <input
              type="text"
              className="filter-input search-input-ctrl"
              placeholder="Tìm ticket, task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={13} className="search-inline-icon" />
          </div>
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <Clock size={16} color="var(--navy-primary)" />
            <span>Danh Sách Đầu Việc Log Time ({filteredItems.length})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={handleCopyTable}
              title="Sao chép bảng dữ liệu có định dạng bảng hoàn chỉnh (dán trực tiếp vào Teams, Jira, Excel, Word)"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem', padding: '0.25rem 0.65rem' }}
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
                <th>Giờ Đã Log</th>
                <th>Giờ Trả Bill</th>
                <th>Chênh Lệch</th>
                <th>Trạng Thái Task</th>
                <th>Tình Trạng Bill</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Không tìm thấy task nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const isClosed = isStatusClosed(item.status);
                  const isBilled = item.billableHrs > 0 || Boolean(item.billedDate);
                  const itemDelta = Math.round((item.billableHrs - item.loggedHours) * 10) / 10;
                  const badgeClass = getStatusBadgeClass(item.status);

                  return (
                    <tr key={item.key}>
                      {/* Ticket Key */}
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

                      {/* Summary & Project */}
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.2rem' }}>
                          {item.summary}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Folder size={11} />
                          <span>{item.projectName}</span>
                          {item.updatedDate && (
                            <>
                              <span>•</span>
                              <Calendar size={11} />
                              <span>Cập nhật: {item.updatedDate}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Logged Hours */}
                      <td>
                        <span className="badge-logged" style={{ fontWeight: 700 }}>
                          {selectedMonth !== 'ALL' && item.worklogsByMonth?.[selectedMonth] !== undefined
                            ? `${item.worklogsByMonth[selectedMonth]}h`
                            : `${item.loggedHours}h`}
                        </span>
                      </td>

                      {/* Billable Hours */}
                      <td>
                        {item.billableHrs > 0 ? (
                          <span className="badge-billable" style={{ fontWeight: 700 }}>
                            {item.billableHrs}h
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                            Chưa có
                          </span>
                        )}
                      </td>

                      {/* Delta */}
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', fontWeight: 700 }}>
                        {item.billableHrs > 0 ? (
                          <span style={{ color: itemDelta >= 0 ? 'var(--emerald-text)' : 'var(--rose-accent)' }}>
                            {itemDelta >= 0 ? `+${itemDelta}h` : `${itemDelta}h`}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>-</span>
                        )}
                      </td>

                      {/* Task Status */}
                      <td>
                        <span className={`badge-status ${badgeClass}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          {isClosed ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                          <span>{item.status}</span>
                        </span>
                      </td>

                      {/* Bill Status */}
                      <td>
                        {isBilled ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '9999px',
                            background: 'var(--emerald-pastel)',
                            color: 'var(--emerald-text)'
                          }}>
                            <DollarSign size={11} />
                            <span>Đã trả bill</span>
                            {item.billedMonth && item.billedMonth !== 'Chưa gắn kỳ' && (
                              <span style={{ opacity: 0.8, fontSize: '0.7rem' }}>({item.billedMonth})</span>
                            )}
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '9999px',
                            background: 'var(--amber-pastel)',
                            color: 'var(--amber-text)'
                          }}>
                            <AlertCircle size={11} />
                            <span>Chưa có bill</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
