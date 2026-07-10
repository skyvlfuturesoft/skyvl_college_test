import { ShieldAlert, AlertOctagon } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../../proctor.css';

export default function ExamTerminated() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason') || 'Security triggers logged tab switching, window focus loss, or developer console activity exceeding the permissible limit.';

  return (
    <div className="terminated-page-wrapper">
      <div className="terminated-card">
        <div className="terminated-icon-wrapper">
          <ShieldAlert size={64} className="terminated-icon" />
        </div>
        <h2 className="terminated-title">Examination Terminated</h2>
        <div className="terminated-divider" />
        
        <div className="terminated-body">
          <p className="terminated-msg">
            Your examination has been terminated because examination rules were violated.
          </p>
          <div className="terminated-notice-box">
            <AlertOctagon size={20} className="notice-icon" />
            <p style={{ margin: 0, fontWeight: 500 }}>
              {reason}
            </p>
          </div>
          <p className="terminated-instructions">
            All violations, IP addresses, and timestamps have been logged to the administrator proctor panel. Please contact the <strong>S.A. Engineering College</strong> exam department to appeal or schedule a re-examination.
          </p>
        </div>

        <div className="terminated-footer">
          <button 
            className="btn btn-primary terminated-btn" 
            onClick={() => navigate('/login', { replace: true })}
          >
            Return to Login Portal
          </button>
        </div>
      </div>
    </div>
  );
}
