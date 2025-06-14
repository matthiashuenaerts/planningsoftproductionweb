
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import GlobalComponents from "./components/GlobalComponents";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Projects from "./pages/Projects";
import ProjectDetails from "./pages/ProjectDetails";
import Workstations from "./pages/Workstations";
import DailyTasks from "./pages/DailyTasks";
import PersonalTasks from "./pages/PersonalTasks";
import Planning from "./pages/Planning";
import Settings from "./pages/Settings";
import Orders from "./pages/Orders";
import ProjectOrders from "./pages/ProjectOrders";
import RushOrders from "./pages/RushOrders";
import RushOrderDetails from "./pages/RushOrderDetails";
import BrokenParts from "./pages/BrokenParts";
import BrokenPartsSummary from "./pages/BrokenPartsSummary";
import NewBrokenPart from "./pages/NewBrokenPart";
import Logistics from "./pages/Logistics";
import LogisticsOut from "./pages/LogisticsOut";
import TimeRegistrations from "./pages/TimeRegistrations";
import NotFound from "./pages/NotFound";
import { LanguageProvider } from "./context/LanguageContext";

const queryClient = new QueryClient();

const AppContent = () => (
  <Routes>
    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
    <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
    <Route path="/projects/:projectId" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
    <Route path="/workstations" element={<ProtectedRoute><Workstations /></ProtectedRoute>} />
    <Route path="/personal-tasks" element={<ProtectedRoute><PersonalTasks /></ProtectedRoute>} />
    <Route path="/daily-tasks" element={<ProtectedRoute><DailyTasks /></ProtectedRoute>} />
    <Route path="/planning" element={<ProtectedRoute><Planning /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
    <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
    <Route path="/projects/:projectId/orders" element={<ProtectedRoute><ProjectOrders /></ProtectedRoute>} />
    <Route path="/rush-orders" element={<ProtectedRoute><RushOrders /></ProtectedRoute>} />
    <Route path="/rush-orders/:rushOrderId" element={<ProtectedRoute><RushOrderDetails /></ProtectedRoute>} />
    <Route path="/broken-parts" element={<ProtectedRoute><BrokenParts /></ProtectedRoute>} />
    <Route path="/broken-parts/summary" element={<ProtectedRoute><BrokenPartsSummary /></ProtectedRoute>} />
    <Route path="/broken-parts/new" element={<ProtectedRoute><NewBrokenPart /></ProtectedRoute>} />
    <Route path="/logistics" element={<ProtectedRoute><Logistics /></ProtectedRoute>} />
    <Route path="/logistics-out" element={<ProtectedRoute><LogisticsOut /></ProtectedRoute>} />
    <Route path="/time-registrations" element={<ProtectedRoute><TimeRegistrations /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <LanguageProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <GlobalComponents />
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/:lang/*" element={<AppContent />} />
                <Route path="/" element={<Navigate to="/nl" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </TooltipProvider>
          </LanguageProvider>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
