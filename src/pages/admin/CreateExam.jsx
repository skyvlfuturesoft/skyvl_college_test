import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, API_URL } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Plus, Trash2, Check, Upload, X, AlertCircle, Save, Smartphone, RefreshCw, QrCode } from 'lucide-react';
import '../../app.css';

export default function CreateExam() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { examId } = useParams();
  const isEditMode = !!examId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(30);
  const [isPublished, setIsPublished] = useState(false);
  const [questions, setQuestions] = useState([
    { question_text: '', question_type: 'mcq', image_url: '', options: ['', '', '', ''], correct_answer: 0, accepted_answers: [''], marks: 1 },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [loadingExam, setLoadingExam] = useState(false);
  const [error, setError] = useState('');
  const [uploadingIdx, setUploadingIdx] = useState(null);

  // QR Modal and Real-time Sync states
  const [showQRModal, setShowQRModal] = useState(false);
  const [hasRemoteChanges, setHasRemoteChanges] = useState(false);

  // Redirect to edit mode immediately if creating a new exam, so we get a draft examId
  useEffect(() => {
    if (!isEditMode) {
      const initDraft = async () => {
        setLoadingExam(true);
        try {
          const res = await api('/api/exams', {
            method: 'POST',
            body: { title: 'Untitled Exam', description: '', duration: 30 }
          });
          if (res.exam && res.exam.id) {
            navigate(`/admin/edit-exam/${res.exam.id}`, { replace: true });
          } else {
            setError('Failed to initialize draft exam');
          }
        } catch (err) {
          setError(err.message || 'Failed to initialize draft exam');
        } finally {
          setLoadingExam(false);
        }
      };
      initDraft();
    }
  }, [isEditMode, navigate]);

  // Fetch initial details if in Edit Mode
  useEffect(() => {
    if (isEditMode) {
      const loadExamData = async () => {
        setLoadingExam(true);
        try {
          const examRes = await api(`/api/exams/${examId}`);
          const questionsRes = await api(`/api/exams/${examId}/questions`);
          
          if (examRes.exam) {
            setTitle(examRes.exam.title || '');
            setDescription(examRes.exam.description || '');
            setDuration(examRes.exam.duration || 30);
            setIsPublished(examRes.exam.is_published || false);
          }

          if (questionsRes.questions && questionsRes.questions.length > 0) {
            const mappedQs = questionsRes.questions.map((q) => ({
              id: q.id,
              question_text: q.question_text || '',
              question_type: q.question_type || 'mcq',
              image_url: q.image_url || '',
              options: q.options && q.options.length ? q.options : ['', '', '', ''],
              correct_answer: q.correct_answer !== null && q.correct_answer !== undefined ? q.correct_answer : 0,
              accepted_answers: q.accepted_answers && q.accepted_answers.length ? q.accepted_answers : [''],
              marks: q.marks || 1
            }));
            setQuestions(mappedQs);
          }
        } catch (err) {
          setError(err.message || 'Failed to load exam data');
        } finally {
          setLoadingExam(false);
        }
      };
      loadExamData();
    }
  }, [examId, isEditMode]);

  // Listen to Postgres real-time questions changes for this exam
  useEffect(() => {
    if (!examId) return;

    const channel = supabase
      .channel(`questions-sync-${examId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'questions', filter: `exam_id=eq.${examId}` },
        () => {
          setHasRemoteChanges(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [examId]);

  const handleSyncRemoteChanges = async () => {
    setLoadingExam(true);
    try {
      const questionsRes = await api(`/api/exams/${examId}/questions`);
      if (questionsRes.questions) {
        const mappedQs = questionsRes.questions.map((q) => ({
          id: q.id,
          question_text: q.question_text || '',
          question_type: q.question_type || 'mcq',
          image_url: q.image_url || '',
          options: q.options && q.options.length ? q.options : ['', '', '', ''],
          correct_answer: q.correct_answer !== null && q.correct_answer !== undefined ? q.correct_answer : 0,
          accepted_answers: q.accepted_answers && q.accepted_answers.length ? q.accepted_answers : [''],
          marks: q.marks || 1
        }));
        setQuestions(mappedQs);
      }
      setHasRemoteChanges(false);
    } catch (err) {
      setError('Failed to sync remote changes');
    } finally {
      setLoadingExam(false);
    }
  };

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      { question_text: '', question_type: 'mcq', image_url: '', options: ['', '', '', ''], correct_answer: 0, accepted_answers: [''], marks: 1 },
    ]);
  };

  const handleRemoveQuestion = (idx) => {
    if (questions.length === 1) return;
    setQuestions(questions.filter((_, i) => i !== idx));
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

  const handleAddAcceptedAnswer = (qIdx) => {
    const updated = [...questions];
    updated[qIdx].accepted_answers.push('');
    setQuestions(updated);
  };

  const handleRemoveAcceptedAnswer = (qIdx, ansIdx) => {
    const updated = [...questions];
    if (updated[qIdx].accepted_answers.length === 1) return;
    updated[qIdx].accepted_answers.splice(ansIdx, 1);
    setQuestions(updated);
  };

  const handleAcceptedAnswerChange = (qIdx, ansIdx, value) => {
    const updated = [...questions];
    updated[qIdx].accepted_answers[ansIdx] = value;
    setQuestions(updated);
  };

  // Image Upload and Compression
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              const compressed = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressed);
            },
            'image/jpeg',
            0.7
          );
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e, qIdx) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    setUploadingIdx(qIdx);
    try {
      const compressedFile = await compressImage(file);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `questions/${fileName}`;

      const { data, error } = await supabase.storage
        .from('exam-images')
        .upload(filePath, compressedFile);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('exam-images')
        .getPublicUrl(filePath);

      handleQuestionChange(qIdx, 'image_url', publicUrl);
    } catch (err) {
      alert(err.message || 'Image upload failed');
    } finally {
      setUploadingIdx(null);
    }
  };

  const handleRemoveImage = (qIdx) => {
    handleQuestionChange(qIdx, 'image_url', '');
  };

  const validateExam = (isPublishingAction) => {
    if (!title.trim()) {
      return 'Exam title cannot be blank.';
    }

    if (questions.length === 0) {
      return 'Exam must contain at least one question.';
    }

    if (isPublishingAction) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qNum = i + 1;

        if (!q.question_text.trim()) {
          return `Question ${qNum} text cannot be blank.`;
        }

        if (q.question_type === 'mcq' || q.question_type === 'image_mcq') {
          if (q.options.some(opt => !opt.trim())) {
            return `All options must be filled out for Question ${qNum}.`;
          }
          const uniqueOpts = new Set(q.options.map(o => o.trim().toLowerCase()));
          if (uniqueOpts.size < q.options.length) {
            return `Question ${qNum} has duplicate options. All options must be unique.`;
          }
        } else if (q.question_type === 'fill_in_blank' || q.question_type === 'image_fib') {
          if (q.accepted_answers.some(ans => !ans.trim())) {
            return `All accepted answers must be filled out for Question ${qNum}.`;
          }
        }

        if ((q.question_type === 'image_mcq' || q.question_type === 'image_fib') && !q.image_url) {
          return `Question ${qNum} is an Image Question but has no image uploaded.`;
        }
      }
    }

    return null;
  };

  const handleSaveExam = async (publishStatus) => {
    setError('');
    const validationError = validateExam(publishStatus);
    if (validationError) {
      setError(validationError);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    try {
      let examIdToUse = examId;

      if (isEditMode) {
        await api(`/api/exams/${examId}`, {
          method: 'PUT',
          body: { title, description, duration, is_published: publishStatus }
        });
      } else {
        const examRes = await api('/api/exams', {
          method: 'POST',
          body: { title, description, duration }
        });
        examIdToUse = examRes.exam.id;
        
        if (publishStatus) {
          await api(`/api/exams/${examIdToUse}`, {
            method: 'PUT',
            body: { is_published: true }
          });
        }
      }

      // Question set sync
      const oldQsRes = await api(`/api/exams/${examIdToUse}/questions`);
      const oldQuestions = oldQsRes.questions || [];
      for (const oldQ of oldQuestions) {
        await api(`/api/questions/${oldQ.id}`, { method: 'DELETE' });
      }

      for (const q of questions) {
        await api('/api/questions', {
          method: 'POST',
          body: {
            exam_id: examIdToUse,
            question_text: q.question_text,
            question_type: q.question_type,
            image_url: q.image_url || '',
            options: q.options || [],
            correct_answer: parseInt(q.correct_answer) || 0,
            accepted_answers: q.accepted_answers || [],
            marks: q.marks
          }
        });
      }

      alert(publishStatus ? 'Exam published successfully!' : 'Draft saved successfully!');
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Failed to save exam');
    } finally {
      setSubmitting(false);
    }
  };

  // Support CSV locally + Excel/PDF parsing through FastAPI backend parse-questions endpoint
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
            importedQuestions.push({
              question_text,
              question_type: 'mcq',
              image_url: '',
              options,
              correct_answer,
              accepted_answers: [''],
              marks
            });
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
          const parsedQs = data.questions.map((q) => ({
            question_text: q.question_text || '',
            question_type: q.question_type || 'mcq',
            image_url: q.image_url || '',
            options: q.options && q.options.length ? q.options : ['', '', '', ''],
            correct_answer: q.correct_answer !== null && q.correct_answer !== undefined ? q.correct_answer : 0,
            accepted_answers: q.accepted_answers && q.accepted_answers.length ? q.accepted_answers : [''],
            marks: q.marks || 1
          }));
          setQuestions(parsedQs);
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

  if (loadingExam) {
    return (
      <div className="page-loader">
        <div className="loader-spinner" />
      </div>
    );
  }

  // Generate mobile address for scanning
  const getMobileUrl = () => {
    return window.location.href;
  };

  return (
    <div className="app-container">
      {/* Mobile responsive styling definitions */}
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 600px) {
          .responsive-grid {
            grid-template-columns: 1fr !important;
          }
          .container {
            padding: 12px !important;
          }
          .dashboard-content {
            padding: 16px !important;
          }
          .form-group-max {
            max-width: 100% !important;
          }
        }
      `}} />

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
          
          {/* Real-time remote updates sync banner */}
          {hasRemoteChanges && (
            <div style={{
              background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '12px 16px',
              borderRadius: 8, color: '#1E40AF', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 20
            }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                🔄 Questions updated from phone/another device.
              </span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSyncRemoteChanges}
                style={{ padding: '4px 10px', fontSize: '0.8rem', background: '#3B82F6', boxShadow: 'none' }}
              >
                Sync View
              </button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
            <div>
              <h2>{isEditMode ? 'Edit Examination' : 'Create New Examination'}</h2>
              <p style={{ margin: 0 }}>Define exam settings, questions, and publication state</p>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowQRModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid var(--primary)', color: 'var(--primary)', padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <Smartphone size={16} />
              📱 Add from Phone
            </button>
          </div>

          {error && (
            <div className="auth-error" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5', marginBottom: 24 }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={(e) => e.preventDefault()}>
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

            <div className="form-group form-group-max" style={{ maxWidth: 200 }}>
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

                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div className="form-group">
                    <label>Question Type</label>
                    <select
                      className="form-select"
                      value={q.question_type}
                      onChange={(e) => handleQuestionChange(qIdx, 'question_type', e.target.value)}
                    >
                      <option value="mcq">MCQ (Multiple Choice)</option>
                      <option value="fill_in_blank">Fill in the Blank</option>
                      <option value="image_mcq">Image + MCQ</option>
                      <option value="image_fib">Image + Fill in the Blank</option>
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

                {/* Image Upload Component Block */}
                {(q.question_type === 'image_mcq' || q.question_type === 'image_fib') && (
                  <div style={{
                    marginBottom: 20, padding: 16, border: '1px dashed var(--border-light)', borderRadius: 6, background: '#FFFFFF'
                  }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: '0.82rem' }}>
                      Question Image Upload
                    </label>
                    {q.image_url ? (
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <img
                          src={q.image_url}
                          alt="Question Preview"
                          style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 4, border: '1px solid var(--border-light)' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(qIdx)}
                          style={{
                            position: 'absolute', top: 8, right: 8, background: '#EF4444', color: '#FFFFFF',
                            border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                          title="Remove Image"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <label className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', margin: 0, fontSize: '0.8rem', padding: '6px 12px' }}>
                          <Upload size={14} />
                          <span>{uploadingIdx === qIdx ? 'Uploading...' : 'Choose Image File'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, qIdx)}
                            disabled={uploadingIdx !== null}
                            style={{ display: 'none' }}
                          />
                        </label>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>JPG, PNG. Camera photos accepted.</span>
                      </div>
                    )}
                  </div>
                )}

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

                {/* MCQ Options Rendering */}
                {(q.question_type === 'mcq' || q.question_type === 'image_mcq') && (
                  <>
                    <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
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

                    <div className="form-group form-group-max" style={{ maxWidth: 200 }}>
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
                  </>
                )}

                {/* Fill in the Blank Options Rendering */}
                {(q.question_type === 'fill_in_blank' || q.question_type === 'image_fib') && (
                  <div style={{ marginTop: 16 }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 12, fontSize: '0.82rem' }}>
                      Accepted Answers (Ignore case automatically)
                    </label>
                    {q.accepted_answers.map((answer, ansIdx) => (
                      <div key={ansIdx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder={`Accepted Answer Option ${ansIdx + 1}`}
                          value={answer}
                          onChange={(e) => handleAcceptedAnswerChange(qIdx, ansIdx, e.target.value)}
                          required
                          style={{ flex: 1, marginBottom: 0 }}
                        />
                        {q.accepted_answers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAcceptedAnswer(qIdx, ansIdx)}
                            style={{ background: 'transparent', border: 'none', color: '#C62828', cursor: 'pointer' }}
                            title="Remove Answer Option"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleAddAcceptedAnswer(qIdx)}
                      style={{ fontSize: '0.78rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}
                    >
                      <Plus size={12} />
                      Add Accepted Value
                    </button>
                  </div>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', gap: 16, marginTop: 24, alignItems: 'center', flexWrap: 'wrap' }}>
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

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={submitting}
                  onClick={() => handleSaveExam(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Save size={16} />
                  Save Draft
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={submitting}
                  onClick={() => handleSaveExam(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#22C55E', boxShadow: 'none' }}
                >
                  <Check size={16} />
                  {submitting ? 'Publishing...' : 'Publish Exam'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* QR Code Scan overlay Modal */}
      {showQRModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999, padding: 16
        }}>
          <div style={{
            background: '#FFFFFF', padding: 24, borderRadius: 12, maxWidth: 450, width: '100%',
            position: 'relative', textAlign: 'center', boxShadow: 'var(--shadow-lg)'
          }}>
            <button
              onClick={() => setShowQRModal(false)}
              style={{
                position: 'absolute', top: 16, right: 16, background: 'transparent',
                border: 'none', color: 'var(--text-secondary)', cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <div style={{ color: 'var(--primary)', display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <QrCode size={40} />
            </div>

            <h3 style={{ margin: '0 0 12px' }}>Edit from your Phone</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 20px' }}>
              Scan this QR code with your mobile camera to open this exam builder. You can easily add questions and upload images directly from your phone.
            </p>

            <div style={{
              background: 'var(--lighter-blue)', padding: 16, borderRadius: 8,
              display: 'inline-block', border: '1px solid var(--border-light)', marginBottom: 16
            }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(getMobileUrl())}`}
                alt="QR Code Link"
                style={{ width: 180, height: 180, display: 'block' }}
              />
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              <strong>Tip:</strong> Make sure your PC and phone are connected to the same local Wi-Fi. If using localhost, connect using your machine's LAN IP address.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
