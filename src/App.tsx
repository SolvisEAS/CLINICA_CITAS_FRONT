import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
import BookForPatient from "./pages/BookForPatient";
import DoctorAgenda from "./pages/DoctorAgenda";
import DoctorLogin from "./pages/DoctorLogin";
import PatientBooking from "./pages/PatientBooking";
import PatientDetail from "./pages/PatientDetail";
import UserManagement from "./pages/UserManagement";
import WeeklySchedule from "./pages/WeeklySchedule";

function HomeRoute() {
  // El formulario público de reserva es para pacientes sin cuenta; un
  // doctor/admin logueado no debe verlo, va directo a su agenda.
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/agenda" replace />;
  return <PatientBooking />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/login" element={<DoctorLogin />} />
            <Route
              path="/agenda"
              element={
                <ProtectedRoute>
                  <DoctorAgenda />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agenda/nueva"
              element={
                <ProtectedRoute>
                  <BookForPatient />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pacientes/:documentNumber"
              element={
                <ProtectedRoute>
                  <PatientDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/usuarios"
              element={
                <ProtectedRoute requireAdmin>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/horario"
              element={
                <ProtectedRoute>
                  <WeeklySchedule />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
