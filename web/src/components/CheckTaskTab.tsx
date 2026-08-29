import React, { useState } from 'react';
import {
  Search,
  ExternalLink,
  Code2,
  DollarSign,
  Clock,
  User,
  Folder,
  Calendar,
  AlertCircle,
  Check,
  Copy,
  X,
  FileText,
  Award
} from 'lucide-react';

interface CheckTaskTabProps {
  domain: string;
}

export const CheckTaskTab: React.FC<CheckTaskTabProps> = ({ domain }) => {
  const [inputUrl, setInputUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [taskData, setTaskData] = useState<any | null>(null);
  const [worklogs, setWorklogs] = useState<any[]>([]);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Extract issue key from URL or string (e.g., https://jira.yourcompany.com/browse/PROJ-102 -> PROJ-102)
  const extractIssueKey = (text: string): string | null => {
    const match = text.match(/([A-Z0-9]+-\d+)/i);
    return match ? match[1].toUpperCase() : null;
  };

  const handleInspect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const key = extractIssueKey(inputUrl);
    if (!key) {
      setError('Vui lòng nhập đường link Jira hợp lệ hoặc mã ticket (Ví dụ: PROJ-101 hoặc https://jira.yourcompany.com/browse/PROJ-101)');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTaskData(null);
    setWorklogs([]);

    try {
      // 1. Fetch Issue Details with expanded metadata
      const issueEndpoint = `/rest/api/2/issue/${key}?expand=renderedFields,names,schema`;
      const targetUrl = `/api/jira${issueEndpoint}`;
      const token = localStorage.getItem('jira_token') || '';

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'X-Jira-Domain': domain
      };

      const issueRes = await fetch(targetUrl, { headers }).catch(() =>
        fetch(`${domain}${issueEndpoint}`, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } })
      );

      if (!issueRes.ok) {
        throw new Error(`Không tìm thấy ticket ${key} hoặc bạn không có quyền truy cập (Mã lỗi: ${issueRes.status})`);
      }

      const issueJson = await issueRes.json();
      setTaskData(issueJson);

      // 2. Fetch Issue Worklogs
      const worklogEndpoint = `/rest/api/2/issue/${key}/worklog`;
      const wlTargetUrl = `/api/jira${worklogEndpoint}`;

      const wlRes = await fetch(wlTargetUrl, { headers }).catch(() =>
        fetch(`${domain}${worklogEndpoint}`, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } })
      );

      if (wlRes.ok) {
        const wlJson = await wlRes.json();
        setWorklogs(wlJson.worklogs || []);
      }

    } catch (err: any) {
      console.error('Inspect error:', err);
      setError(err.message || 'Lỗi khi tải thông tin ticket');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyJSON = () => {
    if (!taskData) return;
    navigator.clipboard.writeText(JSON.stringify(taskData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Field extraction helpers
  const fields = taskData?.fields || {};
  const billableHrs = fields.customfield_12200 != null ? Number(fields.customfield_12200) : null;
  const assignedBillTo = fields.customfield_13000?.displayName || fields.customfield_13000?.name || null;
  const billedDate = fields.customfield_13100 || null;
  const leaderEstimate = fields.customfield_10402 != null ? Number(fields.customfield_10402) : null;
  const estimateTime = fields.customfield_10400 || null;
  const timeSpentSeconds = fields.timespent || 0;
  const loggedHours = Math.round((timeSpentSeconds / 3600) * 100) / 100;
  const statusName = fields.status?.name || 'Open';
  const priorityName = fields.priority?.name || 'Medium';

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title">
          <h2>Kiểm Tra Chi Tiết Task & Billable Hours</h2>
          <p>Dán link Jira hoặc mã ticket bất kỳ để bóc tách toàn bộ thông số, giờ tính phí và raw data</p>
        </div>
      </div>

      {/* Input Search Form */}
      <div className="filter-panel" style={{ padding: '1.25rem' }}>
        <form onSubmit={handleInspect} style={{ display: 'flex', width: '100%', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '320px', position: 'relative' }}>
            <input
              type="text"
              className="filter-input"
              style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.4rem', fontSize: '0.9rem' }}
              placeholder="Dán link Jira (Ví dụ: https://jira.yourcompany.com/browse/PROJ-101) hoặc mã ticket..."
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
            />
            <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>

          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            <Search size={15} />
            <span>{isLoading ? 'Đang kiểm tra...' : 'Kiểm Tra Task'}</span>
          </button>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          background: 'var(--rose-pastel)',
          border: '1px solid #fecdd3',
          color: '#9f1239',
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.88rem'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Task Details Display */}
      {taskData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top Banner: Key, Summary & Actions */}
          <div className="panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                  <a
                    href={`${domain}/browse/${taskData.key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="badge-ticket"
                    style={{ fontSize: '0.92rem', padding: '0.3rem 0.75rem' }}
                  >
                    <span>{taskData.key}</span>
                    <ExternalLink size={13} />
                  </a>
                  <span className="badge-status status-in-progress" style={{ fontSize: '0.8rem' }}>
                    {statusName}
                  </span>
                  <span className="badge-priority prio-medium" style={{ fontSize: '0.8rem' }}>
                    {priorityName}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy-dark)', lineHeight: 1.4 }}>
                  {fields.summary}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Folder size={13} />
                    <span>{fields.project?.name} ({fields.project?.key})</span>
                  </span>
                  <span>•</span>
                  <span>Loại: <b>{fields.issuetype?.name || 'Task'}</b></span>
                </div>
              </div>

              {/* Action: Raw JSON */}
              <div>
                <button className="btn btn-secondary" onClick={() => setIsJsonModalOpen(true)}>
                  <Code2 size={15} />
                  <span>Xem Raw JSON</span>
                </button>
              </div>
            </div>
          </div>

          {/* Key Metrics: Billable Hrs (The Most Important Field) & Estimates */}
          <div className="stats-row">
            {/* 1. Official Billable Hrs (Highlighted) */}
            <div className="stat-card" style={{ '--card-accent': 'var(--emerald-accent)' } as React.CSSProperties}>
              <div className="stat-card-label">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <DollarSign size={15} color="var(--emerald-accent)" strokeWidth={2.5} />
                  <span>Billable Hours (customfield_12200)</span>
                </span>
                <span style={{ color: 'var(--emerald-accent)' }}>Trọng yếu</span>
              </div>
              <div className="stat-card-value" style={{ color: 'var(--emerald-text)' }}>
                <span>{billableHrs != null ? billableHrs : '0'}</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)' }}>giờ</span>
              </div>
              <div className="stat-card-meta" style={{ color: 'var(--emerald-text)' }}>
                <Award size={14} />
                <span>Số giờ nghiệm thu thanh toán chính thức</span>
              </div>
            </div>

            {/* 2. Asigned Bill To */}
            <div className="stat-card" style={{ '--card-accent': 'var(--blue-accent)' } as React.CSSProperties}>
              <div className="stat-card-label">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <User size={15} color="var(--blue-accent)" strokeWidth={2.5} />
                  <span>Asigned Bill To (customfield_13000)</span>
                </span>
                <span>Assignee</span>
              </div>
              <div className="stat-card-value" style={{ fontSize: '1.4rem' }}>
                <span>{assignedBillTo || 'Chưa gán'}</span>
              </div>
              <div className="stat-card-meta" style={{ color: 'var(--text-muted)' }}>
                <span>Người được ghi nhận doanh thu bill</span>
              </div>
            </div>

            {/* 3. Billed Date */}
            <div className="stat-card" style={{ '--card-accent': 'var(--amber-accent)' } as React.CSSProperties}>
              <div className="stat-card-label">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={15} color="var(--amber-accent)" strokeWidth={2.5} />
                  <span>Billed Date (customfield_13100)</span>
                </span>
                <span>Kỳ Bill</span>
              </div>
              <div className="stat-card-value" style={{ fontSize: '1.4rem' }}>
                <span>{billedDate || 'Chưa gắn kỳ'}</span>
              </div>
              <div className="stat-card-meta" style={{ color: 'var(--amber-text)' }}>
                <span>Chu kỳ đối soát với khách hàng</span>
              </div>
            </div>

            {/* 4. Logged vs Estimate */}
            <div className="stat-card" style={{ '--card-accent': 'var(--purple-accent)' } as React.CSSProperties}>
              <div className="stat-card-label">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Clock size={15} color="var(--purple-accent)" strokeWidth={2.5} />
                  <span>Actual Logged (Time Spent)</span>
                </span>
                <span>Worklog</span>
              </div>
              <div className="stat-card-value">
                <span>{loggedHours}</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)' }}>giờ</span>
              </div>
              <div className="stat-card-meta" style={{ color: 'var(--purple-accent)' }}>
                <span>Leader Est: <b>{leaderEstimate != null ? `${leaderEstimate}h` : '0h'}</b></span>
              </div>
            </div>
          </div>

          {/* Details & Worklogs Grid */}
          <div className="dashboard-grid">
            {/* Worklogs on this Ticket */}
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <Clock size={15} color="var(--navy-primary)" />
                  <span>Lịch Sử Worklogs ({worklogs.length} lượt log)</span>
                </div>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Người Log</th>
                      <th>Ngày & Giờ</th>
                      <th>Thời Gian</th>
                      <th>Nội Dung Công Việc (Comment)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {worklogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                          Chưa có lượt worklog nào trên ticket này.
                        </td>
                      </tr>
                    ) : (
                      worklogs.map(wl => (
                        <tr key={wl.id}>
                          <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <User size={13} color="var(--text-muted)" />
                              <span>{wl.author?.displayName || wl.author?.name || 'Unknown'}</span>
                            </div>
                          </td>
                          <td style={{ whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {wl.started ? wl.started.substring(0, 16).replace('T', ' ') : 'N/A'}
                          </td>
                          <td>
                            <span className="badge-logged" style={{ fontWeight: 700 }}>
                              {wl.timeSpent || `${(wl.timeSpentSeconds || 0) / 3600}h`}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.82rem', lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                              {wl.comment || '(Không có comment)'}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Additional Fields Panel */}
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <FileText size={15} color="var(--navy-primary)" />
                  <span>Thông Tin Bổ Sung</span>
                </div>
              </div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Assignee Hiện Tại:</span>
                  <span style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>{fields.assignee?.displayName || 'Chưa gán'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Reporter:</span>
                  <span style={{ fontWeight: 600 }}>{fields.reporter?.displayName || 'N/A'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Estimate Time Text:</span>
                  <span style={{ fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{estimateTime || 'N/A'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Hạn Deadline (Due Date):</span>
                  <span style={{ fontWeight: 600, color: fields.duedate ? 'var(--rose-accent)' : 'inherit' }}>
                    {fields.duedate || 'Không có hạn'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Ngày Tạo (Created):</span>
                  <span>{fields.created ? fields.created.substring(0, 10) : 'N/A'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Cập Nhật Cuối (Updated):</span>
                  <span>{fields.updated ? fields.updated.substring(0, 10) : 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Raw JSON Modal */}
      {isJsonModalOpen && (
        <div className="modal-overlay" onClick={() => setIsJsonModalOpen(false)}>
          <div
            className="modal-box"
            style={{ maxWidth: '820px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title">
                <Code2 size={18} color="var(--navy-primary)" />
                <span>Raw JSON Response ({taskData?.key})</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary btn-sm" onClick={handleCopyJSON}>
                  {copied ? <Check size={14} color="var(--emerald-accent)" /> : <Copy size={14} />}
                  <span>{copied ? 'Đã Copy!' : 'Copy JSON'}</span>
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setIsJsonModalOpen(false)}>
                  <X size={16} />
                </button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: 'var(--navy-dark)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(taskData, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
