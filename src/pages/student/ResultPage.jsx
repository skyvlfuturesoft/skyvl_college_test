import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Award, AlertTriangle, ArrowLeft, Check, X } from 'lucide-react';
import '../../app.css';

export default function ResultPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [result, setResult] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadResult() {
      try {
        const data = await api(`/api/attempts/${attemptId}/result`);
        setResult(data.attempt);
        setAnswers(data.answers);
      } catch (err) {
        setError(err.message || 'Failed to load result data');
      } finally {
        setLoading(false);
      }
    }
    loadResult();
  }, [attemptId]);

  if (loading) {
    return (
      <div className="page-loader">
        <div className="loader-spinner" />
      </div>
    );
  }

  const scorePercentage = Math.round((result?.score / result?.total_marks) * 100) || 0;

  return (
    <div className="app-container">
      <div className="container" style={{ paddingBottom: 48 }}>
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/student')}
          style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        {error && <div className="auth-error">{error}</div>}

        {result && (
          <div className="dashboard-content" style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--light-blue)',
                display: 'flex', alignItems: 'center', justifyCentent: 'center',
                margin: '0 auto 16px', color: 'var(--primary)'
              }}>
                <Award size={32} style={{ margin: 'auto' }} />
              </div>
              <h2>Exam Completed</h2>
              <p style={{ fontSize: '1.1rem' }}>{result.exams?.title}</p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 20,
              marginBottom: 40
            }}>
              <div className="stat-card">
                <div className="stat-number">{result.score} / {result.total_marks}</div>
                <div className="stat-label">Total Score</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{scorePercentage}%</div>
                <div className="stat-label">Percentage</div>
              </div>
              <div className="stat-card" style={{ borderColor: result.violation_count > 0 ? '#FFCDD2' : '' }}>
                <div className="stat-number" style={{ color: result.violation_count > 0 ? '#C62828' : '' }}>
                  {result.violation_count}
                </div>
                <div className="stat-label">Security Violations</div>
              </div>
            </div>

            {result.violation_count > 0 && (
              <div className="violation-banner" style={{ marginBottom: 40 }}>
                <AlertTriangle size={20} />
                <span>
                  Our tracking system flagged {result.violation_count} instances of tab switching or browser window blur during this exam. All flags have been reported to the administrator.
                </span>
              </div>
            )}

            <h3 style={{ marginBottom: 20, borderBottom: '1.5px solid var(--border-light)', paddingBottom: 10 }}>
              Question Breakdown
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {answers.map((ans, idx) => {
                const q = ans.questions;
                const isCorrect = ans.is_correct;
                return (
                  <div
                    key={ans.id}
                    style={{
                      padding: 24,
                      border: '1.5px solid var(--border-light)',
                      borderRadius: 'var(--radius-md)',
                      background: isCorrect ? 'rgba(209, 250, 229, 0.2)' : 'rgba(254, 226, 226, 0.2)',
                      borderColor: isCorrect ? '#A7F3D0' : '#FECACA',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{
                        marginTop: 2,
                        width: 24, height: 24, borderRadius: '50%',
                        background: isCorrect ? '#D1FAE5' : '#FEE2E2',
                        color: isCorrect ? '#065F46' : '#991B1B',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isCorrect ? <Check size={14} /> : <X size={14} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
                          Question {idx + 1}: {q.question_text}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {q.options.map((opt, optIdx) => {
                            let labelStyle = { color: 'var(--text-secondary)' };
                            let badge = null;

                            if (optIdx === q.correct_answer) {
                              labelStyle = { color: '#065F46', fontWeight: 600 };
                              badge = <span style={{ marginLeft: 8, fontSize: '0.75rem', background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 4 }}>Correct Answer</span>;
                            } else if (optIdx === ans.selected_option && !isCorrect) {
                              labelStyle = { color: '#991B1B', fontWeight: 600 };
                              badge = <span style={{ marginLeft: 8, fontSize: '0.75rem', background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: 4 }}>Your Answer</span>;
                            } else if (optIdx === ans.selected_option && isCorrect) {
                              labelStyle = { color: '#065F46', fontWeight: 600 };
                              badge = <span style={{ marginLeft: 8, fontSize: '0.75rem', background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 4 }}>Your Answer</span>;
                            }

                            return (
                              <div key={optIdx} style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>
                                <span style={{ marginRight: 8, fontWeight: 600 }}>{String.fromCharCode(65 + optIdx)}.</span>
                                <span style={labelStyle}>{opt}</span>
                                {badge}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
