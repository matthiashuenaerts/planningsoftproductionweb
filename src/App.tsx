
import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Index from './pages/Index';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import ProjectOrders from './pages/ProjectOrders';
import Workstations from './pages/Workstations';
import BrokenParts from './pages/BrokenParts';
import BrokenPartsSummary from './pages/BrokenPartsSummary';
import NewBrokenPart from './pages/NewBrokenPart';
import PersonalTasks from './pages/PersonalTasks';
import DailyTasks from './pages/DailyTasks';
import Planning from './pages/Planning';
import Orders from './pages/Orders';
import Logistics from './pages/Logistics';
import LogisticsOut from './pages/LogisticsOut';
import RushOrders from './pages/RushOrders';
import RushOrderDetails from './pages/RushOrderDetails';
import TimeRegistrations from './pages/TimeRegistrations';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';
import EditProject from '@/pages/EditProject';
import GlobalComponents from './components/GlobalComponents';

// Create a QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <LanguageProvider>
            <GlobalComponents />
            <Routes>
              <Route path="/" element={<Navigate to="/nl/" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/:lang/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/:lang/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
              <Route path="/:lang/projects/:projectId" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
              <Route path="/:lang/projects/:projectId/orders" element={<ProtectedRoute><ProjectOrders /></ProtectedRoute>} />
              <Route path="/:lang/projects/:projectId/edit" element={<ProtectedRoute><EditProject /></ProtectedRoute>} />
              <Route path="/:lang/workstations" element={<ProtectedRoute><Workstations /></ProtectedRoute>} />
              <Route path="/:lang/broken-parts" element={<ProtectedRoute><BrokenParts /></ProtectedRoute>} />
              <Route path="/:lang/broken-parts/summary" element={<ProtectedRoute><BrokenPartsSummary /></ProtectedRoute>} />
              <Route path="/:lang/broken-parts/new" element={<ProtectedRoute><NewBrokenPart /></ProtectedRoute>} />
              <Route path="/:lang/personal-tasks" element={<ProtectedRoute><PersonalTasks /></ProtectedRoute>} />
              <Route path="/:lang/daily-tasks" element={<ProtectedRoute><DailyTasks /></ProtectedRoute>} />
              <Route path="/:lang/planning" element={<ProtectedRoute><Planning /></ProtectedRoute>} />
              <Route path="/:lang/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
              <Route path="/:lang/orders/new" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
              <Route path="/:lang/orders/:orderId" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
              <Route path="/:lang/orders/:orderId/edit" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
              <Route path="/:lang/logistics" element={<ProtectedRoute><Logistics /></ProtectedRoute>} />
              <Route path="/:lang/logistics-out" element={<ProtectedRoute><LogisticsOut /></ProtectedRoute>} />
              <Route path="/:lang/rush-orders" element={<ProtectedRoute><RushOrders /></ProtectedRoute>} />
              <Route path="/:lang/rush-orders/:rushOrderId" element={<ProtectedRoute><RushOrderDetails /></ProtectedRoute>} />
              <Route path="/:lang/time-registrations" element={<ProtectedRoute><TimeRegistrations /></ProtectedRoute>} />
              <Route path="/:lang/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            </Routes>
          </LanguageProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
