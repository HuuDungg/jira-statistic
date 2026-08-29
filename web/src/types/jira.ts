export interface JiraUser {
  name: string;
  key?: string;
  displayName: string;
  emailAddress?: string;
  avatarUrls?: {
    '48x48'?: string;
    '32x32'?: string;
    '24x24'?: string;
    '16x16'?: string;
  };
  timeZone?: string;
  active?: boolean;
}

export interface JiraProject {
  id?: string;
  key: string;
  name: string;
  projectCategory?: {
    id: string;
    name: string;
    description: string;
  };
}

export interface JiraIssueRaw {
  id: string;
  key: string;
  fields: {
    summary: string;
    project?: JiraProject;
    status?: {
      name: string;
      statusCategory?: {
        name: string;
        key: string;
      };
    };
    priority?: {
      name: string;
      iconUrl?: string;
    };
    issuetype?: {
      name: string;
      iconUrl?: string;
    };
    duedate?: string | null;
    timespent?: number | null;
    updated?: string;
    created?: string;
    customfield_12200?: number | null; // Billable Hrs
    customfield_13000?: {
      name?: string;
      key?: string;
      displayName?: string;
    } | null; // Asigned Bill To
    customfield_13100?: string | null; // Billed Date
    customfield_10402?: number | null; // Leader Estimate Time (hours)
    customfield_10400?: string | null; // Estimate Time
    worklog?: {
      startAt?: number;
      maxResults?: number;
      total?: number;
      worklogs?: Array<{
        id?: string;
        author?: {
          name?: string;
          key?: string;
          displayName?: string;
        };
        started?: string;
        timeSpentSeconds?: number;
        created?: string;
        updated?: string;
      }>;
    };
  };
}

export interface BillableItem {
  id?: string;
  key: string;
  summary: string;
  projectName: string;
  projectKey: string;
  status: string;
  issueType: string;
  billableHrs: number;
  assignedBillTo: string;
  isAssignedToMe: boolean;
  billedDate: string;
  billedMonth: string;
  billedYear: string;
  leaderEstimate: number;
  loggedHours: number;
  updatedDate: string;
  worklogMonths?: string[];
  worklogYears?: string[];
  worklogsByMonth?: Record<string, number>;
  lastWorklogDate?: string;
}

export interface WorkingTask {
  key: string;
  summary: string;
  projectName: string;
  projectKey: string;
  status: string;
  priority: string;
  billableHrs?: number;
  leaderEstimate?: number;
  loggedHours?: number;
  timeSpentSeconds?: number;
  duedate?: string | null;
  updated: string;
  created: string;
}

export interface AppState {
  user: JiraUser | null;
  domain: string;
  token: string;
  billableItems: BillableItem[];
  workingTasks: WorkingTask[];
  isLoading: boolean;
  error: string | null;
  lastSyncedAt: string | null;
}
