
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import GlobalComponents from '@/components/GlobalComponents';

// Pages
import Index from './pages/Index';
import Login from './pages/Login';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import EditProject from './pages/EditProject';
import Planning from './pages/Planning';
import DailyTasks from './pages/DailyTasks';
import PersonalTasks from './pages/PersonalTasks';
import TimeRegistrations from './pages/TimeRegistrations';
import Settings from './pages/Settings';
import Workstations from './pages/Workstations';
import Orders from './pages/Orders';
import ProjectOrders from './pages/ProjectOrders';
import RushOrders from './pages/RushOrders';
import RushOrderDetails from './pages/RushOrderDetails';
import BrokenParts from './pages/BrokenParts';
import NewBrokenPart from './pages/NewBrokenPart';
import BrokenPartsSummary from './pages/BrokenPartsSummary';
import Logistics from './pages/Logistics';
import LogisticsOut from './pages/LogisticsOut';
import OneDriveCallback from './pages/OneDriveCallback';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <LanguageProvider>
            <AuthProvider>
              <GlobalComponents />
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/onedrive/callback" element={<OneDriveCallback />} />
                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/nl" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/nl/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
                <Route path="/nl/projects/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
                <Route path="/nl/projects/:id/edit" element={<ProtectedRoute><EditProject /></ProtectedRoute>} />
                <Route path="/nl/planning" element={<ProtectedRoute><Planning /></ProtectedRoute>} />
                <Route path="/nl/daily-tasks" element={<ProtectedRoute><DailyTasks /></ProtectedRoute>} />
                <Route path="/nl/personal-tasks" element={<ProtectedRoute><PersonalTasks /></ProtectedRoute>} />
                <Route path="/nl/time-registrations" element={<ProtectedRoute><TimeRegistrations /></ProtectedRoute>} />
                <Route path="/nl/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/nl/workstations" element={<ProtectedRoute><Workstations /></ProtectedRoute>} />
                <Route path="/nl/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                <Route path="/nl/projects/:id/orders" element={<ProtectedRoute><ProjectOrders /></ProtectedRoute>} />
                <Route path="/nl/rush-orders" element={<ProtectedRoute><RushOrders /></ProtectedRoute>} />
                <Route path="/nl/rush-orders/:id" element={<ProtectedRoute><RushOrderDetails /></ProtectedRoute>} />
                <Route path="/nl/broken-parts" element={<ProtectedRoute><BrokenParts /></ProtectedRoute>} />
                <Route path="/nl/broken-parts/new" element={<ProtectedRoute><NewBrokenPart /></ProtectedRoute>} />
                <Route path="/nl/broken-parts/summary" element={<ProtectedRoute><BrokenPartsSummary /></ProtectedRoute>} />
                <Route path="/nl/logistics" element={<ProtectedRoute><Logistics /></ProtectedRoute>} />
                <Route path="/nl/logistics-out" element={<ProtectedRoute><LogisticsOut /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <Toaster />
              <Sonner />
            </AuthProvider>
          </LanguageProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
