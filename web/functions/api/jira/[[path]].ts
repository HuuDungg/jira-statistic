/**
 * Cloudflare Pages Functions - Zero-Config Edge Proxy for Jira API
 * Route: /api/jira/*
 * Bypasses CORS by executing on Cloudflare Edge servers.
 */

interface Env {}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, params } = context;

  // Handle CORS preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Jira-Domain',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  const url = new URL(request.url);
  const pathSegments = params.path;
  const pathStr = Array.isArray(pathSegments) ? pathSegments.join('/') : (pathSegments || '');
  const searchStr = url.search || '';

  const jiraDomain = (request.headers.get('x-jira-domain') || '').replace(/\/+$/, '');
  const authHeader = request.headers.get('authorization');

  if (!jiraDomain) {
    return new Response(JSON.stringify({ error: 'Missing X-Jira-Domain header' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  const targetUrl = `${jiraDomain}/${pathStr}${searchStr}`;

  try {
    const fetchHeaders: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': request.headers.get('content-type') || 'application/json'
    };
    if (authHeader) {
      fetchHeaders['Authorization'] = authHeader;
    }

    const jiraResponse = await fetch(targetUrl, {
      method: request.method,
      headers: fetchHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined
    });

    const responseHeaders = new Headers(jiraResponse.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Jira-Domain');

    return new Response(jiraResponse.body, {
      status: jiraResponse.status,
      statusText: jiraResponse.statusText,
      headers: responseHeaders
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
