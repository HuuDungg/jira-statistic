#!/usr/bin/env node

/**
 * Jira Auto Logtime Script
 * Reads credentials from auth.txt, parses plan from logtim-plan.md,
 * and logs worklogs to Jira Server REST API.
 */

const fs = require('fs');
const path = require('path');

const AUTH_FILE = path.join(__dirname, 'auth.txt');
const PLAN_FILE = path.join(__dirname, 'logtim-plan.md');

// 1. Read Auth Config
function loadAuthConfig() {
  const jsonPath = path.join(__dirname, 'auth.json');
  const txtPath = path.join(__dirname, 'auth.txt');
  const targetFile = fs.existsSync(jsonPath) ? jsonPath : (fs.existsSync(txtPath) ? txtPath : null);

  if (!targetFile) {
    throw new Error(`Auth file not found in ${__dirname}!`);
  }

  const content = fs.readFileSync(targetFile, 'utf-8');
  let token = '';
  let domain = 'https://jira.yourcompany.com';

  try {
    const parsed = JSON.parse(content);
    token = parsed.token || parsed.jiraToken || '';
    domain = parsed.domain || parsed.jiraDomain || domain;
  } catch (e) {
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('token:')) {
        token = trimmed.replace('token:', '').trim();
      } else if (trimmed.startsWith('domain jira:')) {
        domain = trimmed.replace('domain jira:', '').trim();
      }
    });
  }

  if (!token) {
    throw new Error('Token not found in auth file!');
  }

  return { token, domain: domain.replace(/\/+$/, '') };
}

// 2. Parse logtim-plan.md
function parsePlanMarkdown(filePath = PLAN_FILE) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File ${filePath} not found!`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  const days = [];
  let currentDay = null;
  let currentTicket = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    // Detect date header: e.g. "Thứ 6, ngày 07/08/2026 (8h)" or "Thứ 7, ngày 22/08/2026 (8h) - (Đi làm bù)"
    const dateMatch = line.match(/(?:Thứ\s+\d+|Chủ nhật|CN),\s*ngày\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    if (dateMatch) {
      const [_, dayStr, monthStr, yearStr] = dateMatch;
      currentDay = {
        title: line,
        dateStr: `${dayStr}/${monthStr}/${yearStr}`,
        isoDate: `${yearStr}-${monthStr}-${dayStr}`,
        entries: []
      };
      days.push(currentDay);
      currentTicket = null;
      continue;
    }

    // Detect Ticket line: e.g. "Ticket: MAGOA2604GAP-102 (Foundation & Architecture)"
    const ticketMatch = line.match(/^Ticket:\s*([A-Z0-9]+-\d+)/i);
    if (ticketMatch) {
      currentTicket = ticketMatch[1].toUpperCase();
      continue;
    }

    // Detect Worklog entry line: e.g. "4h: 1.1 Project Initialization & ..." or "8h: Tổng kiểm tra chéo..."
    const worklogMatch = line.match(/^(\d+)h:\s*(.+)$/i);
    if (worklogMatch && currentDay) {
      const hours = parseInt(worklogMatch[1], 10);
      const comment = worklogMatch[2].trim();

      if (!currentTicket) {
        console.warn(`[WARN] Found worklog entry without active ticket on ${currentDay.dateStr}: ${line}`);
      }

      currentDay.entries.push({
        ticket: currentTicket,
        hours,
        comment,
        raw: line
      });
      continue;
    }
  }

  // Calculate timestamps for each entry
  days.forEach(day => {
    let currentHour = 8;
    let currentMinute = 30;

    day.entries.forEach((entry, idx) => {
      // If this is the second entry and the first was in the morning (ending around 12:30), start at 13:30
      if (idx > 0 && currentHour >= 12 && currentHour < 13) {
        currentHour = 13;
        currentMinute = 30;
      }

      const hh = String(currentHour).padStart(2, '0');
      const mm = String(currentMinute).padStart(2, '0');
      const started = `${day.isoDate}T${hh}:${mm}:00.000+0700`;
      entry.started = started;
      entry.timeSpentSeconds = entry.hours * 3600;

      // Advance time for next task
      currentHour += entry.hours;
      if (currentHour === 12 && currentMinute === 30) {
        currentHour = 13;
        currentMinute = 30;
      }
    });
  });

  return days;
}

// 3. API Client helper
async function jiraRequest(url, options = {}, token) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(`Jira API Error: ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// 4. Log a single worklog item
async function createWorklog(domain, token, item) {
  const { ticket, started, timeSpentSeconds, hours, comment } = item;
  const url = `${domain}/rest/api/2/issue/${ticket}/worklog`;

  const payload = {
    started,
    timeSpentSeconds,
    comment
  };

  const res = await jiraRequest(url, {
    method: 'POST',
    body: JSON.stringify(payload)
  }, token);

  return res;
}

// 5. Fetch worklogs for checking
async function getTicketWorklogs(domain, token, ticketKey) {
  const url = `${domain}/rest/api/2/issue/${ticketKey}/worklog`;
  return await jiraRequest(url, { method: 'GET' }, token);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const { token, domain } = loadAuthConfig();
  const days = parsePlanMarkdown();

  const isDryRun = args.includes('--dry-run');
  const isCheck = args.includes('--check');
  const allDays = args.includes('--all');

  let limitDays = null;
  const daysArgIdx = args.findIndex(a => a === '--days' || a === '-d');
  if (daysArgIdx !== -1 && args[daysArgIdx + 1]) {
    limitDays = parseInt(args[daysArgIdx + 1], 10);
  }

  const dateArgIdx = args.findIndex(a => a === '--date');
  let targetDate = null;
  if (dateArgIdx !== -1 && args[dateArgIdx + 1]) {
    targetDate = args[dateArgIdx + 1].trim();
  }

  // Handle --check mode
  if (isCheck) {
    console.log(`\n🔍 Checking existing worklogs on Jira (${domain})...\n`);
    const tickets = [...new Set(days.flatMap(d => d.entries.map(e => e.ticket)).filter(Boolean))];
    for (const ticket of tickets) {
      try {
        const data = await getTicketWorklogs(domain, token, ticket);
        console.log(`\n📋 Ticket: ${ticket} (${data.total} worklogs total)`);
        console.log(`   Link: ${domain}/browse/${ticket}`);
        if (data.worklogs && data.worklogs.length > 0) {
          data.worklogs.forEach((w, idx) => {
            const date = w.started ? w.started.substring(0, 10) : 'N/A';
            console.log(`   ${idx + 1}. [${date}] [${w.timeSpent}] By: ${w.author?.displayName || 'Unknown'}`);
            console.log(`      Comment: ${w.comment ? w.comment.substring(0, 80) : '(empty)'}...`);
          });
        } else {
          console.log(`   (No worklogs found)`);
        }
      } catch (err) {
        console.error(`   ❌ Failed to fetch ${ticket}:`, err.message);
      }
    }
    return;
  }

  // Filter days based on CLI args
  let targetDays = days;
  if (targetDate) {
    targetDays = days.filter(d => d.dateStr === targetDate || d.isoDate === targetDate);
  } else if (limitDays && limitDays > 0) {
    targetDays = days.slice(0, limitDays);
  } else if (!allDays && !isDryRun) {
    // Default mode if no flags specified: show instructions
    console.log('╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║                   JIRA AUTO LOGTIME TOOL                          ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝');
    console.log(`\n📄 Parsed ${days.length} days from ${PLAN_FILE}`);
    console.log('\nAvailable commands:');
    console.log('  node logtime.js --dry-run          # Preview all worklogs without sending to Jira');
    console.log('  node logtime.js --days 3           # Log time for the first 3 days');
    console.log('  node logtime.js --all              # Log time for all days in the plan');
    console.log('  node logtime.js --date 07/08/2026  # Log time for a specific date');
    console.log('  node logtime.js --check            # Fetch and display logged worklogs from Jira');
    console.log('\nRun with "--dry-run" or "--days 3" to proceed.\n');
    return;
  }

  console.log(`\n🚀 ${isDryRun ? '[DRY RUN] Previewing' : 'Starting'} Logtime Process...`);
  console.log(`Domain: ${domain}`);
  console.log(`Processing ${targetDays.length} day(s), Total entries: ${targetDays.reduce((acc, d) => acc + d.entries.length, 0)}\n`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  // Cache existing worklogs to prevent duplicates
  const existingWorklogsCache = new Map();
  if (!isDryRun) {
    const allUsedTickets = [...new Set(targetDays.flatMap(d => d.entries.map(e => e.ticket)).filter(Boolean))];
    for (const ticket of allUsedTickets) {
      try {
        const data = await getTicketWorklogs(domain, token, ticket);
        existingWorklogsCache.set(ticket, data.worklogs || []);
      } catch (e) {
        existingWorklogsCache.set(ticket, []);
      }
    }
  }

  for (const day of targetDays) {
    console.log(`\n📅 ${day.title} (${day.dateStr})`);
    console.log('─'.repeat(60));

    for (const entry of day.entries) {
      console.log(`  🔹 Ticket: ${entry.ticket} | ${entry.hours}h | Start: ${entry.started}`);
      console.log(`     Comment: "${entry.comment}"`);

      if (isDryRun) {
        console.log(`     [DRY-RUN] Will POST to ${domain}/rest/api/2/issue/${entry.ticket}/worklog`);
        successCount++;
      } else {
        // Check if already logged (same date AND (exact same comment OR exact same start time))
        const existingList = existingWorklogsCache.get(entry.ticket) || [];
        const isDuplicate = existingList.some(w => {
          const sameDate = w.started && w.started.startsWith(day.isoDate);
          const sameComment = w.comment && (w.comment.trim() === entry.comment.trim());
          const sameTime = w.started && (w.started.substring(11, 16) === entry.started.substring(11, 16));
          return sameDate && (sameComment || sameTime);
        });

        if (isDuplicate) {
          console.log(`     ⏭️ [SKIP] Already logged on Jira on ${day.dateStr}!`);
          skipCount++;
          continue;
        }

        try {
          process.stdout.write(`     ⏳ Logging to Jira... `);
          const result = await createWorklog(domain, token, entry);
          console.log(`✅ Success! (Worklog ID: ${result.id})`);
          successCount++;
          // Add to cache
          existingList.push(result);
          existingWorklogsCache.set(entry.ticket, existingList);
        } catch (err) {
          console.log(`❌ FAILED!`);
          console.error(`     Error: ${err.message}`);
          if (err.data) {
            console.error(`     Details:`, JSON.stringify(err.data, null, 2));
          }
          failCount++;
        }
      }
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`🏁 Summary: ${successCount} logged, ${skipCount} skipped (already exists), ${failCount} failed.`);

  if (!isDryRun) {
    console.log('\n🔗 Check your worklogs at:');
    const usedTickets = [...new Set(targetDays.flatMap(d => d.entries.map(e => e.ticket)).filter(Boolean))];
    usedTickets.forEach(ticket => {
      console.log(`   - ${ticket}: ${domain}/browse/${ticket}`);
    });
  }
  console.log('═'.repeat(60) + '\n');
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
