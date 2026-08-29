#!/usr/bin/env node

/**
 * Billable Hours Analyzer & Dashboard Generator (Exact Jira Schema)
 * Specifically tracks:
 * - customfield_12200: "Billable Hrs" (Official Billed Hours)
 * - customfield_13000: "Asigned Bill To" (Billed Assignee)
 * - customfield_13100: "Billed Date" (Billing Period / Cycle)
 * - timespent: Actual Logged Hours
 */

const fs = require('fs');
const path = require('path');

const VIEWS_DIR = __dirname;
const OUTPUT_HTML = path.join(VIEWS_DIR, 'index.html');
const OUTPUT_JSON = path.join(VIEWS_DIR, 'billable_data.json');

function loadAuthConfig() {
  const jsonPath = path.join(__dirname, '..', 'auth.json');
  const txtPath = path.join(__dirname, '..', 'auth.txt');
  const targetFile = fs.existsSync(jsonPath) ? jsonPath : (fs.existsSync(txtPath) ? txtPath : null);

  if (!targetFile) throw new Error('Auth file not found!');
  const content = fs.readFileSync(targetFile, 'utf-8');
  let token = '', domain = 'https://jira.yourcompany.com';

  try {
    const parsed = JSON.parse(content);
    token = parsed.token || parsed.jiraToken || '';
    domain = parsed.domain || parsed.jiraDomain || domain;
  } catch (e) {
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('token:')) token = trimmed.replace('token:', '').trim();
      else if (trimmed.startsWith('domain jira:')) domain = trimmed.replace('domain jira:', '').trim();
    });
  }

  if (!token) throw new Error('Token not found in auth file!');
  return { token, domain: domain.replace(/\/+$/, '') };
}

async function jiraRequest(url, token) {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error(`Jira API error ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

async function fetchAllBillableData(domain, token) {
  const user = await jiraRequest(`${domain}/rest/api/2/myself`, token);
  console.log(`👤 User: ${user.displayName} (${user.name})`);

  // Query issues where Asigned Bill To is current user OR user has worklog on issue with Billable Hrs
  const jql = encodeURIComponent(`"Asigned Bill To" = currentUser() OR ("Billable Hrs" > 0 AND worklogAuthor = currentUser()) OR worklogAuthor = currentUser()`);
  
  let startAt = 0;
  const maxResults = 100;
  let allIssues = [];

  while (true) {
    const url = `${domain}/rest/api/2/search?jql=${jql}&startAt=${startAt}&maxResults=${maxResults}&fields=key,summary,project,timespent,aggregatetimespent,status,issuetype,customfield_12200,customfield_13000,customfield_13100,customfield_10402`;
    const data = await jiraRequest(url, token);
    allIssues = allIssues.concat(data.issues || []);
    if (startAt + maxResults >= data.total) break;
    startAt += maxResults;
  }

  console.log(`📦 Fetched ${allIssues.length} relevant issues from Jira`);

  const billableList = [];

  for (const issue of allIssues) {
    const billableHrs = Number(issue.fields.customfield_12200) || 0;
    const assignedBillToObj = issue.fields.customfield_13000;
    const isAssignedToUser = assignedBillToObj && (
      assignedBillToObj.name === user.name ||
      assignedBillToObj.displayName === user.displayName ||
      assignedBillToObj.key === user.key
    );
    const assignedBillToName = assignedBillToObj?.displayName || (isAssignedToUser ? user.displayName : 'Unassigned');
    const billedDate = issue.fields.customfield_13100 || '';
    const leaderEstimate = Number(issue.fields.customfield_10402) || 0;
    const loggedHours = Math.round(((issue.fields.timespent || 0) / 3600) * 100) / 100;
    const project = issue.fields.project || {};

    // Determine billing month cycle
    let billedMonth = '';
    if (billedDate) {
      billedMonth = billedDate.substring(0, 7);
    }

    billableList.push({
      key: issue.key,
      summary: issue.fields.summary,
      projectName: project.name || project.key,
      projectKey: project.key,
      status: issue.fields.status?.name || 'In Progress',
      issueType: issue.fields.issuetype?.name || 'Task',
      billableHrs: Math.round(billableHrs * 100) / 100,
      assignedBillTo: assignedBillToName,
      isAssignedToMe: !!isAssignedToUser,
      billedDate,
      billedMonth,
      leaderEstimate,
      loggedHours
    });
  }

  // Sort by Billed Date or Key descending
  billableList.sort((a, b) => (b.billedDate || '').localeCompare(a.billedDate || '') || b.key.localeCompare(a.key));

  return { user, domain, billableList };
}

function generateHtmlDashboard(data) {
  const { user, domain, billableList } = data;

  // Filter items specifically assigned to user for billing OR where billableHrs > 0
  const myBillableItems = billableList.filter(item => item.isAssignedToMe || item.billableHrs > 0);

  const totalBillableHrs = myBillableItems.reduce((acc, item) => acc + item.billableHrs, 0);
  const totalLoggedHrs = myBillableItems.reduce((acc, item) => acc + item.loggedHours, 0);

  // Group by Billed Month
  const monthlyStats = {};
  myBillableItems.forEach(item => {
    const m = item.billedMonth || 'Chưa gắn kỳ Bill';
    if (!monthlyStats[m]) {
      monthlyStats[m] = { month: m, billableHrs: 0, loggedHours: 0, count: 0 };
    }
    monthlyStats[m].billableHrs += item.billableHrs;
    monthlyStats[m].loggedHours += item.loggedHours;
    monthlyStats[m].count++;
  });

  // Group by Project
  const projectStats = {};
  myBillableItems.forEach(item => {
    const pKey = item.projectKey || 'Other';
    if (!projectStats[pKey]) {
      projectStats[pKey] = {
        key: pKey,
        name: item.projectName,
        billableHrs: 0,
        loggedHours: 0,
        count: 0
      };
    }
    projectStats[pKey].billableHrs += item.billableHrs;
    projectStats[pKey].loggedHours += item.loggedHours;
    projectStats[pKey].count++;
  });

  const rawJson = JSON.stringify(myBillableItems);

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Báo Cáo Billable Hours - ${user.displayName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: rgba(20, 27, 45, 0.75);
      --card-border: rgba(255, 255, 255, 0.08);
      --card-hover: rgba(28, 38, 65, 0.9);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent-blue: #3b82f6;
      --accent-cyan: #06b6d4;
      --accent-emerald: #10b981;
      --accent-amber: #f59e0b;
      --accent-purple: #8b5cf6;
      --accent-glow: rgba(16, 185, 129, 0.15);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.12) 0px, transparent 50%),
        radial-gradient(at 100% 0%, rgba(59, 130, 246, 0.12) 0px, transparent 50%),
        radial-gradient(at 50% 100%, rgba(139, 92, 246, 0.08) 0px, transparent 50%);
      background-attachment: fixed;
      color: var(--text-main);
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      min-height: 100vh;
      padding: 2.5rem 2rem;
      line-height: 1.6;
    }

    .container { max-width: 1400px; margin: 0 auto; }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--card-border);
      flex-wrap: wrap;
      gap: 1.5rem;
    }

    .header-title h1 {
      font-size: 2.1rem;
      font-weight: 800;
      background: linear-gradient(135deg, #34d399 0%, #38bdf8 50%, #818cf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.02em;
    }

    .header-title p {
      color: var(--text-muted);
      font-size: 0.95rem;
      margin-top: 0.3rem;
    }

    .user-badge {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: var(--card-bg);
      padding: 0.65rem 1.3rem;
      border-radius: 9999px;
      border: 1px solid var(--card-border);
      backdrop-filter: blur(12px);
    }

    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #10b981, #3b82f6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: white;
      font-size: 1.1rem;
    }

    .user-info .name { font-weight: 700; color: var(--text-main); font-size: 0.95rem; }
    .user-info .sub { font-size: 0.78rem; color: var(--accent-emerald); }

    /* Stat Cards */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2.5rem;
    }

    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 1.25rem;
      padding: 1.6rem;
      backdrop-filter: blur(16px);
      position: relative;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .stat-card:hover {
      transform: translateY(-4px);
      border-color: rgba(16, 185, 129, 0.3);
      box-shadow: 0 12px 28px -10px var(--accent-glow);
    }

    .stat-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; height: 3px;
      background: var(--gradient, linear-gradient(90deg, #10b981, #06b6d4));
    }

    .stat-label {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      font-weight: 600;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .stat-value {
      font-size: 2.4rem;
      font-weight: 800;
      color: var(--text-main);
      display: flex;
      align-items: baseline;
      gap: 0.4rem;
    }

    .stat-value span { font-size: 1.05rem; font-weight: 500; color: var(--text-muted); }
    .stat-sub { margin-top: 0.5rem; font-size: 0.82rem; color: var(--accent-emerald); font-weight: 500; }

    /* Main Grid */
    .main-grid {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 2rem;
      margin-bottom: 2.5rem;
    }

    @media (max-width: 1080px) {
      .main-grid { grid-template-columns: 1fr; }
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 1.25rem;
      padding: 1.75rem;
      backdrop-filter: blur(16px);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .card-title {
      font-size: 1.2rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .controls-bar { display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; }

    .search-box { position: relative; flex: 1; min-width: 220px; }
    .search-box input {
      width: 100%;
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid var(--card-border);
      color: var(--text-main);
      padding: 0.65rem 1rem 0.65rem 2.4rem;
      border-radius: 0.75rem;
      font-size: 0.88rem;
      outline: none;
    }
    .search-box input:focus {
      border-color: var(--accent-emerald);
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
    }
    .search-icon {
      position: absolute; left: 0.8rem; top: 50%;
      transform: translateY(-50%); color: var(--text-muted); font-size: 0.9rem;
    }

    .select-dropdown {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid var(--card-border);
      color: var(--text-main);
      padding: 0.65rem 1rem;
      border-radius: 0.75rem;
      font-size: 0.88rem;
      outline: none;
      cursor: pointer;
    }

    /* Table */
    .table-container { overflow-x: auto; border-radius: 0.75rem; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.88rem; }
    th {
      background: rgba(15, 23, 42, 0.8);
      color: var(--text-muted);
      font-weight: 600;
      padding: 0.9rem 1rem;
      border-bottom: 1px solid var(--card-border);
      white-space: nowrap;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }
    td { padding: 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.04); color: var(--text-main); }
    tr:hover td { background: rgba(255, 255, 255, 0.025); }

    .ticket-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.6rem;
      background: rgba(59, 130, 246, 0.12);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #93c5fd;
      border-radius: 0.5rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82rem;
      font-weight: 600;
      text-decoration: none;
    }
    .ticket-badge:hover { background: rgba(59, 130, 246, 0.25); color: #fff; }

    .billable-pill {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      color: #34d399;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 0.3rem 0.7rem;
      border-radius: 9999px;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }

    .logged-pill {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 500;
      color: #94a3b8;
      background: rgba(148, 163, 184, 0.1);
      padding: 0.25rem 0.55rem;
      border-radius: 9999px;
      display: inline-block;
      font-size: 0.8rem;
    }

    .status-badge {
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      border-radius: 0.4rem;
      background: rgba(255, 255, 255, 0.06);
      color: #cbd5e1;
      font-weight: 500;
    }

    /* Sidebar Items */
    .project-list { display: flex; flex-direction: column; gap: 1rem; }
    .project-item {
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid var(--card-border);
      border-radius: 0.85rem;
      padding: 1.1rem;
      transition: all 0.2s;
    }
    .project-item:hover {
      border-color: rgba(16, 185, 129, 0.3);
      background: rgba(15, 23, 42, 0.8);
    }
    .project-name {
      font-weight: 600; font-size: 0.92rem;
      margin-bottom: 0.35rem; color: var(--text-main);
      display: flex; justify-content: space-between; align-items: center;
    }
    .project-progress-bar {
      height: 6px; background: rgba(255, 255, 255, 0.08);
      border-radius: 9999px; overflow: hidden; margin: 0.65rem 0;
    }
    .project-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #06b6d4);
      border-radius: 9999px;
    }
    .project-stats { display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted); }

    .info-banner {
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      border-radius: 1rem;
      padding: 1rem 1.25rem;
      margin-bottom: 2rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.9rem;
      color: #a7f3d0;
    }

    footer {
      text-align: center;
      padding: 2rem 0 1rem;
      color: var(--text-muted);
      font-size: 0.85rem;
      border-top: 1px solid var(--card-border);
    }
  </style>
</head>
<body>

<div class="container">
  <header>
    <div class="header-title">
      <h1>💵 Báo Cáo Billable Hours Chính Thức</h1>
      <p>Trích xuất từ trường <b>Billable Hrs</b> (<code>customfield_12200</code>) & <b>Asigned Bill To</b> trên Jira</p>
    </div>
    <div class="user-badge">
      <div class="user-avatar">${user.displayName.charAt(0)}</div>
      <div class="user-info">
        <div class="name">${user.displayName}</div>
        <div class="sub">Asigned Bill To: ${user.displayName}</div>
      </div>
    </div>
  </header>

  <div class="info-banner">
    <span>💡</span>
    <div>
      <b>Ghi chú chuẩn:</b> Dữ liệu dưới đây hiển thị chính xác số giờ <b>Billable Hrs</b> được khách hàng/công ty nghiệm thu thanh toán cho bạn (khác với số giờ Logged thực tế).
    </div>
  </div>

  <!-- Stat Cards -->
  <div class="stats-grid">
    <div class="stat-card" style="--gradient: linear-gradient(90deg, #10b981, #06b6d4)">
      <div class="stat-label">💵 Tổng Billable Hours</div>
      <div class="stat-value">${Math.round(totalBillableHrs * 10) / 10} <span>giờ</span></div>
      <div class="stat-sub">🏆 Được ghi nhận chính thức</div>
    </div>

    <div class="stat-card" style="--gradient: linear-gradient(90deg, #3b82f6, #8b5cf6)">
      <div class="stat-label">⏱️ Tổng Giờ Đã Log (Actual)</div>
      <div class="stat-value">${Math.round(totalLoggedHrs * 10) / 10} <span>giờ</span></div>
      <div class="stat-sub" style="color: var(--accent-cyan)">📦 ${myBillableItems.length} đầu việc có gắn Billable</div>
    </div>

    <div class="stat-card" style="--gradient: linear-gradient(90deg, #f59e0b, #ec4899)">
      <div class="stat-label">📅 Billable Tháng 08/2026</div>
      <div class="stat-value">${monthlyStats['2026-08'] ? Math.round(monthlyStats['2026-08'].billableHrs * 10) / 10 : 0} <span>giờ</span></div>
      <div class="stat-sub" style="color: var(--accent-emerald)">Kỳ Billed Date: 2026-08-31</div>
    </div>

    <div class="stat-card" style="--gradient: linear-gradient(90deg, #8b5cf6, #3b82f6)">
      <div class="stat-label">🎯 Tổng Dự Án Có Billable</div>
      <div class="stat-value">${Object.keys(projectStats).length} <span>projects</span></div>
      <div class="stat-sub" style="color: #cbd5e1">Dự án khách hàng</div>
    </div>
  </div>

  <!-- Main Content Grid -->
  <div class="main-grid">
    <!-- Left Table -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <span>📋</span> Danh Sách Task Có Billable Hours
        </div>
        <div class="controls-bar">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" id="searchInput" placeholder="Tìm kiếm theo ticket, tên task..." oninput="filterTable()">
          </div>
          <select id="monthFilter" class="select-dropdown" onchange="filterTable()">
            <option value="ALL">Tất cả kỳ Billed</option>
            ${Object.keys(monthlyStats).sort().reverse().map(m => `<option value="${m}" ${m === '2026-08' ? 'selected' : ''}>Kỳ ${m}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="table-container">
        <table id="worklogTable">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Tên Task / Feature</th>
              <th>Kỳ Billed Date</th>
              <th>Billable Hrs</th>
              <th>Giờ Logged</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody id="tableBody">
            <!-- Rendered by JS -->
          </tbody>
        </table>
      </div>
    </div>

    <!-- Right Sidebar: Project Breakdown -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <span>📁</span> Billable Theo Dự Án
        </div>
      </div>
      <div class="project-list">
        ${Object.values(projectStats).sort((a, b) => b.billableHrs - a.billableHrs).map(p => {
          const percent = totalBillableHrs > 0 ? Math.round((p.billableHrs / totalBillableHrs) * 100) : 0;
          return `
          <div class="project-item">
            <div class="project-name">
              <span>${p.name}</span>
              <span class="billable-pill" style="padding:0.15rem 0.5rem; font-size:0.8rem">${Math.round(p.billableHrs * 10) / 10}h</span>
            </div>
            <div class="project-progress-bar">
              <div class="project-progress-fill" style="width: ${percent}%"></div>
            </div>
            <div class="project-stats">
              <span>${p.count} tasks</span>
              <span style="color: var(--accent-emerald)">${percent}% tổng billable</span>
            </div>
          </div>
          `;
        }).join('')}
      </div>
    </div>
  </div>

  <footer>
    Trích xuất trực tiếp từ Jira Server (${domain}) • Báo cáo trường Billable Hrs (customfield_12200) của ${user.displayName}
  </footer>
</div>

<script>
  const items = ${rawJson};
  const domain = "${domain}";

  function renderTable(list) {
    const tbody = document.getElementById('tableBody');
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted)">Không tìm thấy task nào phù hợp.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(item => \`
      <tr>
        <td style="white-space: nowrap;">
          <a href="\${domain}/browse/\${item.key}" target="_blank" class="ticket-badge">
            \${item.key}
          </a>
        </td>
        <td>
          <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.2rem;">\${escapeHtml(item.summary)}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">\${escapeHtml(item.projectName)}</div>
        </td>
        <td style="white-space: nowrap; font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; color: var(--text-muted);">
          \${item.billedDate || '<span style="color:#64748b">Chưa gắn</span>'}
        </td>
        <td>
          <span class="billable-pill">💵 \${item.billableHrs}h</span>
        </td>
        <td>
          <span class="logged-pill">\${item.loggedHours}h</span>
        </td>
        <td>
          <span class="status-badge">\${escapeHtml(item.status)}</span>
        </td>
      </tr>
    \`).join('');
  }

  function filterTable() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const selectedMonth = document.getElementById('monthFilter').value;

    const filtered = items.filter(item => {
      const matchesQuery = !query || 
        item.key.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query) ||
        item.projectName.toLowerCase().includes(query);

      const matchesMonth = selectedMonth === 'ALL' || item.billedMonth === selectedMonth || (!item.billedMonth && selectedMonth === 'Chưa gắn kỳ Bill');

      return matchesQuery && matchesMonth;
    });

    renderTable(filtered);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  filterTable();
</script>

</body>
</html>`;
}

async function main() {
  const { token, domain } = loadAuthConfig();
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║         BILLABLE HOURS ANALYZER (CUSTOMFIELD_12200)               ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log(`🌐 Connecting to Jira: ${domain}...`);

  const data = await fetchAllBillableData(domain, token);
  const { user, billableList } = data;

  const myItems = billableList.filter(item => item.isAssignedToMe || item.billableHrs > 0);
  const totalBillableHrs = myItems.reduce((acc, item) => acc + item.billableHrs, 0);
  const totalLoggedHrs = myItems.reduce((acc, item) => acc + item.loggedHours, 0);

  console.log('\n📊 SUMMARY OF BILLABLE HOURS:');
  console.log('─'.repeat(55));
  console.log(`👤 User: ${user.displayName}`);
  console.log(`💵 TOTAL BILLABLE HOURS (customfield_12200): ${Math.round(totalBillableHrs * 10) / 10}h`);
  console.log(`⏱️ TOTAL LOGGED HOURS (Time Spent):          ${Math.round(totalLoggedHrs * 10) / 10}h`);
  console.log(`📦 Total Billable Tasks:                     ${myItems.length}\n`);

  // Group by Billed Month
  const monthly = {};
  myItems.forEach(item => {
    const m = item.billedMonth || 'Không có Billed Date';
    if (!monthly[m]) monthly[m] = 0;
    monthly[m] += item.billableHrs;
  });

  console.log('📅 Breakdown by Billed Month:');
  Object.keys(monthly).sort().reverse().forEach(m => {
    console.log(`   - Kỳ ${m}: ${Math.round(monthly[m] * 10) / 10}h`);
  });

  // Save JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(data, null, 2), 'utf-8');

  // Generate HTML Dashboard
  const html = generateHtmlDashboard(data);
  fs.writeFileSync(OUTPUT_HTML, html, 'utf-8');

  console.log('\n' + '═'.repeat(60));
  console.log(`✅ Official Billable Hours Dashboard generated!`);
  console.log(`📁 File location: ${OUTPUT_HTML}`);
  console.log(`🌐 Open in browser to view interactive report.`);
  console.log('═'.repeat(60) + '\n');
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
