#!/usr/bin/env node

/**
 * Jira Assign Tasks Script
 * Assigns specified Jira issues to target assignee username.
 */

const fs = require('fs');
const path = require('path');

const AUTH_FILE = path.join(__dirname, 'auth.json');
const TARGET_USERNAME = process.env.JIRA_ASSIGNEE || 'target_username';

const TICKETS = [
  'PROJ-101',
  'PROJ-102'
];

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

async function assignIssue(domain, token, issueKey, username) {
  const url = `${domain}/rest/api/2/issue/${issueKey}/assignee`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ name: username })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to assign ${issueKey}: ${response.status} ${response.statusText} - ${errText}`);
  }

  return true;
}

async function getIssueDetails(domain, token, issueKey) {
  const url = `${domain}/rest/api/2/issue/${issueKey}?fields=summary,assignee`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  return await response.json();
}

async function main() {
  const { token, domain } = loadAuthConfig();
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                   JIRA TASK ASSIGNMENT TOOL                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log(`\n🎯 Target Assignee: ${TARGET_USERNAME}`);
  console.log(`🌐 Jira Domain: ${domain}`);
  console.log(`📋 Total Tickets: ${TICKETS.length}\n`);

  let successCount = 0;
  let failCount = 0;

  for (const ticket of TICKETS) {
    process.stdout.write(`🔹 Assigning ${ticket}... `);
    try {
      await assignIssue(domain, token, ticket, TARGET_USERNAME);
      const updated = await getIssueDetails(domain, token, ticket);
      const assigneeName = updated.fields?.assignee?.displayName || TARGET_USERNAME;
      const summary = updated.fields?.summary || '';
      console.log(`✅ Success! [${summary}] -> Assigned to: ${assigneeName}`);
      successCount++;
    } catch (err) {
      console.log(`❌ FAILED!`);
      console.error(`   Error: ${err.message}`);
      failCount++;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`🏁 Summary: ${successCount} assigned successfully, ${failCount} failed.`);
  console.log('\n🔗 Check tickets at:');
  TICKETS.forEach(t => console.log(`   - ${t}: ${domain}/browse/${t}`));
  console.log('═'.repeat(60) + '\n');
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
