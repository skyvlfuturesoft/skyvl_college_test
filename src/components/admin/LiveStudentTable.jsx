import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Pause, Play, XCircle, Send, Wifi, WifiOff } from 'lucide-react';
import '../../proctor.css';

export default function LiveStudentTable() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadStudents = async () => {
    try {
      const data = await api('/api/live-students');
      setStudents(data.live_students || []);
    } catch (e) {
      console.error('Failed to load live students:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
    const interval = setInterval(loadStudents, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (action, attemptId) => {
    try {
      await api(`/api/${action}`, {
        method: 'POST',
        body: { attempt_id: attemptId, action_type: action, details: {} }
      });
      loadStudents();
    } catch (e) {
      console.error(`Action ${action} failed:`, e);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (loading) {
    return <p style={{ color: 'var(--text-secondary)' }}>Loading live student data...</p>;
  }

  if (students.length === 0) {
    return <p style={{ color: 'var(--text-secondary)', marginBottom: 40 }}>No active student sessions detected.</p>;
  }

  return (
    <div className="admin-table-wrapper" style={{ marginBottom: 40 }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Exam</th>
            <th>Question</th>
            <th>Answered</th>
            <th>Time Left</th>
            <th>Progress</th>
            <th>Violations</th>
            <th>Browser</th>
            <th>Connection</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
            const isTerminated = s.status === 'terminated';
            return (
              <tr key={s.id || s.attempt_id} style={isTerminated ? { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderLeft: '4px solid #EF4444' } : {}}>
                <td>
                  <div style={{ fontWeight: 600, color: isTerminated ? '#EF4444' : 'var(--text)' }}>
                    {s.student_name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.register_no}</div>
                </td>
                <td>{s.exam_name}</td>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{isTerminated ? '—' : s.current_question}</td>
                <td style={{ textAlign: 'center' }}>{isTerminated ? '—' : s.answered_questions}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: !isTerminated && s.remaining_time < 120 ? '#C62828' : '' }}>
                  {isTerminated ? <span style={{ color: '#EF4444', fontWeight: 700 }}>TERMINATED</span> : formatTime(s.remaining_time)}
                </td>
                <td>
                  {isTerminated ? (
                    <div style={{ fontSize: '0.8rem', color: '#EF4444', fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.kick_reason}>
                      Reason: {s.kick_reason || 'Security Limit Exceeded'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 60, height: 6, borderRadius: 3,
                        background: 'var(--border-light)', overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          background: s.progress_percent > 75 ? '#10B981' : s.progress_percent > 40 ? '#F59E0B' : '#EF4444',
                          width: `${s.progress_percent}%`
                        }} />
                      </div>
                      <span style={{ fontSize: '0.8rem' }}>{s.progress_percent}%</span>
                    </div>
                  )}
                </td>
                <td>
                  <span className={isTerminated || s.violation_count > 0 ? 'badge-red' : 'badge-green'}>
                    {s.violation_count} {isTerminated ? 'Kicked' : 'Strikes'}
                  </span>
                </td>
                <td style={{ fontSize: '0.82rem' }}>{s.browser} / {s.os}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isTerminated ? (
                      <><WifiOff size={14} style={{ color: '#EF4444' }} /><span style={{ fontSize: '0.8rem', color: '#EF4444' }}>Locked</span></>
                    ) : s.connection_status === 'connected' ? (
                      <><Wifi size={14} style={{ color: '#10B981' }} /><span style={{ fontSize: '0.8rem', color: '#10B981' }}>Online</span></>
                    ) : (
                      <><WifiOff size={14} style={{ color: '#EF4444' }} /><span style={{ fontSize: '0.8rem', color: '#EF4444' }}>Offline</span></>
                    )}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {!isTerminated && (
                      <>
                        {s.is_paused ? (
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleAction('resume-exam', s.attempt_id)}
                            style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                            title="Resume Exam"
                          >
                            <Play size={12} />
                          </button>
                        ) : (
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleAction('pause-exam', s.attempt_id)}
                            style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                            title="Pause Exam"
                          >
                            <Pause size={12} />
                          </button>
                        )}
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            if (confirm('Force submit this student\'s exam?')) {
                              handleAction('force-submit', s.attempt_id);
                            }
                          }}
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                          title="Force Submit"
                        >
                          <Send size={12} />
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            if (confirm('Terminate this student\'s exam session?')) {
                              handleAction('terminate-exam', s.attempt_id);
                            }
                          }}
                          style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#C62828' }}
                          title="Terminate Session"
                        >
                          <XCircle size={12} />
                        </button>
                      </>
                    )}
                    {isTerminated && (
                      <span style={{ fontSize: '0.75rem', color: '#EF4444', fontWeight: 600 }}>Closed</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
