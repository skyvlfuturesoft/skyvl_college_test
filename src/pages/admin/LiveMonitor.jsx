import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Radio, AlertTriangle, Shield, CheckCircle } from 'lucide-react';
import LiveStudentTable from '../../components/admin/LiveStudentTable';
import ActivityFeed from '../../components/admin/ActivityFeed';
import AdminNotifications from '../../components/admin/AdminNotifications';
import AdminLiveCards from '../../components/admin/AdminLiveCards';
import '../../app.css';
import '../../proctor.css';

export default function LiveMonitor() {
  const navigate = useNavigate();
  
  const [students, setStudents] = useState([]);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({ active_attempts: 0, total_violations: 0 });
  const [kickedCount, setKickedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshAll = async () => {
    try {
      const [liveData, eventsData, statsData, kickData] = await Promise.all([
        api('/api/live-students'),
        api('/api/activity-feed'),
        api('/api/monitor/stats'),
        api('/api/kick-history')
      ]);
      setStudents(liveData.live_students || []);
      setEvents(eventsData.events || []);
      setStats(statsData);
      setKickedCount(kickData.kick_logs?.length || 0);
    } catch (err) {
      setError(err.message || 'Failed to connect to monitor api');
    }
  };

  // 1. Initial Load of active attempts, stats, and recent events
  useEffect(() => {
    async function loadInitialData() {
      try {
        await refreshAll();
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  // 2. Realtime Listener & Polling Fallback
  useEffect(() => {
    if (loading) return;

    const isMock = !import.meta.env.VITE_SUPABASE_URL || 
                   import.meta.env.VITE_SUPABASE_URL.includes('placeholder-project');

    if (isMock) {
      // In offline mock mode, poll database API endpoints every 10 seconds (consolidated)
      const pollInterval = setInterval(async () => {
        try {
          await refreshAll();
        } catch (e) {
          console.error("Polling error in mock mode:", e);
        }
      }, 10000);

      return () => clearInterval(pollInterval);
    }

    // Otherwise, listen to database changes via real Supabase WebSockets
    const eventChannel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_logs' },
        async () => {
          refreshAll();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attempts' },
        async () => {
          refreshAll();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kick_logs' },
        async () => {
          refreshAll();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(eventChannel);
    };
  }, [loading]);

  const getTimeRemaining = (startedAt, durationMins) => {
    const start = new Date(startedAt).getTime();
    const duration = durationMins * 60 * 1000;
    const now = new Date().getTime();
    const elapsed = now - start;
    const remaining = Math.max(0, duration - elapsed);
    
    if (remaining === 0) return 'Expired';
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  // Timer updater loop for display
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="page-loader">
        <div className="loader-spinner" />
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="container" style={{ paddingBottom: 48 }}>
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/admin')}
          style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <div className="dashboard-content">
          <div className="dashboard-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2>Live Activity Monitor</h2>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(21, 101, 192, 0.1)', color: 'var(--primary)',
                  padding: '4px 12px', borderRadius: 9999, fontSize: '0.8rem', fontWeight: 600
                }}>
                  <Radio size={14} className="pulse-dot" style={{ animation: 'pulse-dot 2s infinite' }} />
                  Live Subscribed
                </div>
              </div>
              <p>Track student exam sessions and cheat detection events in real time</p>
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <AdminLiveCards students={students} stats={stats} kickedCount={kickedCount} />

          <h3 style={{ marginBottom: 16, borderBottom: '1.5px solid var(--border-light)', paddingBottom: 10 }}>
            Active Exam Sessions
          </h3>

          <LiveStudentTable students={students} loading={loading} onAction={refreshAll} />

          <h3 style={{ marginBottom: 16, borderBottom: '1.5px solid var(--border-light)', paddingBottom: 10 }}>
            Live Security Event Logs (WebSocket)
          </h3>

          <ActivityFeed events={events} />

          <AdminNotifications events={events} />
        </div>
      </div>
    </div>
  );
}
