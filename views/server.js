#!/usr/bin/env node

/**
 * Local Web Server & Jira API Proxy
 * Serves the dashboard on http://localhost:3000 and proxies Jira API requests
 * to avoid CORS restrictions in the browser.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const VIEWS_DIR = __dirname;
const AUTH_FILE = path.join(__dirname, '..', 'auth.json');

function getAuthConfig() {
  if (fs.existsSync(AUTH_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
    } catch (e) {}
  }
  return { token: '', domain: 'https://jira.yourcompany.com' };
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Jira-Domain');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 1. API Proxy endpoint: /api/jira/*
  if (pathname.startsWith('/api/jira/')) {
    const jiraPath = pathname.replace('/api/jira/', '');
    const queryString = parsedUrl.search || '';
    const authConfig = getAuthConfig();

    const authHeader = req.headers['authorization'] || `Bearer ${authConfig.token}`;
    const jiraDomain = (req.headers['x-jira-domain'] || authConfig.domain || 'https://jira.yourcompany.com').replace(/\/+$/, '');

    const targetUrl = `${jiraDomain}/${jiraPath}${queryString}`;

    try {
      const jiraRes = await fetch(targetUrl, {
        method: req.method,
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
          'Content-Type': req.headers['content-type'] || 'application/json'
        }
      });

      const data = await jiraRes.text();
      res.writeHead(jiraRes.status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(data);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 2. API Config endpoint: /api/default-auth
  if (pathname === '/api/default-auth') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getAuthConfig()));
    return;
  }

  // 3. Static Files
  let filePath = path.join(VIEWS_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(VIEWS_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 Jira Analytics Dashboard Server running at: http://localhost:${PORT}`);
  console.log(`📁 Serving directory: ${VIEWS_DIR}`);
  console.log(`🔗 Proxy endpoint: http://localhost:${PORT}/api/jira/\n`);
});
