import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DashboardLayout } from "./components/DashboardLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicLayout } from "./components/PublicLayout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import BookForPatient from "./pages/BookForPatient";
import DoctorAgenda from "./pages/DoctorAgenda";
import DoctorLogin from "./pages/DoctorLogin";
import PatientBooking from "./pages/PatientBooking";
import PatientDetail from "./pages/PatientDetail";
import Patients from "./pages/Patients";
import UserManagement from "./pages/UserManagement";
import WeeklySchedule from "./pages/WeeklySchedule";

function HomeRoute() {
  // El portal público es para pacientes sin cuenta; un doctor/admin logueado va a su agenda.
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/agenda" replace />;
  return <PatientBooking />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/login" element={<DoctorLogin />} />
          </Route>
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/agenda" element={<DoctorAgenda />} />
            <Route path="/agenda/nueva" element={<BookForPatient />} />
            <Route path="/pacientes" element={<Patients />} />
            <Route path="/pacientes/:documentNumber" element={<PatientDetail />} />
            <Route path="/horario" element={<WeeklySchedule />} />
            <Route
              path="/usuarios"
              element={
                <ProtectedRoute requireAdmin>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
