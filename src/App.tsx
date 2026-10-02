import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DashboardLayout } from "./components/DashboardLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicLayout } from "./components/PublicLayout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { homeFor } from "./lib/navigation";
import AdminHome from "./pages/AdminHome";
import AdminUsers from "./pages/AdminUsers";
import BookForPatient from "./pages/BookForPatient";
import DoctorAgenda from "./pages/DoctorAgenda";
import DoctorLogin from "./pages/DoctorLogin";
import MyAppointments from "./pages/MyAppointments";
import PatientBooking from "./pages/PatientBooking";
import PatientDetail from "./pages/PatientDetail";
import Patients from "./pages/Patients";
import PublicHome from "./pages/PublicHome";
import UserForm from "./pages/UserForm";
import WeeklySchedule from "./pages/WeeklySchedule";

/** El portal público es para pacientes sin cuenta; un doctor/admin logueado va a su panel. */
function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={homeFor(user)} replace />;
  return <>{children}</>;
}

function NoAccess() {
  return (
    <div className="page">
      <p className="empty-state">
        Tu usuario no tiene un perfil de doctor ni permisos de administración. Pedile a un administrador que lo
        configure.
      </p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Paciente: portal público, sin cuenta. */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<PublicOnly><PublicHome /></PublicOnly>} />
            <Route path="/agendar" element={<PublicOnly><PatientBooking /></PublicOnly>} />
            <Route path="/mis-consultas" element={<PublicOnly><MyAppointments /></PublicOnly>} />
            <Route path="/login" element={<DoctorLogin />} />
          </Route>

          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            {/* Doctor */}
            <Route path="/agenda" element={<ProtectedRoute require="doctor"><DoctorAgenda /></ProtectedRoute>} />
            <Route path="/agenda/nueva" element={<ProtectedRoute require="doctor"><BookForPatient /></ProtectedRoute>} />
            <Route path="/pacientes" element={<ProtectedRoute require="doctor"><Patients /></ProtectedRoute>} />
            <Route
              path="/pacientes/:documentNumber"
              element={<ProtectedRoute require="doctor"><PatientDetail /></ProtectedRoute>}
            />
            <Route path="/horario" element={<ProtectedRoute require="doctor"><WeeklySchedule mode="own" /></ProtectedRoute>} />

            {/* Administrador (rutas sin /admin: esa ruta es el admin de Django detrás de Nginx). */}
            <Route path="/panel" element={<ProtectedRoute require="admin"><AdminHome /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute require="admin"><AdminUsers /></ProtectedRoute>} />
            <Route path="/usuarios/nuevo" element={<ProtectedRoute require="admin"><UserForm /></ProtectedRoute>} />
            <Route path="/usuarios/:userId" element={<ProtectedRoute require="admin"><UserForm /></ProtectedRoute>} />
            <Route
              path="/horarios"
              element={<ProtectedRoute require="admin"><WeeklySchedule mode="admin" /></ProtectedRoute>}
            />

            <Route path="/sin-acceso" element={<NoAccess />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
