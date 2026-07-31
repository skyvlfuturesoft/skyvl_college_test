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
            onClick={() => navigate('/student')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={16} />
            Back to Dashboard
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
          <div className="dashboard-content" style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: isPassed ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', color: isPassed ? '#16A34A' : '#DC2626'
              }}>
                <Award size={32} style={{ margin: 'auto' }} />
              </div>
              <h2>{isPassed ? 'Exam Passed' : 'Exam Failed'}</h2>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{result.exams?.title}</p>
              <div style={{ marginTop: 8 }}>
                <span style={{
                  padding: '6px 16px', borderRadius: '50px', fontWeight: 700, fontSize: '0.85rem',
                  background: isPassed ? '#D1FAE5' : '#FEE2E2',
                  color: isPassed ? '#065F46' : '#991B1B'
                }}>
                  {isPassed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 16,
              marginBottom: 32
            }}>
              <div className="stat-card" style={{ padding: 16 }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
                  {result.score} / {result.total_marks}
                </div>
                <div className="stat-label" style={{ fontSize: '0.78rem' }}>Marks Obtained</div>
              </div>
              
              <div className="stat-card" style={{ padding: 16 }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
                  {scorePercentage}%
                </div>
                <div className="stat-label" style={{ fontSize: '0.78rem' }}>Percentage</div>
              </div>

              <div className="stat-card" style={{ padding: 16, borderLeft: '3px solid #22C55E' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={20} />
                  {result.correct_count || 0}
                </div>
                <div className="stat-label" style={{ fontSize: '0.78rem' }}>Correct Answers</div>
              </div>

              <div className="stat-card" style={{ padding: 16, borderLeft: '3px solid #EF4444' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <XCircle size={20} />
                  {result.wrong_count || 0}
                </div>
                <div className="stat-label" style={{ fontSize: '0.78rem' }}>Wrong Answers</div>
              </div>

              <div className="stat-card" style={{ padding: 16, borderLeft: '3px solid #9CA3AF' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4B5563', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={20} />
                  {result.skipped_count || 0}
                </div>
                <div className="stat-label" style={{ fontSize: '0.78rem' }}>Skipped Count</div>
              </div>

              <div className="stat-card" style={{ padding: 16 }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Timer size={18} />
                  {formatTime(result.time_taken)}
                </div>
                <div className="stat-label" style={{ fontSize: '0.78rem' }}>Time Taken</div>
              </div>
            </div>

            {result.violation_count > 0 && (
              <div className="violation-banner" style={{ marginBottom: 40, borderLeft: '4px solid #C62828' }}>
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
                const q = ans.questions || {};
                const qType = q.question_type || 'mcq';
                const isCorrect = ans.is_correct;
                
                // Determine skipped status
                const isSkipped = (qType === 'mcq' || qType === 'image_mcq')
                  ? (ans.selected_option === null || ans.selected_option === undefined || ans.selected_option === '')
                  : (!ans.selected_answer_text || ans.selected_answer_text.trim() === '');

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
