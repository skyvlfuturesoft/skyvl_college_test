import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import Architecture from './components/Architecture';
import TechStack from './components/TechStack';
import Modules from './components/Modules';
import Security from './components/Security';
import Workflow from './components/Workflow';
import ScrollToTop from './components/ScrollToTop';
import { ProtectedRoute } from './context/AuthContext';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/student/StudentDashboard';
import ExamPage from './pages/student/ExamPage';
import ResultPage from './pages/student/ResultPage';
import ExamTerminated from './pages/student/ExamTerminated';
import AdminDashboard from './pages/admin/AdminDashboard';
import CreateExam from './pages/admin/CreateExam';
import LiveMonitor from './pages/admin/LiveMonitor';
import ViewResults from './pages/admin/ViewResults';
import KickLog from './pages/admin/KickLog';
import Analytics from './pages/admin/Analytics';

const DatabaseSection = lazy(() => import('./components/Database'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const Screenshots = lazy(() => import('./components/Screenshots'));
const Testing = lazy(() => import('./components/Testing'));
const FutureScope = lazy(() => import('./components/FutureScope'));
const Footer = lazy(() => import('./components/Footer'));

const SectionLoader = () => (
  <div style={{ padding: '80px 0', textAlign: 'center', color: '#94A3B8' }}>
    <div style={{
      width: 32, height: 32, border: '3px solid #E3F2FD',
      borderTopColor: '#1565C0', borderRadius: '50%',
      animation: 'spin .6s linear infinite', margin: '0 auto 12px'
    }} />
  </div>
);

// Documentation Home Component
function DocumentationHome() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <hr className="section-divider" />
        <Features />
        <Architecture />
        <TechStack />
        <Modules />
        <Suspense fallback={<SectionLoader />}>
          <DatabaseSection />
        </Suspense>
        <Security />
        <Workflow />
        <Suspense fallback={<SectionLoader />}>
          <Dashboard />
        </Suspense>
        <hr className="section-divider" />
        <Suspense fallback={<SectionLoader />}>
          <Screenshots />
        </Suspense>
        <Suspense fallback={<SectionLoader />}>
          <Testing />
        </Suspense>
        <Suspense fallback={<SectionLoader />}>
          <FutureScope />
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
      <ScrollToTop />
    </>
  );
}

export default function App() {
  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <Routes>
        {/* Documentation Portal */}
        <Route path="/" element={<DocumentationHome />} />
        
        {/* Authentication */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Student Portal (Protected) */}
        <Route path="/student" element={
          <ProtectedRoute role="student">
            <StudentDashboard />
          </ProtectedRoute>
        } />
        <Route path="/student/exam/:attemptId" element={
          <ProtectedRoute role="student">
            <ExamPage />
          </ProtectedRoute>
        } />
        <Route path="/student/result/:attemptId" element={
          <ProtectedRoute role="student">
            <ResultPage />
          </ProtectedRoute>
        } />
        <Route path="/student/exam-terminated" element={<ExamTerminated />} />
        
        {/* Admin Portal (Protected) */}
        <Route path="/admin" element={
          <ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/create-exam" element={
          <ProtectedRoute role="admin">
            <CreateExam />
          </ProtectedRoute>
        } />
        <Route path="/admin/monitor" element={
          <ProtectedRoute role="admin">
            <LiveMonitor />
          </ProtectedRoute>
        } />
        <Route path="/admin/results" element={
          <ProtectedRoute role="admin">
            <ViewResults />
          </ProtectedRoute>
        } />
        <Route path="/admin/kick-log" element={
          <ProtectedRoute role="admin">
            <KickLog />
          </ProtectedRoute>
        } />
        <Route path="/admin/analytics" element={
          <ProtectedRoute role="admin">
            <Analytics />
          </ProtectedRoute>
        } />
      </Routes>
    </>
  );
}
