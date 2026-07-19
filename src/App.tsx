import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AuthPage from "./pages/auth/AuthPage";
import PatientDashboard from "./pages/dashboards/PatientDashboard";
import DoctorDashboard from "./pages/dashboards/DoctorDashboard";
import PharmacistDashboard from "./pages/dashboards/PharmacistDashboard";
import AdminDashboard from "./pages/dashboards/AdminDashboard";
import NotificationsPage from "./pages/NotificationsPage";
import NotFound from "./pages/NotFound";
import { DevRoleSwitcher } from "@/components/dev/DevRoleSwitcher";

const queryClient = new QueryClient();

// DEV MODE: Set to false to enable authentication
const DEV_MODE = false;

type DevRole = 'patient' | 'doctor' | 'pharmacist' | 'admin';

function DevModeRoute() {
  const [devRole, setDevRole] = useState<DevRole | null>(null);

  if (!devRole) {
    return <DevRoleSwitcher onSelectRole={setDevRole} />;
  }

  switch (devRole) {
    case 'patient':
      return <PatientDashboard />;
    case 'doctor':
      return <DoctorDashboard />;
    case 'pharmacist':
      return <PharmacistDashboard />;
    case 'admin':
      return <AdminDashboard />;
    default:
      return <DevRoleSwitcher onSelectRole={setDevRole} />;
  }
}

function ProtectedRoute() {
  const { user, profile, loading } = useAuth();

  // Use dev mode bypass
  if (DEV_MODE) {
    return <DevModeRoute />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Handle case where profile is still loading or null but user is set (rare but possible during registration)
  if (!profile) {
    // If user exists but no profile, they might need to complete setup or it's a loading glitch.
    // For now, let's allow them to auth page or show a loading/error state.
    // But typically AuthContext handles this. Let's assume if user exists, profile fetch is attempted.
    // If it failed, maybe we stay on auth.
    return <div className="min-h-screen flex items-center justify-center">Loading Profile...</div>;
  }

  // Route based on user role
  switch (profile.role) {
    case 'patient':
      return <PatientDashboard />;
    case 'doctor':
      return <DoctorDashboard />;
    case 'pharmacist':
      return <PharmacistDashboard />;
    case 'admin':
      return <AdminDashboard />;
    default:
      return <Navigate to="/auth" replace />;
  }
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ProtectedRoute />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
