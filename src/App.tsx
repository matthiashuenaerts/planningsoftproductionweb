
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { AppProvider } from '@/context/AppContext';
import { Toaster } from '@/components/ui/toaster';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';

// Import all pages
import Index from '@/pages/Index';
import Login from '@/pages/Login';
import Projects from '@/pages/Projects';
import ProjectDetails from '@/pages/ProjectDetails';
import EditProject from '@/pages/EditProject';
import Orders from '@/pages/Orders';
import ProjectOrders from '@/pages/ProjectOrders';
import Planning from '@/pages/Planning';
import DailyTasks from '@/pages/DailyTasks';
import PersonalTasks from '@/pages/PersonalTasks';
import TimeRegistrations from '@/pages/TimeRegistrations';
import Workstations from '@/pages/Workstations';
import Settings from '@/pages/Settings';
import RushOrders from '@/pages/RushOrders';
import RushOrderDetails from '@/pages/RushOrderDetails';
import BrokenParts from '@/pages/BrokenParts';
import NewBrokenPart from '@/pages/NewBrokenPart';
import BrokenPartsSummary from '@/pages/BrokenPartsSummary';
import Logistics from '@/pages/Logistics';
import LogisticsOut from '@/pages/LogisticsOut';
import OneDriveCallback from '@/pages/OneDriveCallback';
import NotFound from '@/pages/NotFound';

import './App.css';

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
        <LanguageProvider>
          <AuthProvider>
            <AppProvider>
              <div className="min-h-screen bg-background">
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/onedrive-callback" element={<OneDriveCallback />} />
                  <Route path="/*" element={
                    <ProtectedRoute>
                      <Navbar />
                      <main className="container mx-auto px-4 py-8">
                        <Routes>
                          <Route path="/" element={<Index />} />
                          <Route path="/nl" element={<Index />} />
                          <Route path="/nl/projects" element={<Projects />} />
                          <Route path="/projects" element={<Projects />} />
                          <Route path="/nl/projects/:id" element={<ProjectDetails />} />
                          <Route path="/projects/:id" element={<ProjectDetails />} />
                          <Route path="/nl/projects/:id/edit" element={<EditProject />} />
                          <Route path="/projects/:id/edit" element={<EditProject />} />
                          <Route path="/nl/orders" element={<Orders />} />
                          <Route path="/orders" element={<Orders />} />
                          <Route path="/nl/projects/:projectId/orders" element={<ProjectOrders />} />
                          <Route path="/projects/:projectId/orders" element={<ProjectOrders />} />
                          <Route path="/nl/planning" element={<Planning />} />
                          <Route path="/planning" element={<Planning />} />
                          <Route path="/nl/daily-tasks" element={<DailyTasks />} />
                          <Route path="/daily-tasks" element={<DailyTasks />} />
                          <Route path="/nl/personal-tasks" element={<PersonalTasks />} />
                          <Route path="/personal-tasks" element={<PersonalTasks />} />
                          <Route path="/nl/time-registrations" element={<TimeRegistrations />} />
                          <Route path="/time-registrations" element={<TimeRegistrations />} />
                          <Route path="/nl/workstations" element={<Workstations />} />
                          <Route path="/workstations" element={<Workstations />} />
                          <Route path="/nl/settings" element={<Settings />} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="/nl/rush-orders" element={<RushOrders />} />
                          <Route path="/rush-orders" element={<RushOrders />} />
                          <Route path="/nl/rush-orders/:id" element={<RushOrderDetails />} />
                          <Route path="/rush-orders/:id" element={<RushOrderDetails />} />
                          <Route path="/nl/broken-parts" element={<BrokenParts />} />
                          <Route path="/broken-parts" element={<BrokenParts />} />
                          <Route path="/nl/broken-parts/new" element={<NewBrokenPart />} />
                          <Route path="/broken-parts/new" element={<NewBrokenPart />} />
                          <Route path="/nl/broken-parts-summary" element={<BrokenPartsSummary />} />
                          <Route path="/broken-parts-summary" element={<BrokenPartsSummary />} />
                          <Route path="/nl/logistics" element={<Logistics />} />
                          <Route path="/logistics" element={<Logistics />} />
                          <Route path="/nl/logistics-out" element={<LogisticsOut />} />
                          <Route path="/logistics-out" element={<LogisticsOut />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </main>
                    </ProtectedRoute>
                  } />
                </Routes>
              </div>
              <Toaster />
            </AppProvider>
          </AuthProvider>
        </LanguageProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
