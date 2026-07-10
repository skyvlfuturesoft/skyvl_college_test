import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Users, BookOpen, AlertTriangle, Play, Award, ClipboardList, PlusCircle, Radio } from 'lucide-react';
import AdminNotifications from '../../components/admin/AdminNotifications';
import '../../app.css';
import '../../proctor.css';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    total_students: 0,
    total_exams: 0,
    active_attempts: 0,
    completed_attempts: 0,
    total_violations: 0,
  });
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadStats() {
      try {
        const [statsData, examsData] = await Promise.all([
          api('/api/monitor/stats'),
          api('/api/exams'),
        ]);
        setStats(statsData);
        setExams(examsData.exams);
      } catch (err) {
        setError(err.message || 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const handlePublishToggle = async (examId, currentStatus) => {
    try {
      await api(`/api/exams/${examId}`, {
        method: 'PUT',
        body: { is_published: !currentStatus }
      });
      setExams((prev) =>
        prev.map((e) => (e.id === examId ? { ...e, is_published: !currentStatus } : e))
      );
    } catch (err) {
      alert(err.message || 'Failed to update exam status');
    }
  };

  const handleDuplicateExam = async (exam) => {
    if (confirm(`Duplicate the exam "${exam.title}"? This will copy all its details and questions.`)) {
      try {
        setLoading(true);
        const questionsRes = await api(`/api/exams/${exam.id}/questions`);
        const targetQuestions = questionsRes.questions || [];

        const duplicatedExam = await api('/api/exams', {
          method: 'POST',
          body: {
            title: `${exam.title} (Copy)`,
            description: exam.description,
            duration: exam.duration,
            start_time: exam.start_time,
            end_time: exam.end_time,
            negative_marking: exam.negative_marking,
            pass_threshold: exam.pass_threshold,
            max_violations: exam.max_violations,
            allowed_violations: exam.allowed_violations
          }
        });
        const newExamId = duplicatedExam.exam.id;

        for (const q of targetQuestions) {
          await api('/api/questions', {
            method: 'POST',
            body: {
              exam_id: newExamId,
              question_text: q.question_text,
              options: q.options,
              correct_answer: q.correct_answer,
              marks: q.marks
            }
          });
        }

        const examsData = await api('/api/exams');
        setExams(examsData.exams);
        alert('Exam duplicated successfully!');
      } catch (err) {
        alert(err.message || 'Failed to duplicate exam');
      } finally {
        setLoading(false);
      }
    }
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
            <h3 style={{ marginBottom: 20, textAlign: 'center' }}>Admin Portal</h3>
            <div style={{ marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{user.name}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{user.email}</div>
            </div>
            <ul className="sidebar-links">
              <li><a href="#dashboard" className="active">Dashboard</a></li>
              <li><a href="#create" onClick={(e) => { e.preventDefault(); navigate('/admin/create-exam'); }}>Create Exam</a></li>
              <li><a href="#monitor" onClick={(e) => { e.preventDefault(); navigate('/admin/monitor'); }}>Live Monitor</a></li>
              <li><a href="#results" onClick={(e) => { e.preventDefault(); navigate('/admin/results'); }}>View Results</a></li>
              <li><a href="#kick-log" onClick={(e) => { e.preventDefault(); navigate('/admin/kick-log'); }}>Kick Log</a></li>
              <li><a href="#analytics" onClick={(e) => { e.preventDefault(); navigate('/admin/analytics'); }}>Analytics</a></li>
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
                <h2>Overview Dashboard</h2>
                <p>Monitor platform statistics, manage schedules, and track activity</p>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 24,
              marginBottom: 40
            }}>
              <div className="stat-card">
                <div className="stat-icon"><Users size={24} /></div>
                <div className="stat-number">{stats.total_students}</div>
                <div className="stat-label">Registered Students</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"><BookOpen size={24} /></div>
                <div className="stat-number">{stats.total_exams}</div>
                <div className="stat-label">Total Exams</div>
              </div>
              <div className="stat-card" style={{ borderColor: stats.active_attempts > 0 ? 'var(--primary)' : '' }}>
                <div className="stat-icon" style={{ color: stats.active_attempts > 0 ? 'var(--primary)' : '' }}><Radio size={24} /></div>
                <div className="stat-number" style={{ color: stats.active_attempts > 0 ? 'var(--primary)' : '' }}>{stats.active_attempts}</div>
                <div className="stat-label">Live Active Attempts</div>
              </div>
              <div className="stat-card" style={{ borderColor: stats.total_violations > 0 ? '#FFCDD2' : '' }}>
                <div className="stat-icon" style={{ color: stats.total_violations > 0 ? '#C62828' : '' }}><AlertTriangle size={24} /></div>
                <div className="stat-number" style={{ color: stats.total_violations > 0 ? '#C62828' : '' }}>{stats.total_violations}</div>
                <div className="stat-label">Logged Violations</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1.5px solid var(--border-light)', paddingBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Examinations</h3>
              <button
                className="btn btn-primary"
                onClick={() => navigate('/admin/create-exam')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: '0.85rem' }}
              >
                <PlusCircle size={16} />
                Create Exam
              </button>
            </div>

            {exams.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No examinations have been created yet.</p>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Exam Title</th>
                      <th>Duration</th>
                      <th>Created By</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map((exam) => (
                      <tr key={exam.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>{exam.title}</td>
                        <td>{exam.duration} minutes</td>
                        <td>{exam.profiles?.name || 'Administrator'}</td>
                        <td>
                          <span className={exam.is_published ? 'badge-green' : 'badge-red'}>
                            {exam.is_published ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handlePublishToggle(exam.id, exam.is_published)}
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          >
                            {exam.is_published ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleDuplicateExam(exam)}
                            style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: 'var(--lighter-blue)', color: 'var(--primary)' }}
                          >
                            Duplicate
                          </button>
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
      <AdminNotifications />
    </div>
  );
}
