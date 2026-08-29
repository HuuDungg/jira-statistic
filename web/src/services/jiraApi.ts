import type { JiraUser, JiraIssueRaw, BillableItem, WorkingTask } from '../types/jira';

export class JiraApiService {
  private domain: string;
  private token: string;

  constructor(domain: string = '', token: string = '') {
    this.domain = domain.replace(/\/+$/, '');
    this.token = token;
  }

  setCredentials(domain: string, token: string) {
    this.domain = domain.replace(/\/+$/, '');
    this.token = token;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.domain || !this.token) {
      throw new Error('Chưa cấu hình Jira Domain hoặc Token.');
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const targetUrl = `/api/jira${cleanEndpoint}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Jira-Domain': this.domain
    };

    try {
      const response = await fetch(targetUrl, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers as Record<string, string> || {})
        }
      });

      if (!response.ok) {
        // Fallback: If proxy returns 404/500 (e.g. running from file://), try direct call
        if (response.status === 404 || response.status === 502) {
          const directRes = await fetch(`${this.domain}${cleanEndpoint}`, {
            ...options,
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          if (directRes.ok) return await directRes.json();
        }
        throw new Error(`Jira API HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (err: any) {
      console.error('Jira API Request error:', err);
      throw err;
    }
  }

  async getCurrentUser(): Promise<JiraUser> {
    return await this.request('/rest/api/2/myself');
  }

  async getWorkingTasks(): Promise<WorkingTask[]> {
    const jql = encodeURIComponent('assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC');
    const endpoint = `/rest/api/2/search?jql=${jql}&maxResults=100&fields=key,summary,project,status,priority,duedate,customfield_10402,customfield_12200,timespent,updated,created`;
    const data = await this.request(endpoint);

    const issues: JiraIssueRaw[] = data.issues || [];
    return issues.map(issue => {
      const timespentSec = issue.fields.timespent || 0;
      const loggedHours = Math.round((timespentSec / 3600) * 100) / 100;

      return {
        key: issue.key,
        summary: issue.fields.summary || '',
        projectName: issue.fields.project?.name || issue.fields.project?.key || 'Khác',
        projectKey: issue.fields.project?.key || 'OTHER',
        status: issue.fields.status?.name || 'Open',
        priority: issue.fields.priority?.name || 'Medium',
        billableHrs: issue.fields.customfield_12200 != null ? Number(issue.fields.customfield_12200) : undefined,
        leaderEstimate: issue.fields.customfield_10402 != null ? Number(issue.fields.customfield_10402) : undefined,
        loggedHours,
        timeSpentSeconds: timespentSec,
        duedate: issue.fields.duedate || null,
        updated: issue.fields.updated ? issue.fields.updated.substring(0, 10) : '',
        created: issue.fields.created ? issue.fields.created.substring(0, 10) : ''
      };
    });
  }

  async getBillableAndWorklogItems(currentUser: JiraUser): Promise<BillableItem[]> {
    const jql = encodeURIComponent('"Asigned Bill To" = currentUser() OR ("Billable Hrs" > 0 AND worklogAuthor = currentUser()) OR worklogAuthor = currentUser()');
    let startAt = 0;
    const maxResults = 100;
    let allIssues: JiraIssueRaw[] = [];

    while (true) {
      const endpoint = `/rest/api/2/search?jql=${jql}&startAt=${startAt}&maxResults=${maxResults}&fields=key,summary,project,timespent,status,issuetype,customfield_12200,customfield_13000,customfield_13100,customfield_10402,updated,worklog`;
      const data = await this.request(endpoint);
      allIssues = allIssues.concat(data.issues || []);
      if (startAt + maxResults >= (data.total || 0) || !data.issues || data.issues.length === 0) {
        break;
      }
      startAt += maxResults;
    }

    const userName = currentUser.name;
    const userDisplayName = currentUser.displayName;
    const userKey = currentUser.key;

    return allIssues.map(issue => {
      const billableHrs = Number(issue.fields?.customfield_12200) || 0;
      const assignedBillToObj = issue.fields?.customfield_13000;
      const isAssignedToMe = Boolean(
        assignedBillToObj && (
          assignedBillToObj.name === userName ||
          assignedBillToObj.displayName === userDisplayName ||
          assignedBillToObj.key === userKey
        )
      );

      const billedDate = issue.fields?.customfield_13100 || '';
      const billedMonth = billedDate ? billedDate.substring(0, 7) : 'Chưa gắn kỳ';
      const billedYear = billedDate ? billedDate.substring(0, 4) : 'Khác';
      const loggedHours = Math.round(((issue.fields?.timespent || 0) / 3600) * 100) / 100;
      const project = issue.fields?.project || { key: 'OTHER', name: 'Khác' };

      // Parse worklogs to find actual working months and hours
      const worklogObj = issue.fields?.worklog;
      const worklogsList: any[] = worklogObj?.worklogs || [];
      const worklogsByMonth: Record<string, number> = {};
      const worklogMonthsSet = new Set<string>();
      const worklogYearsSet = new Set<string>();
      let lastWorklogDate = '';

      worklogsList.forEach((w: any) => {
        const isAuthor = !w.author ||
          w.author.name === userName ||
          w.author.displayName === userDisplayName ||
          w.author.key === userKey;

        if (isAuthor && w.started) {
          const startedDate = w.started.substring(0, 10);
          const startedMonth = startedDate.substring(0, 7);
          const startedYear = startedDate.substring(0, 4);
          const hours = Math.round(((w.timeSpentSeconds || 0) / 3600) * 100) / 100;

          worklogsByMonth[startedMonth] = Math.round(((worklogsByMonth[startedMonth] || 0) + hours) * 100) / 100;
          worklogMonthsSet.add(startedMonth);
          worklogYearsSet.add(startedYear);

          if (!lastWorklogDate || startedDate > lastWorklogDate) {
            lastWorklogDate = startedDate;
          }
        }
      });

      return {
        id: issue.id,
        key: issue.key,
        summary: issue.fields?.summary || '',
        projectName: project.name || project.key,
        projectKey: project.key,
        status: issue.fields?.status?.name || 'Open',
        issueType: issue.fields?.issuetype?.name || 'Task',
        billableHrs: Math.round(billableHrs * 100) / 100,
        assignedBillTo: assignedBillToObj?.displayName || (isAssignedToMe ? userDisplayName : 'Chưa gán'),
        isAssignedToMe,
        billedDate,
        billedMonth,
        billedYear,
        leaderEstimate: Number(issue.fields?.customfield_10402) || 0,
        loggedHours,
        updatedDate: issue.fields?.updated ? issue.fields.updated.substring(0, 10) : '',
        worklogMonths: [...worklogMonthsSet],
        worklogYears: [...worklogYearsSet],
        worklogsByMonth,
        lastWorklogDate
      };
    }).sort((a, b) => (b.billedDate || '').localeCompare(a.billedDate || '') || b.key.localeCompare(a.key));
  }
}

export const jiraApi = new JiraApiService();
