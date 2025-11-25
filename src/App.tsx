
import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Index from './pages/Index';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import ProjectOrders from './pages/ProjectOrders';
import Workstations from './pages/Workstations';
import Floorplan from './pages/Floorplan';
import BrokenParts from './pages/BrokenParts';
import BrokenPartsSummary from './pages/BrokenPartsSummary';
import Calculation from './pages/Calculation';
import NewCabinetProject from './pages/NewCabinetProject';
import CabinetProjectDetails from './pages/CabinetProjectDetails';
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
import GeneralSchedule from './pages/GeneralSchedule';
import Settings from './pages/Settings';
import Login from './pages/Login';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import MigrateAuth from './pages/MigrateAuth';
import NotesAndTasks from './pages/NotesAndTasks';
import ControlPanel from './pages/ControlPanel';
import WorkstationControl from './pages/WorkstationControl';
import TruckLoadingView from './pages/TruckLoadingView';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';
import EditProject from '@/pages/EditProject';
import ProjectCalculation from '@/pages/ProjectCalculation';
import GlobalComponents from './components/GlobalComponents';
import { Toaster } from '@/components/ui/toaster';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

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
      <DndProvider backend={HTML5Backend}>
        <Router>
          <AuthProvider>
            <LanguageProvider>
              <GlobalComponents />
              <Routes>
                <Route path="/" element={<Navigate to="/nl/" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/migrate-auth" element={<ProtectedRoute><MigrateAuth /></ProtectedRoute>} />
                <Route path="/:lang/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/:lang/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
                <Route path="/:lang/projects/:projectId" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
                <Route path="/:lang/projects/:projectId/orders" element={<ProtectedRoute><ProjectOrders /></ProtectedRoute>} />
                <Route path="/:lang/projects/:projectId/edit" element={<ProtectedRoute><EditProject /></ProtectedRoute>} />
                <Route path="/:lang/projects/:projectId/calculation" element={<ProtectedRoute><ProjectCalculation /></ProtectedRoute>} />
                <Route path="/:lang/workstations" element={<ProtectedRoute><Workstations /></ProtectedRoute>} />
                <Route path="/:lang/floorplan" element={<ProtectedRoute><Floorplan /></ProtectedRoute>} />
                <Route path="/:lang/broken-parts" element={<ProtectedRoute><BrokenParts /></ProtectedRoute>} />
                <Route path="/:lang/broken-parts/summary" element={<ProtectedRoute><BrokenPartsSummary /></ProtectedRoute>} />
                <Route path="/:lang/broken-parts/new" element={<ProtectedRoute><NewBrokenPart /></ProtectedRoute>} />
                <Route path="/:lang/personal-tasks" element={<ProtectedRoute><PersonalTasks /></ProtectedRoute>} />
                <Route path="/:lang/notes-and-tasks" element={<ProtectedRoute><NotesAndTasks /></ProtectedRoute>} />
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
                <Route path="/:lang/calculation" element={<ProtectedRoute><Calculation /></ProtectedRoute>} />
                <Route path="/:lang/calculation/new" element={<ProtectedRoute><NewCabinetProject /></ProtectedRoute>} />
                <Route path="/:lang/calculation/project/:projectId" element={<ProtectedRoute><CabinetProjectDetails /></ProtectedRoute>} />
                <Route path="/:lang/time-registrations" element={<ProtectedRoute><TimeRegistrations /></ProtectedRoute>} />
                <Route path="/:lang/general-schedule" element={<ProtectedRoute><GeneralSchedule /></ProtectedRoute>} />
                <Route path="/:lang/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/:lang/control-panel" element={<ProtectedRoute><ControlPanel /></ProtectedRoute>} />
                <Route path="/:lang/control-panel/:workstationId" element={<ProtectedRoute><WorkstationControl /></ProtectedRoute>} />
                <Route path="/:lang/truck-loading" element={<ProtectedRoute><TruckLoadingView /></ProtectedRoute>} />
              </Routes>
              <Toaster />
            </LanguageProvider>
          </AuthProvider>
        </Router>
      </DndProvider>
    </QueryClientProvider>
  );
}

export default App;
