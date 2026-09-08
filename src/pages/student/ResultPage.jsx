import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Award, AlertTriangle, ArrowLeft, Check, X, Printer, Timer, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
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

  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const scorePercentage = result ? (result.percentage !== undefined ? result.percentage : Math.round((result.score / result.total_marks) * 100) || 0) : 0;
  const isPassed = scorePercentage >= (result?.exams?.pass_threshold || 50);

  const getUserAnswerSummary = (ans, q, isSkipped) => {
    if (isSkipped) return '(Skipped - No Answer Provided)';
    const qType = q.question_type || 'mcq';
    if (qType === 'mcq' || qType === 'image_mcq') {
      if (ans.selected_option !== null && ans.selected_option !== undefined && ans.selected_option !== '') {
        const optIdx = Number(ans.selected_option);
        if (!isNaN(optIdx) && q.options && q.options[optIdx] !== undefined) {
          const letter = String.fromCharCode(65 + optIdx);
          return `Option ${letter}: ${q.options[optIdx]}`;
        }
      }
      if (ans.selected_answer_text) {
        return ans.selected_answer_text;
      }
      return '(Skipped)';
    } else {
      return ans.selected_answer_text || '(Skipped)';
    }
  };

  const getCorrectAnswerSummary = (q) => {
    const qType = q.question_type || 'mcq';
    if (qType === 'mcq' || qType === 'image_mcq') {
      const options = q.options || [];
      let corrIdx = -1;
      
      if (q.correct_answer !== null && q.correct_answer !== undefined) {
        if (typeof q.correct_answer === 'number' || !isNaN(Number(q.correct_answer))) {
          const parsed = Number(q.correct_answer);
          if (parsed >= 0 && parsed < options.length) corrIdx = parsed;
        } else if (typeof q.correct_answer === 'string') {
          const clean = q.correct_answer.trim().toUpperCase();
          if (clean.length === 1 && clean >= 'A' && clean <= 'Z') {
            const letterIdx = clean.charCodeAt(0) - 65;
            if (letterIdx >= 0 && letterIdx < options.length) corrIdx = letterIdx;
          }
          if (corrIdx === -1) {
            corrIdx = options.findIndex((opt) => String(opt).trim().toLowerCase() === q.correct_answer.trim().toLowerCase());
          }
        }
      }
      
      if (corrIdx !== -1 && options[corrIdx] !== undefined) {
        const letter = String.fromCharCode(65 + corrIdx);
        return `Option ${letter}: ${options[corrIdx]}`;
      }
      return q.correct_answer !== undefined && q.correct_answer !== null ? String(q.correct_answer) : 'N/A';
    } else {
      const acc = Array.isArray(q.accepted_answers) ? [...q.accepted_answers] : [];
      if (q.correct_answer && !acc.includes(q.correct_answer)) {
        acc.push(q.correct_answer);
      }
      return acc.length > 0 ? acc.join('  /  ') : (q.correct_answer || 'N/A');
    }
  };

  const sessionUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('soems_user') || '{}');
    } catch (e) { return {}; }
  })();
  const isBackToAdmin = sessionUser?.role === 'admin' || window.location.pathname.startsWith('/admin');

  return (
    <div className="app-container">
      {/* Print Styles Injection */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          .no-print {
            display: none !important;
          }
          .app-container, .container {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            box-shadow: none !important;
            background: #FFF !important;
          }
          .dashboard-content {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .stat-card {
            border: 1px solid #ddd !important;
            box-shadow: none !important;
            background: #fff !important;
          }
        }
      `}} />

      <div className="container" style={{ paddingBottom: 48 }}>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <button
            className="btn btn-secondary"
            onClick={() => navigate(isBackToAdmin ? '/admin/results' : '/student')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={16} />
            {isBackToAdmin ? 'Back to Results' : 'Back to Dashboard'}
          </button>
          
          <button
            className="btn btn-secondary"
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid var(--primary)', color: 'var(--primary)' }}
          >
            <Printer size={16} />
            Print / Download PDF
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {result && (
          <div className="dashboard-content" style={{ maxWidth: 840, margin: '0 auto', background: '#FFFFFF', padding: 32, borderRadius: 12, border: '1.5px solid var(--border-light)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            
            {/* Written Examination Institutional Header */}
            <div style={{ textAlign: 'center', borderBottom: '2px double #1E3A8A', paddingBottom: 20, marginBottom: 24 }}>
              <img src="/logo.png" alt="College Logo" style={{ height: 64, objectFit: 'contain', marginBottom: 8 }} />
              <h2 style={{ fontSize: '1.4rem', color: '#1E3A8A', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                S.A. ENGINEERING COLLEGE (AUTONOMOUS)
              </h2>
              <p style={{ margin: '2px 0 6px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                Accredited by NBA & NAAC with 'A' Grade | Affiliated to Anna University
              </p>
              <div style={{ background: '#1E3A8A', color: '#FFFFFF', padding: '4px 16px', borderRadius: 4, display: 'inline-block', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                OFFICIAL WRITTEN EXAMINATION EVALUATION REPORT
              </div>
            </div>

            {/* Candidate & Examination Info Sheet */}
            <div style={{
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: 8,
              padding: 16,
              marginBottom: 28
            }}>
              <table style={{ width: '100%', fontSize: '0.88rem', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '6px 12px', fontWeight: 700, color: '#475569', width: '18%' }}>Student Name:</td>
                    <td style={{ padding: '6px 12px', fontWeight: 600, color: '#0F172A', width: '32%' }}>{result.profiles?.name || sessionUser.name || 'Candidate'}</td>
                    <td style={{ padding: '6px 12px', fontWeight: 700, color: '#475569', width: '18%' }}>Exam Title:</td>
                    <td style={{ padding: '6px 12px', fontWeight: 600, color: '#0F172A', width: '32%' }}>{result.exams?.title || 'Examination'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 12px', fontWeight: 700, color: '#475569' }}>Email / Reg No:</td>
                    <td style={{ padding: '6px 12px', color: '#0F172A' }}>{result.profiles?.email || sessionUser.email || '—'}</td>
                    <td style={{ padding: '6px 12px', fontWeight: 700, color: '#475569' }}>Dept & Sec:</td>
                    <td style={{ padding: '6px 12px', color: '#0F172A' }}>
                      {result.profiles?.department || 'CSE'} - {result.profiles?.section || 'B'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 12px', fontWeight: 700, color: '#475569' }}>Exam Date:</td>
                    <td style={{ padding: '6px 12px', color: '#0F172A' }}>
                      {result.submitted_at ? new Date(result.submitted_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '6px 12px', fontWeight: 700, color: '#475569' }}>Result Status:</td>
                    <td style={{ padding: '6px 12px' }}>
                      <span style={{
                        padding: '3px 12px', borderRadius: 4, fontWeight: 700, fontSize: '0.8rem',
                        background: isPassed ? '#D1FAE5' : '#FEE2E2',
                        color: isPassed ? '#065F46' : '#991B1B',
                        border: isPassed ? '1px solid #A7F3D0' : '1px solid #FECACA'
                      }}>
                        {isPassed ? 'PASSED' : 'FAILED'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 12,
              marginBottom: 32
            }}>
              <div className="stat-card" style={{ padding: 14, textAlign: 'center', background: '#F8FAFC' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A' }}>
                  {result.score} / {result.total_marks}
                </div>
                <div className="stat-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Total Marks</div>
              </div>
              
              <div className="stat-card" style={{ padding: 14, textAlign: 'center', background: '#F8FAFC' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {scorePercentage}%
                </div>
                <div className="stat-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Percentage</div>
              </div>

              <div className="stat-card" style={{ padding: 14, textAlign: 'center', borderLeft: '3px solid #3B82F6' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563EB' }}>
                  {(result.correct_count || 0) + (result.wrong_count || 0)} / {answers.length}
                </div>
                <div className="stat-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Attempted</div>
              </div>

              <div className="stat-card" style={{ padding: 14, textAlign: 'center', borderLeft: '3px solid #22C55E' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <CheckCircle2 size={18} />
                  {result.correct_count || 0}
                </div>
                <div className="stat-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Correct</div>
              </div>

              <div className="stat-card" style={{ padding: 14, textAlign: 'center', borderLeft: '3px solid #EF4444' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <XCircle size={18} />
                  {result.wrong_count || 0}
                </div>
                <div className="stat-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Incorrect</div>
              </div>

              <div className="stat-card" style={{ padding: 14, textAlign: 'center', borderLeft: '3px solid #9CA3AF' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4B5563', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <AlertCircle size={18} />
                  {result.skipped_count !== undefined ? result.skipped_count : Math.max(0, answers.length - ((result.correct_count || 0) + (result.wrong_count || 0)))}
                </div>
                <div className="stat-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Skipped</div>
              </div>

              <div className="stat-card" style={{ padding: 14, textAlign: 'center', background: '#F8FAFC' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Timer size={16} />
                  {formatTime(result.time_taken)}
                </div>
                <div className="stat-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Time Taken</div>
              </div>
            </div>

            {result.violation_count > 0 && (
              <div className="violation-banner" style={{ marginBottom: 32, borderLeft: '4px solid #C62828' }}>
                <AlertTriangle size={20} />
                <span>
                  Proctoring Notice: {result.violation_count} security flag(s) logged during session.
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '2px solid #CBD5E1', paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Written Answer Evaluation Sheet
              </h3>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Total Questions: {answers.length}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {answers.map((ans, idx) => {
                const q = ans.questions || {};
                const qType = q.question_type || 'mcq';
                const isCorrect = ans.is_correct;
                
                // Determine skipped status correctly
                const hasOption = ans.selected_option !== null && ans.selected_option !== undefined && String(ans.selected_option).trim() !== '' && String(ans.selected_option).trim() !== '-1';
                const hasText = ans.selected_answer_text && String(ans.selected_answer_text).trim() !== '' && !String(ans.selected_answer_text).startsWith('(Skipped');
                const isSkipped = !hasOption && !hasText;

                let badgeText = 'Wrong';
                let badgeBg = '#FEE2E2';
                let badgeColor = '#991B1B';
                let statusIcon = <X size={14} />;

                if (isSkipped) {
                  badgeText = 'Skipped';
                  badgeBg = '#E5E7EB';
                  badgeColor = '#4B5563';
                  statusIcon = <AlertCircle size={14} />;
                } else if (isCorrect) {
                  badgeText = 'Correct';
                  badgeBg = '#D1FAE5';
                  badgeColor = '#065F46';
                  statusIcon = <Check size={14} />;
                }

                return (
                  <div
                    key={ans.id}
                    style={{
                      padding: 24,
                      border: '1.5px solid var(--border-light)',
                      borderRadius: 'var(--radius-md)',
                      background: isCorrect ? 'rgba(209, 250, 229, 0.1)' : isSkipped ? 'rgba(243, 244, 246, 0.1)' : 'rgba(254, 226, 226, 0.1)',
                      borderColor: isCorrect ? '#A7F3D0' : isSkipped ? '#D1D5DB' : '#FECACA',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{
                        marginTop: 2,
                        width: 24, height: 24, borderRadius: '50%',
                        background: badgeBg,
                        color: badgeColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {statusIcon}
                      </div>
                      
                      <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Question {idx + 1} ({qType.replace('image_', 'Image + ').toUpperCase()})
                          </span>
                          <span style={{ fontSize: '0.8rem', background: badgeBg, color: badgeColor, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                            {badgeText} ({q.marks || 1} Marks)
                          </span>
                        </div>

                        {/* Image Render */}
                        {q.image_url && (
                          <div style={{ margin: '12px 0' }}>
                            <img
                              src={q.image_url}
                              alt="Question context"
                              style={{ maxHeight: 150, maxWidth: '100%', borderRadius: 4, border: '1px solid var(--border-light)' }}
                            />
                          </div>
                        )}

                        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>
                          {q.question_text}
                        </div>

                        {/* Summary Comparison Box */}
                        <div style={{
                          background: '#FFFFFF',
                          padding: '12px 16px',
                          borderRadius: 8,
                          border: '1px solid var(--border-light)',
                          marginBottom: 16,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          fontSize: '0.9rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)', minWidth: 130 }}>
                              Your Answer:
                            </span>
                            <span style={{
                              fontWeight: 700,
                              color: isCorrect ? '#065F46' : isSkipped ? '#4B5563' : '#991B1B',
                              background: isCorrect ? '#D1FAE5' : isSkipped ? '#F3F4F6' : '#FEE2E2',
                              padding: '3px 10px',
                              borderRadius: 6
                            }}>
                              {getUserAnswerSummary(ans, q, isSkipped)}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)', minWidth: 130 }}>
                              Correct Answer:
                            </span>
                            <span style={{
                              fontWeight: 700,
                              color: '#065F46',
                              background: '#D1FAE5',
                              padding: '3px 10px',
                              borderRadius: 6
                            }}>
                              {getCorrectAnswerSummary(q)}
                            </span>
                          </div>
                        </div>

                        {/* Answers Options for MCQ */}
                        {(qType === 'mcq' || qType === 'image_mcq') && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {(q.options || []).map((opt, optIdx) => {
                              let labelStyle = { color: 'var(--text-secondary)' };
                              let optionBadge = null;

                              const isCorrectAnswerOption = q.correct_answer !== null && q.correct_answer !== undefined && (
                                optIdx === q.correct_answer ||
                                String(optIdx) === String(q.correct_answer).trim() ||
                                (typeof q.correct_answer === 'string' && q.correct_answer.trim().toUpperCase() === String.fromCharCode(65 + optIdx)) ||
                                (Array.isArray(q.options) && q.options[optIdx] && String(q.options[optIdx]).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase())
                              );

                              const isSelectedByStudent = ans.selected_option !== null && ans.selected_option !== undefined && (
                                optIdx === ans.selected_option ||
                                String(optIdx) === String(ans.selected_option).trim()
                              );

                              if (isCorrectAnswerOption) {
                                labelStyle = { color: '#065F46', fontWeight: 600 };
                                optionBadge = <span style={{ marginLeft: 8, fontSize: '0.72rem', background: '#D1FAE5', color: '#065F46', padding: '1px 6px', borderRadius: 4 }}>Correct Answer</span>;
                              }
                              
                              if (isSelectedByStudent) {
                                if (isCorrect) {
                                  labelStyle = { color: '#065F46', fontWeight: 700 };
                                  optionBadge = <span style={{ marginLeft: 8, fontSize: '0.72rem', background: '#D1FAE5', color: '#065F46', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>Your Choice (Correct)</span>;
                                } else {
                                  labelStyle = { color: '#991B1B', fontWeight: 700 };
                                  optionBadge = <span style={{ marginLeft: 8, fontSize: '0.72rem', background: '#FEE2E2', color: '#991B1B', padding: '1px 6px', borderRadius: 4 }}>Your Choice (Wrong)</span>;
                                }
                              }

                              return (
                                <div key={optIdx} style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>
                                  <span style={{ marginRight: 8, fontWeight: 600 }}>{String.fromCharCode(65 + optIdx)}.</span>
                                  <span style={labelStyle}>{opt}</span>
                                  {optionBadge}
                                </div>
                              );
                            })}
                          </div>
                        )}
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
