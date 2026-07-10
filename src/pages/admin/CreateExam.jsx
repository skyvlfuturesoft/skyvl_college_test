import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, Plus, Trash2, Check } from 'lucide-react';
import '../../app.css';

export default function CreateExam() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(30);
  const [questions, setQuestions] = useState([
    { question_text: '', options: ['', '', '', ''], correct_answer: 0, marks: 1 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      { question_text: '', options: ['', '', '', ''], correct_answer: 0, marks: 1 },
    ]);
  };

  const handleRemoveQuestion = (idx) => {
    if (questions.length === 1) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleFileImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target.result;
        const lines = text.split('\n');
        const importedQuestions = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const parts = line.split(',');
          if (parts.length >= 7) {
            const question_text = parts[0].trim().replace(/^"|"$/g, '');
            const options = [
              parts[1].trim().replace(/^"|"$/g, ''),
              parts[2].trim().replace(/^"|"$/g, ''),
              parts[3].trim().replace(/^"|"$/g, ''),
              parts[4].trim().replace(/^"|"$/g, '')
            ];
            const correctLetter = parts[5].trim().toUpperCase().replace(/^"|"$/g, '');
            let correct_answer = 0;
            if (correctLetter === 'B' || correctLetter === '1') correct_answer = 1;
            else if (correctLetter === 'C' || correctLetter === '2') correct_answer = 2;
            else if (correctLetter === 'D' || correctLetter === '3') correct_answer = 3;
            
            const marks = parseInt(parts[6].trim().replace(/^"|"$/g, '')) || 1;
            importedQuestions.push({ question_text, options, correct_answer, marks });
          }
        }
        if (importedQuestions.length > 0) {
          setQuestions(importedQuestions);
          alert(`Successfully imported ${importedQuestions.length} questions from CSV!`);
        } else {
          alert('No valid questions found. Check CSV format: Question, Option A, Option B, Option C, Option D, Correct Option (A/B/C/D), Marks');
        }
      };
      reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls' || ext === 'pdf') {
      setSubmitting(true);
      setError('');

      const formData = new FormData();
      formData.append('file', file);

      try {
        const API_URL = import.meta.env.VITE_API_URL || '';
        const token = JSON.parse(localStorage.getItem('soems_session') || '{}').access_token;
        const res = await fetch(`${API_URL}/api/admin/exams/parse-questions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || 'Parsing failed');
        }
        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
          alert(`Successfully parsed and imported ${data.questions.length} questions from ${ext.toUpperCase()} file!`);
        } else {
          alert('No questions could be parsed from the file. Ensure the PDF/Excel format matches standard structure.');
        }
      } catch (err) {
        setError(err.message || `Failed to parse ${ext.toUpperCase()} file`);
        alert(err.message || `Failed to parse ${ext.toUpperCase()} file`);
      } finally {
        setSubmitting(false);
      }
    } else {
      alert('Unsupported file format. Please upload CSV (.csv), Excel (.xlsx, .xls) or PDF (.pdf) files.');
    }
  };

  const handleQuestionChange = (qIdx, field, value) => {
    const updated = [...questions];
    updated[qIdx][field] = value;
    setQuestions(updated);
  };

  const handleOptionChange = (qIdx, optIdx, value) => {
    const updated = [...questions];
    updated[qIdx].options[optIdx] = value;
    setQuestions(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // 1. Create Exam
      const examData = await api('/api/exams', {
        method: 'POST',
        body: { title, description, duration }
      });
      const examId = examData.exam.id;

      // 2. Add Questions
      for (const q of questions) {
        if (!q.question_text || q.options.some((o) => !o)) {
          throw new Error('All questions and options must be filled out');
        }
        await api('/api/questions', {
          method: 'POST',
          body: {
            exam_id: examId,
            question_text: q.question_text,
            options: q.options,
            correct_answer: parseInt(q.correct_answer),
            marks: q.marks
          }
        });
      }

      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Failed to create exam');
    } finally {
      setSubmitting(false);
    }
  };

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

        <div className="dashboard-content" style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2>Create New Examination</h2>
          <p style={{ marginBottom: 32 }}>Define exam duration and add multiple-choice questions</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <h3 style={{ marginBottom: 20, borderBottom: '1.5px solid var(--border-light)', paddingBottom: 10 }}>
              Exam Details
            </h3>

            <div className="form-group">
              <label htmlFor="title">Exam Title</label>
              <input
                id="title"
                type="text"
                className="form-input"
                placeholder="e.g., Computer Networks Midterm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                className="form-input"
                placeholder="Brief description for the students..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{ fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>

            <div className="form-group" style={{ maxWidth: 200 }}>
              <label htmlFor="duration">Duration (Minutes)</label>
              <input
                id="duration"
                type="number"
                className="form-input"
                min={1}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                required
              />
            </div>

            <h3 style={{ marginTop: 40, marginBottom: 20, borderBottom: '1.5px solid var(--border-light)', paddingBottom: 10 }}>
              Question Bank
            </h3>

            {questions.map((q, qIdx) => (
              <div
                key={qIdx}
                style={{
                  padding: 24,
                  border: '1.5px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 24,
                  position: 'relative',
                  background: 'var(--lighter-blue)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h4 style={{ margin: 0, color: 'var(--primary)' }}>Question {qIdx + 1}</h4>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(qIdx)}
                      style={{ background: 'transparent', border: 'none', color: '#C62828', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Trash2 size={16} />
                      Remove
                    </button>
                  )}
                </div>

                <div className="form-group">
                  <label>Question Text</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter the question here"
                    value={q.question_text}
                    onChange={(e) => handleQuestionChange(qIdx, 'question_text', e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  {q.options.map((option, optIdx) => (
                    <div key={optIdx}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Option {String.fromCharCode(65 + optIdx)}
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                        value={option}
                        onChange={(e) => handleOptionChange(qIdx, optIdx, e.target.value)}
                        required
                      />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div className="form-group">
                    <label>Correct Option</label>
                    <select
                      className="form-select"
                      value={q.correct_answer}
                      onChange={(e) => handleQuestionChange(qIdx, 'correct_answer', parseInt(e.target.value))}
                    >
                      <option value={0}>Option A</option>
                      <option value={1}>Option B</option>
                      <option value={2}>Option C</option>
                      <option value={3}>Option D</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Marks</label>
                    <input
                      type="number"
                      className="form-input"
                      min={1}
                      value={q.marks}
                      onChange={(e) => handleQuestionChange(qIdx, 'marks', parseInt(e.target.value) || 1)}
                      required
                    />
                  </div>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 16, marginTop: 24, alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddQuestion}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={16} />
                Add Question
              </button>

              <label className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', margin: 0 }}>
                <span>📥 Import CSV / Excel / PDF</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf"
                  onChange={handleFileImport}
                  style={{ display: 'none' }}
                />
              </label>

              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Format: CSV/Excel table columns or a text PDF format.
              </span>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: '#22C55E', boxShadow: 'none' }}
              >
                <Check size={16} />
                {submitting ? 'Saving Exam...' : 'Create & Save Exam'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
