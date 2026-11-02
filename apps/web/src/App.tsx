import { Spin } from 'antd';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './AppLayout';
import { useAuth } from './auth';
import Announcements from './pages/Announcements';
import Approvals from './pages/Approvals';
import Attendance from './pages/Attendance';
import BrandGuide from './pages/BrandGuide';
import ClaimDetail from './pages/ClaimDetail';
import Claims from './pages/Claims';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Holidays from './pages/Holidays';
import Login from './pages/Login';
import MyLeave from './pages/MyLeave';
import Onboarding from './pages/Onboarding';
import OrgChart from './pages/OrgChart';
import Payroll from './pages/Payroll';
import Payslips from './pages/Payslips';
import Profile from './pages/Profile';
import Performance from './pages/Performance';
import ReviewDetail from './pages/ReviewDetail';
import Rewards from './pages/Rewards';
import TrainingPage from './pages/Training';

export default function App() {
  const { user, ready } = useAuth();

  if (!ready) return <Spin fullscreen />;
  if (!user) {
    return (
      <Routes>
        <Route path="brand" element={<BrandGuide />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="brand" element={<BrandGuide />} />
        <Route path="profile" element={<Profile />} />
        <Route path="leave" element={<MyLeave />} />
        <Route path="claims" element={<Claims />} />
        <Route path="claims/:id" element={<ClaimDetail />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="payslips" element={<Payslips />} />
        <Route path="reviews" element={<Performance />} />
        <Route path="reviews/:id" element={<ReviewDetail />} />
        <Route path="rewards" element={<Rewards />} />
        <Route path="training" element={<TrainingPage />} />
        <Route path="onboarding" element={<Onboarding />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="org-chart" element={<OrgChart />} />
        <Route path="holidays" element={<Holidays />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="employees" element={<Employees />} />
        <Route path="payroll" element={<Payroll />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
