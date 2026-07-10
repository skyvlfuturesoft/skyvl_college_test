import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { ArrowLeft, BarChart3, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area,
  RadialBarChart, RadialBar,
} from 'recharts';
import '../../app.css';
import '../../proctor.css';

const CHART_COLORS = ['#1565C0', '#42A5F5', '#90CAF9', '#E3F2FD'];
const PIE_COLORS = ['#10B981', '#EF4444', '#F59E0B'];

export default function Analytics() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await api('/api/analytics');
        setData(res);
      } catch (err) {
        setError(err.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="page-loader">
        <div className="loader-spinner" />
      </div>
    );
  }

  const passFailData = [
    { name: 'Pass', value: 72 },
    { name: 'Fail', value: 28 },
  ];

  const avgScoreRadial = [
    { name: 'Average Score', value: data?.stats?.average_score || 78, fill: '#1565C0' }
  ];

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <BarChart3 size={24} style={{ color: 'var(--primary)' }} />
                <h2>Examination Analytics</h2>
              </div>
              <p>Interactive charts and insights from examination data</p>
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          {/* Summary Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 20,
            marginBottom: 40
          }}>
            <div className="stat-card">
              <div className="stat-icon"><Users size={22} /></div>
              <div className="stat-number">{data?.stats?.live_online || 0}</div>
              <div className="stat-label">Live Online</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ color: '#F59E0B' }}><AlertTriangle size={22} /></div>
              <div className="stat-number" style={{ color: '#F59E0B' }}>{data?.stats?.warnings_today || 0}</div>
              <div className="stat-label">Warnings Today</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ color: '#EF4444' }}><AlertTriangle size={22} /></div>
              <div className="stat-number" style={{ color: '#EF4444' }}>{data?.stats?.kicks_today || 0}</div>
              <div className="stat-label">Kicks Today</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ color: '#10B981' }}><TrendingUp size={22} /></div>
              <div className="stat-number" style={{ color: '#10B981' }}>{data?.stats?.average_score || 0}%</div>
              <div className="stat-label">Avg Score</div>
            </div>
          </div>

          {/* Charts Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: 32,
            marginBottom: 32
          }}>
            {/* Department Performance Bar Chart */}
            <div style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              boxShadow: 'var(--shadow-sm)'
            }}>
              <h4 style={{ marginBottom: 20 }}>Department Performance</h4>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data?.dept_performance || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="department" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255,255,255,0.95)',
                      border: '1px solid #E2E8F0',
                      borderRadius: 12,
                      fontSize: 13
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="average_score" fill="#1565C0" radius={[6, 6, 0, 0]} name="Avg Score" />
                  <Bar dataKey="pass_rate" fill="#42A5F5" radius={[6, 6, 0, 0]} name="Pass Rate %" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Violation Trend Area Chart */}
            <div style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              boxShadow: 'var(--shadow-sm)'
            }}>
              <h4 style={{ marginBottom: 20 }}>Violation Trend</h4>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data?.violation_trend || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255,255,255,0.95)',
                      border: '1px solid #E2E8F0',
                      borderRadius: 12,
                      fontSize: 13
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="warnings" stroke="#F59E0B" fill="rgba(245,158,11,0.15)" strokeWidth={2} name="Warnings" />
                  <Area type="monotone" dataKey="kicks" stroke="#EF4444" fill="rgba(239,68,68,0.12)" strokeWidth={2} name="Kicks" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Pass/Fail Pie Chart */}
            <div style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              boxShadow: 'var(--shadow-sm)'
            }}>
              <h4 style={{ marginBottom: 20 }}>Pass / Fail Distribution</h4>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={passFailData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}%`}
                  >
                    {passFailData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Question Difficulty Bar Chart */}
            <div style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              boxShadow: 'var(--shadow-sm)'
            }}>
              <h4 style={{ marginBottom: 20 }}>Question Difficulty Analysis</h4>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data?.questions_analysis || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <YAxis dataKey="question_text" type="category" width={180} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255,255,255,0.95)',
                      border: '1px solid #E2E8F0',
                      borderRadius: 12,
                      fontSize: 13
                    }}
                  />
                  <Bar dataKey="correct_rate" fill="#1565C0" radius={[0, 6, 6, 0]} name="Correct %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
