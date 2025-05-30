
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
                  <div className="pt-20">
                    <TaskTimer />
                    <Index />
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/projects" element={
                <ProtectedRoute>
                  <div className="pt-20">
                    <TaskTimer />
                    <Projects />
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/projects/:projectId" element={
                <ProtectedRoute>
                  <div className="pt-20">
                    <TaskTimer />
                    <ProjectDetails />
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/workstations" element={
                <ProtectedRoute>
                  <div className="pt-20">
                    <TaskTimer />
                    <Workstations />
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/personal-tasks" element={
                <ProtectedRoute>
                  <div className="pt-20">
                    <TaskTimer />
                    <PersonalTasks />
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/daily-tasks" element={
                <ProtectedRoute>
                  <div className="pt-20">
                    <TaskTimer />
                    <DailyTasks />
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/planning" element={
                <ProtectedRoute>
                  <div className="pt-20">
                    <TaskTimer />
                    <Planning />
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <div className="pt-20">
                    <TaskTimer />
                    <Settings />
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/orders" element={
                <ProtectedRoute>
                  <div className="pt-20">
                    <TaskTimer />
                    <Orders />
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/projects/:projectId/orders" element={
                <ProtectedRoute>
                  <div className="pt-20">
                    <TaskTimer />
                    <ProjectOrders />
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/rush-orders" element={
                <ProtectedRoute>
                  <div className="pt-20">
                    <TaskTimer />
                    <RushOrders />
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/rush-orders/:rushOrderId" element={
                <ProtectedRoute>
                  <div className="pt-20">
                    <TaskTimer />
                    <RushOrderDetails />
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/broken-parts" element={
                <ProtectedRoute>
                  <div className="pt-20">
                    <TaskTimer />
                    <BrokenParts />
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/broken-parts/summary" element={
                <ProtectedRoute>
                  <div className="pt-20">
                    <TaskTimer />
                    <BrokenPartsSummary />
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/broken-parts/new" element={
                <ProtectedRoute>
                  <div className="pt-20">
                    <TaskTimer />
                    <NewBrokenPart />
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/logistics" element={
                <ProtectedRoute>
                  <div className="pt-20">
                    <TaskTimer />
                    <Logistics />
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/time-registrations" element={
                <ProtectedRoute>
                  <div className="pt-20">
                    <TaskTimer />
                    <TimeRegistrations />
                  </div>
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
