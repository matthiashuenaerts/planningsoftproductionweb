
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import TaskTimer from "./components/TaskTimer";
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
import TimeRegistrations from "./pages/TimeRegistrations";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <TaskTimer />
                  <Index />
                </ProtectedRoute>
              } />
              <Route path="/projects" element={
                <ProtectedRoute>
                  <TaskTimer />
                  <Projects />
                </ProtectedRoute>
              } />
              <Route path="/projects/:projectId" element={
                <ProtectedRoute>
                  <TaskTimer />
                  <ProjectDetails />
                </ProtectedRoute>
              } />
              <Route path="/workstations" element={
                <ProtectedRoute>
                  <TaskTimer />
                  <Workstations />
                </ProtectedRoute>
              } />
              <Route path="/personal-tasks" element={
                <ProtectedRoute>
                  <TaskTimer />
                  <PersonalTasks />
                </ProtectedRoute>
              } />
              <Route path="/daily-tasks" element={
                <ProtectedRoute>
                  <TaskTimer />
                  <DailyTasks />
                </ProtectedRoute>
              } />
              <Route path="/planning" element={
                <ProtectedRoute>
                  <TaskTimer />
                  <Planning />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <TaskTimer />
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="/orders" element={
                <ProtectedRoute>
                  <TaskTimer />
                  <Orders />
                </ProtectedRoute>
              } />
              <Route path="/projects/:projectId/orders" element={
                <ProtectedRoute>
                  <TaskTimer />
                  <ProjectOrders />
                </ProtectedRoute>
              } />
              <Route path="/rush-orders" element={
                <ProtectedRoute>
                  <TaskTimer />
                  <RushOrders />
                </ProtectedRoute>
              } />
              <Route path="/rush-orders/:rushOrderId" element={
                <ProtectedRoute>
                  <TaskTimer />
                  <RushOrderDetails />
                </ProtectedRoute>
              } />
              <Route path="/broken-parts" element={
                <ProtectedRoute>
                  <TaskTimer />
                  <BrokenParts />
                </ProtectedRoute>
              } />
              <Route path="/broken-parts/summary" element={
                <ProtectedRoute>
                  <TaskTimer />
                  <BrokenPartsSummary />
                </ProtectedRoute>
              } />
              <Route path="/broken-parts/new" element={
                <ProtectedRoute>
                  <TaskTimer />
                  <NewBrokenPart />
                </ProtectedRoute>
              } />
              <Route path="/logistics" element={
                <ProtectedRoute>
                  <TaskTimer />
                  <Logistics />
                </ProtectedRoute>
              } />
              <Route path="/time-registrations" element={
                <ProtectedRoute>
                  <TaskTimer />
                  <TimeRegistrations />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
