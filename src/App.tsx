import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import Index from "./pages/Index";
import Projects from "./pages/Projects";
import ProjectDetails from "./pages/ProjectDetails";
import ProjectOrders from "./pages/ProjectOrders";
import Workstations from "./pages/Workstations";
import Floorplan from "./pages/Floorplan";
import BrokenParts from "./pages/BrokenParts";
import BrokenPartsSummary from "./pages/BrokenPartsSummary";
import Calculation from "./pages/Calculation";
import NewCabinetProject from "./pages/NewCabinetProject";
import CabinetProjectDetails from "./pages/CabinetProjectDetails";
import CabinetLibrary from "./pages/CabinetLibrary";
import CabinetEditor from "./pages/CabinetEditor";
import CabinetModelBuilder from "./pages/CabinetModelBuilder";
import NewBrokenPart from "./pages/NewBrokenPart";
import PersonalTasks from "./pages/PersonalTasks";
import DailyTasks from "./pages/DailyTasks";
import Planning from "./pages/Planning";
import Orders from "./pages/Orders";
import Logistics from "./pages/Logistics";
import LogisticsOut from "./pages/LogisticsOut";
import RushOrders from "./pages/RushOrders";
import RushOrderDetails from "./pages/RushOrderDetails";
import TimeRegistrations from "./pages/TimeRegistrations";
import Invoices from "./pages/Invoices";
import GeneralSchedule from "./pages/GeneralSchedule";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import MigrateAuth from "./pages/MigrateAuth";
import NotesAndTasks from "./pages/NotesAndTasks";
import ControlPanel from "./pages/ControlPanel";
import WorkstationControl from "./pages/WorkstationControl";
import TruckLoadingView from "./pages/TruckLoadingView";
import PDFEditorFullscreen from "./pages/PDFEditorFullscreen";
import EditProject from "@/pages/EditProject";
import ProjectCalculation from "@/pages/ProjectCalculation";
import GlobalComponents from "./components/GlobalComponents";
import { Toaster } from "@/components/ui/toaster";

import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { TenantProvider } from "@/context/TenantContext";

import ProtectedRoute from "./components/ProtectedRoute";
import RoleProtectedRoute from "./components/RoleProtectedRoute";
import DeveloperRoute from "@/components/DeveloperRoute";
import HomeRedirect from "@/components/HomeRedirect";
import TenantLayout from "@/components/TenantLayout";
import DeveloperPortal from "@/pages/DeveloperPortal";

// Marketing site
import MarketingLayout from "@/components/marketing/MarketingLayout";
import MarketingHome from "@/pages/marketing/MarketingHome";
import MarketingFeatures from "@/pages/marketing/MarketingFeatures";
import MarketingSolutions from "@/pages/marketing/MarketingSolutions";
import MarketingIntegration from "@/pages/marketing/MarketingIntegration";
import MarketingContact from "@/pages/marketing/MarketingContact";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Helper to wrap a page in ProtectedRoute */
const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

/** Helper for role-restricted routes */
const R = ({ children, roles, logistics }: { children: React.ReactNode; roles: string[]; logistics?: boolean }) => (
  <ProtectedRoute>
    <RoleProtectedRoute allowedRoles={roles} requireLogistics={logistics}>
      {children}
    </RoleProtectedRoute>
  </ProtectedRoute>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DndProvider backend={HTML5Backend}>
        <Router>
          <TenantProvider>
            <AuthProvider>
              <LanguageProvider>
                <GlobalComponents />
                <Routes>
                  {/* ── Public root → redirect to /site ── */}
                  <Route path="/" element={<HomeRedirect />} />

                  {/* ── Marketing site ─────────────────── */}
                  <Route path="/site" element={<MarketingLayout />}>
                    <Route index element={<MarketingHome />} />
                    <Route path="features" element={<MarketingFeatures />} />
                    <Route path="solutions" element={<MarketingSolutions />} />
                    <Route path="integration" element={<MarketingIntegration />} />
                    <Route path="contact" element={<MarketingContact />} />
                  </Route>

                  {/* ── Developer ──────────────────────── */}
                  <Route path="/dev/login" element={<Login />} />
                  <Route
                    path="/dev"
                    element={
                      <DeveloperRoute>
                        <DeveloperPortal />
                      </DeveloperRoute>
                    }
                  />

                  {/* ── Global (non-tenant) ────────────── */}
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/pdf-editor" element={<P><PDFEditorFullscreen /></P>} />
                  <Route path="/migrate-auth" element={<P><MigrateAuth /></P>} />

                  {/* ── Tenant routes: /:tenant/... ────── */}
                  <Route path="/:tenant" element={<TenantLayout />}>
                    <Route path="login" element={<Login />} />
                    <Route path="forgot-password" element={<ForgotPassword />} />

                    {/* Tenant app pages under /:tenant/:lang/... */}
                    <Route path=":lang" element={<P><Index /></P>} />
                    <Route path=":lang/projects" element={<P><Projects /></P>} />
                    <Route path=":lang/projects/:projectId" element={<P><ProjectDetails /></P>} />
                    <Route path=":lang/projects/:projectId/orders" element={<P><ProjectOrders /></P>} />
                    <Route path=":lang/projects/:projectId/edit" element={<P><EditProject /></P>} />
                    <Route path=":lang/projects/:projectId/calculation" element={<P><ProjectCalculation /></P>} />
                    <Route path=":lang/workstations" element={<P><Workstations /></P>} />
                    <Route path=":lang/floorplan" element={<P><Floorplan /></P>} />
                    <Route path=":lang/broken-parts" element={<P><BrokenParts /></P>} />
                    <Route path=":lang/broken-parts/summary" element={<P><BrokenPartsSummary /></P>} />
                    <Route path=":lang/broken-parts/new" element={<P><NewBrokenPart /></P>} />
                    <Route path=":lang/personal-tasks" element={<P><PersonalTasks /></P>} />
                    <Route path=":lang/notes-and-tasks" element={<P><NotesAndTasks /></P>} />
                    <Route path=":lang/daily-tasks" element={<R roles={['admin', 'manager', 'installation_team', 'teamleader']}><DailyTasks /></R>} />
                    <Route path=":lang/planning" element={<R roles={['admin', 'manager', 'installation_team', 'teamleader']}><Planning /></R>} />
                    <Route path=":lang/orders" element={<R roles={['admin', 'manager', 'installation_team', 'teamleader', 'preparater']}><Orders /></R>} />
                    <Route path=":lang/orders/new" element={<R roles={['admin', 'manager', 'installation_team', 'teamleader', 'preparater']}><Orders /></R>} />
                    <Route path=":lang/orders/:orderId" element={<R roles={['admin', 'manager', 'installation_team', 'teamleader', 'preparater']}><Orders /></R>} />
                    <Route path=":lang/orders/:orderId/edit" element={<R roles={['admin', 'manager', 'installation_team', 'teamleader', 'preparater']}><Orders /></R>} />
                    <Route path=":lang/logistics" element={<R roles={['admin', 'manager', 'installation_team', 'teamleader', 'preparater']} logistics><Logistics /></R>} />
                    <Route path=":lang/logistics-out" element={<R roles={['admin', 'manager', 'installation_team', 'teamleader', 'preparater']} logistics><LogisticsOut /></R>} />
                    <Route path=":lang/rush-orders" element={<R roles={['admin', 'manager', 'installation_team', 'worker']}><RushOrders /></R>} />
                    <Route path=":lang/rush-orders/:rushOrderId" element={<R roles={['admin', 'manager', 'installation_team', 'worker']}><RushOrderDetails /></R>} />
                    <Route path=":lang/calculation" element={<R roles={['admin']}><Calculation /></R>} />
                    <Route path=":lang/calculation/new" element={<R roles={['admin']}><NewCabinetProject /></R>} />
                    <Route path=":lang/calculation/project/:projectId" element={<R roles={['admin']}><CabinetProjectDetails /></R>} />
                    <Route path=":lang/calculation/project/:projectId/library" element={<R roles={['admin']}><CabinetLibrary /></R>} />
                    <Route path=":lang/calculation/project/:projectId/editor/:modelId" element={<R roles={['admin']}><CabinetEditor /></R>} />
                    <Route path=":lang/calculation/model-builder/:modelId?" element={<R roles={['admin']}><CabinetModelBuilder /></R>} />
                    <Route path=":lang/time-registrations" element={<R roles={['admin', 'manager']}><TimeRegistrations /></R>} />
                    <Route path=":lang/invoices" element={<R roles={['admin', 'manager']}><Invoices /></R>} />
                    <Route path=":lang/general-schedule" element={<P><GeneralSchedule /></P>} />
                    <Route path=":lang/settings" element={<R roles={['admin']}><Settings /></R>} />
                    <Route path=":lang/control-panel" element={<R roles={['admin', 'manager', 'teamleader']}><ControlPanel /></R>} />
                    <Route path=":lang/control-panel/:workstationId" element={<R roles={['admin', 'manager', 'teamleader']}><WorkstationControl /></R>} />
                    <Route path=":lang/truck-loading" element={<R roles={['admin', 'manager', 'installation_team', 'teamleader']}><TruckLoadingView /></R>} />
                  </Route>
                </Routes>
                <Toaster />
              </LanguageProvider>
            </AuthProvider>
          </TenantProvider>
        </Router>
      </DndProvider>
    </QueryClientProvider>
  );
}

export default App;
