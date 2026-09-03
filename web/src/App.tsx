import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { TermsModal } from './components/TermsModal';
import { AnalyticsTab } from './components/AnalyticsTab';
import { LogtimeTab } from './components/LogtimeTab';
import { TaskWorkingTab } from './components/TaskWorkingTab';
import { CheckTaskTab } from './components/CheckTaskTab';
import type { JiraUser, BillableItem, WorkingTask } from './types/jira';
import { jiraApi } from './services/jiraApi';
import { Key, ShieldCheck, ArrowRight, RefreshCw } from 'lucide-react';

const AUTO_SYNC_INTERVAL_SEC = 300; // 5 minutes
const CACHE_KEY_DATA = 'jira_cache_data_v1';
const CACHE_KEY_TIME = 'jira_cache_time_v1';

interface CachedData {
  user: JiraUser | null;
  billableItems: BillableItem[];
  workingTasks: WorkingTask[];
}

/**
 * Load cached data and compute remaining countdown seconds from localStorage
 */
function loadLocalCache(): { data: CachedData | null; remainingSec: number } {
  try {
    const timeStr = localStorage.getItem(CACHE_KEY_TIME);
    const rawData = localStorage.getItem(CACHE_KEY_DATA);

    if (!timeStr || !rawData) {
      return { data: null, remainingSec: AUTO_SYNC_INTERVAL_SEC };
    }

    const lastSyncTime = parseInt(timeStr, 10);
    if (isNaN(lastSyncTime)) {
      return { data: null, remainingSec: AUTO_SYNC_INTERVAL_SEC };
    }

    const elapsedSec = Math.floor((Date.now() - lastSyncTime) / 1000);
    const remainingSec = AUTO_SYNC_INTERVAL_SEC - elapsedSec;

    if (remainingSec > 0) {
      const data: CachedData = JSON.parse(rawData);
      return { data, remainingSec };
    }

    return { data: null, remainingSec: AUTO_SYNC_INTERVAL_SEC };
  } catch (err) {
    console.error('Error reading cache:', err);
    return { data: null, remainingSec: AUTO_SYNC_INTERVAL_SEC };
  }
}

/**
 * Save fresh data and timestamp to localStorage
 */
function saveLocalCache(user: JiraUser | null, billableItems: BillableItem[], workingTasks: WorkingTask[]) {
  try {
    const cache: CachedData = { user, billableItems, workingTasks };
    localStorage.setItem(CACHE_KEY_DATA, JSON.stringify(cache));
    localStorage.setItem(CACHE_KEY_TIME, Date.now().toString());
  } catch (err) {
    console.error('Error saving cache:', err);
  }
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'logtime' | 'tasks' | 'check'>('analytics');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Initialize state from local cache on startup
  const initialCache = loadLocalCache();
  const [countdown, setCountdown] = useState<number>(initialCache.remainingSec);
  const [domain, setDomain] = useState<string>(() => localStorage.getItem('jira_domain') || '');
  const [token, setToken] = useState<string>(() => localStorage.getItem('jira_token') || '');
  const [user, setUser] = useState<JiraUser | null>(initialCache.data?.user || null);
  const [billableItems, setBillableItems] = useState<BillableItem[]>(initialCache.data?.billableItems || []);
  const [workingTasks, setWorkingTasks] = useState<WorkingTask[]>(initialCache.data?.workingTasks || []);

  // Check Terms acceptance on mount
  useEffect(() => {
    const hasAcceptedTerms = localStorage.getItem('jira_terms_accepted_v1');
    if (!hasAcceptedTerms) {
      setIsTermsModalOpen(true);
    }
  }, []);

  // Sync Live Data from Jira API & update localStorage cache
  const handleLiveSync = useCallback(async () => {
    const currentToken = token || localStorage.getItem('jira_token');
    const currentDomain = domain || localStorage.getItem('jira_domain');

    if (!currentToken || !currentDomain) {
      setIsAuthModalOpen(true);
      return;
    }

    setIsLoading(true);

    jiraApi.setCredentials(currentDomain, currentToken);

    try {
      // 1. Fetch Profile
      const currentUser = await jiraApi.getCurrentUser();
      setUser(currentUser);

      // 2. Fetch Working Tasks
      const tasks = await jiraApi.getWorkingTasks();
      setWorkingTasks(tasks);

      // 3. Fetch Billable Items
      const billables = await jiraApi.getBillableAndWorklogItems(currentUser);
      setBillableItems(billables);

      // 4. Save to local cache
      saveLocalCache(currentUser, billables, tasks);
      setCountdown(AUTO_SYNC_INTERVAL_SEC);

    } catch (err: any) {
      console.error('Sync failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token, domain]);

  // Initial load check on mount: If cache is still within countdown interval, DO NOT refetch on F5
  useEffect(() => {
    const savedToken = localStorage.getItem('jira_token');
    const savedDomain = localStorage.getItem('jira_domain');

    if (savedToken && savedDomain) {
      setToken(savedToken);
      setDomain(savedDomain);
      jiraApi.setCredentials(savedDomain, savedToken);

      const { data, remainingSec } = loadLocalCache();
      if (data && remainingSec > 0) {
        setUser(data.user);
        setBillableItems(data.billableItems);
        setWorkingTasks(data.workingTasks);
        setCountdown(remainingSec);
      } else {
        // Cache expired or missing -> fetch fresh
        handleLiveSync();
      }
    }
  }, [handleLiveSync]);

  // Auto-sync countdown timer (only runs when configured)
  useEffect(() => {
    if (!token && !localStorage.getItem('jira_token')) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          handleLiveSync();
          return AUTO_SYNC_INTERVAL_SEC;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [handleLiveSync, token]);

  // Handle Auth Form Submission
  const handleAuthSubmit = async (newDomain: string, newToken: string) => {
    setDomain(newDomain);
    setToken(newToken);
    localStorage.setItem('jira_token', newToken);
    localStorage.setItem('jira_domain', newDomain);

    // Clear old cache for new credentials
    localStorage.removeItem(CACHE_KEY_DATA);
    localStorage.removeItem(CACHE_KEY_TIME);

    jiraApi.setCredentials(newDomain, newToken);
    setIsAuthModalOpen(false);

    await handleLiveSync();
  };

  // Handle Terms Acceptance
  const handleAcceptTerms = () => {
    localStorage.setItem('jira_terms_accepted_v1', 'true');
    setIsTermsModalOpen(false);
  };

  const isConfigured = Boolean(token || localStorage.getItem('jira_token'));

  return (
    <div className="app-layout">
      {/* Top Loading Progress Bar */}
      {isLoading && <div className="top-loader-bar" />}

      {/* Floating Syncing Toast */}
      {isLoading && (
        <div className="sync-toast">
          <RefreshCw size={15} className="animate-spin" color="var(--navy-primary)" />
          <span>Đang đồng bộ dữ liệu mới từ Jira...</span>
        </div>
      )}

      {/* Top Navigation with Auto-Sync Countdown */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={user}
        domain={domain}
        workingTasksCount={workingTasks.length}
        isLoading={isLoading}
        countdown={countdown}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onSync={handleLiveSync}
      />

      {/* Main Content */}
      <main className="main-container">
        {!isConfigured ? (
          /* Empty State - Prompt user to enter credentials */
          <div style={{
            maxWidth: '680px',
            margin: '4rem auto',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '3rem 2rem',
            textAlign: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'var(--navy-light)',
              color: 'var(--navy-primary)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem'
            }}>
              <Key size={28} strokeWidth={2.2} />
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--navy-dark)', marginBottom: '0.5rem' }}>
              Chào mừng bạn đến với Jira Analytics Pro
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '2rem' }}>
              Ứng dụng client-side độc lập, hoàn toàn bảo mật. Dữ liệu chỉ được kéo về trình duyệt sau khi bạn thiết lập Jira Domain và Personal Access Token.
            </p>

            <button
              className="btn btn-primary"
              style={{ fontSize: '0.95rem', padding: '0.75rem 1.5rem' }}
              onClick={() => setIsAuthModalOpen(true)}
            >
              <span>Thiết Lập Domain &amp; API Key Ngay</span>
              <ArrowRight size={16} />
            </button>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '2.5rem', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <ShieldCheck size={14} color="var(--emerald-accent)" />
                <span>100% Lưu trữ tại LocalStorage</span>
              </span>
              <span>•</span>
              <span>0% Thu thập dữ liệu</span>
            </div>
          </div>
        ) : (
          /* Active Tabs */
          <>
            {activeTab === 'analytics' && (
              <AnalyticsTab
                items={billableItems}
                domain={domain}
                userName={user?.name}
                isLoading={isLoading}
              />
            )}

            {activeTab === 'logtime' && (
              <LogtimeTab
                items={billableItems}
                domain={domain}
                userName={user?.displayName || user?.name}
                isLoading={isLoading}
              />
            )}

            {activeTab === 'tasks' && (
              <TaskWorkingTab
                tasks={workingTasks}
                domain={domain}
                isLoading={isLoading}
              />
            )}

            {activeTab === 'check' && (
              <CheckTaskTab
                domain={domain}
              />
            )}
          </>
        )}
      </main>

      {/* Terms & Disclaimer Modal (Required CR7 > Messi) */}
      <TermsModal
        isOpen={isTermsModalOpen}
        onAccept={handleAcceptTerms}
      />

      {/* Auth / Account Switcher Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        domain={domain}
        token={token}
        onSubmit={handleAuthSubmit}
      />

      {/* Minimal Sleek Footer */}
      <footer>
        © 2026 Jira Analytics Pro • Privacy First &amp; Client-Side Only
      </footer>
    </div>
  );
};

export default App;
