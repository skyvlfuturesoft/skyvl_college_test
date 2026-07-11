import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { ArrowLeft, Clock, Award, AlertTriangle } from 'lucide-react';
import '../../app.css';

export default function ViewResults() {
  const navigate = useNavigate();

  const [results, setResults] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [resData, examsData] = await Promise.all([
          api('/api/results'),
          api('/api/exams'),
        ]);
        setResults(resData.results);
        setExams(examsData.exams);
      } catch (err) {
        setError(err.message || 'Failed to load results');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const exportToCSV = () => {
    const headers = ['Student Name', 'Email', 'Exam Title', 'Score', 'Total Marks', 'Percentage', 'Violations', 'Submitted At', 'Status'];
    let rows = [];
    let fileName = `exam_results_${new Date().toISOString().slice(0, 10)}.csv`;
    
    if (results.length > 0) {
      rows = results.map(res => {
        const percentage = Math.round((res.score / res.total_marks) * 100) || 0;
        return [
          res.profiles?.name || '—',
          res.profiles?.email || '—',
          res.exams?.title || '—',
          res.score,
          res.total_marks,
          `${percentage}%`,
          res.violation_count,
          new Date(res.submitted_at).toLocaleString(),
          res.status
        ];
      });
    } else {
      fileName = `exam_results_empty.csv`;
    }
    
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExamFilterChange = async (examId) => {
    setSelectedExam(examId);
    setLoading(true);
    try {
      const data = await api('/api/results', {
        params: examId ? { exam_id: examId } : {}
      });
      setResults(data.results);
    } catch (err) {
      setError(err.message || 'Failed to filter results');
    } finally {
      setLoading(false);
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
              <h2>Examination Results</h2>
              <p>Review completed attempts, scores, and track security logs</p>
            </div>
            
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={exportToCSV}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                📥 Export CSV
              </button>

              <div style={{ minWidth: 200 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Filter by Exam
                </label>
                <select
                  className="form-select"
                  value={selectedExam}
                  onChange={(e) => handleExamFilterChange(e.target.value)}
                >
                  <option value="">All Exams</option>
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          {results.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No completed exam attempts found.</p>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Email</th>
                    <th>Exam Title</th>
                    <th>Score</th>
                    <th>Violations</th>
                    <th>Submitted At</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((res) => {
                    const percentage = Math.round((res.score / res.total_marks) * 100) || 0;
                    return (
                      <tr key={res.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {res.profiles?.name}
                        </td>
                        <td>{res.profiles?.email}</td>
                        <td>{res.exams?.title}</td>
                        <td style={{ fontWeight: 600 }}>
                          {res.score} / {res.total_marks} ({percentage}%)
                        </td>
                        <td>
                          <span className={res.violation_count > 0 ? 'badge-red' : 'badge-green'}>
                            {res.violation_count} Flagged
                          </span>
                        </td>
                        <td>{new Date(res.submitted_at).toLocaleString()}</td>
                        <td>
                          <span style={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>
                            {res.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
