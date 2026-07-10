import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Calendar, Clock, Award, Play } from 'lucide-react';
import '../../app.css';

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [exams, setExams] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      try {
        const [examsData, attemptsData] = await Promise.all([
          api('/api/exams'),
          api('/api/my-attempts'),
        ]);
        setExams(examsData.exams);
        setAttempts(attemptsData.attempts);
      } catch (err) {
        setError(err.message || 'Failed to fetch dashboard data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleStartExam = async (examId) => {
    try {
      const data = await api(`/api/attempts/start?exam_id=${examId}`, { method: 'POST' });
      navigate(`/student/exam/${data.attempt.id}`);
    } catch (err) {
      alert(err.message || 'Could not start exam');
    }
  };

  const getAttemptStatus = (examId) => {
    const attempt = attempts.find((a) => a.exam_id === examId);
    if (!attempt) return null;
    return attempt;
  };

  if (loading) {
    return (
      <div className="page-loader">
        <div className="loader-spinner" />
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="container">
        <div className="dashboard-grid">
          <aside className="sidebar-nav">
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <img src="/logo.png" alt="S.A. Engineering College Logo" style={{ width: 90, height: 90, objectFit: 'contain', margin: '0 auto' }} />
            </div>
            <h3 style={{ marginBottom: 20, textAlign: 'center' }}>Student Portal</h3>
            <div style={{ marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{user.name}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{user.email}</div>
            </div>
            <ul className="sidebar-links">
              <li><a href="#active" className="active">Dashboard</a></li>
              <li><a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Documentation</a></li>
              <li>
                <a href="#logout" onClick={(e) => { e.preventDefault(); logout(); navigate('/login'); }} style={{ color: '#C62828' }}>
                  Sign Out
                </a>
              </li>
            </ul>
          </aside>

          <main className="dashboard-content">
            {error && <div className="auth-error">{error}</div>}

            <div className="dashboard-header">
              <div>
                <h2>Exam Center</h2>
                <p>Select a scheduled exam or review your past attempts</p>
              </div>
            </div>

            <h3 style={{ marginBottom: 20, borderBottom: '1.5px solid var(--border-light)', paddingBottom: 10 }}>
              Available Exams
            </h3>

            {exams.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No exams are currently available.</p>
            ) : (
              <div className="exam-list-grid" style={{ marginBottom: 40 }}>
                {exams.map((exam) => {
                  const attempt = getAttemptStatus(exam.id);
                  return (
                    <div className="exam-item-card" key={exam.id}>
                      <div>
                        <div className="exam-item-title">{exam.title}</div>
                        <div className="exam-item-meta">
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Clock size={14} />
                            {exam.duration} mins
                          </span>
                        </div>
                        <p className="exam-item-desc">{exam.description || 'No description provided.'}</p>
                      </div>
                      
                      {attempt ? (
                        <div style={{ marginTop: 12 }}>
                          {attempt.status === 'in_progress' ? (
                            <button
                              className="btn btn-primary"
                              onClick={() => navigate(`/student/exam/${attempt.id}`)}
                              style={{ width: '100%', justifyContent: 'center' }}
                            >
                              Resume Exam
                            </button>
                          ) : (
                            <button
                              className="btn btn-secondary"
                              onClick={() => navigate(`/student/result/${attempt.id}`)}
                              style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                              <Award size={16} />
                              View Score ({attempt.score}/{attempt.total_marks})
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          className="btn btn-primary"
                          onClick={() => handleStartExam(exam.id)}
                          style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                          <Play size={16} />
                          Start Exam
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <h3 style={{ marginBottom: 20, borderBottom: '1.5px solid var(--border-light)', paddingBottom: 10 }}>
              Recent Attempts
            </h3>

            {attempts.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>You haven't attempted any exams yet.</p>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Exam</th>
                      <th>Date</th>
                      <th>Violations</th>
                      <th>Status</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((attempt) => (
                      <tr key={attempt.id} style={{ cursor: 'pointer' }} onClick={() => attempt.status !== 'in_progress' && navigate(`/student/result/${attempt.id}`)}>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {attempt.exams?.title}
                        </td>
                        <td>{new Date(attempt.started_at).toLocaleDateString()}</td>
                        <td>
                          <span className={attempt.violation_count > 0 ? 'badge-red' : 'badge-green'}>
                            {attempt.violation_count}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>
                            {(attempt.status || 'in_progress').replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {(attempt.status || 'in_progress') === 'in_progress' ? '—' : `${attempt.score} / ${attempt.total_marks}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
