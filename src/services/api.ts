import axios, { AxiosError } from "axios";

export const API_URL = import.meta.env.VITE_API_URL as string;

const ACCESS_KEY = "access";
const REFRESH_KEY = "refresh";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh?: string) {
  localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

const client = axios.create({ baseURL: API_URL });

client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const res = await axios.post(`${API_URL}/auth/refresh/`, { refresh });
    const access = res.data.access as string;
    setTokens(access, res.data.refresh);
    return access;
  } catch {
    clearTokens();
    return null;
  }
}

client.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retry && getRefreshToken()) {
      original._retry = true;
      if (!refreshPromise) refreshPromise = refreshAccessToken();
      const newAccess = await refreshPromise;
      refreshPromise = null;
      if (newAccess) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newAccess}`;
        return client(original);
      }
    }
    return Promise.reject(error);
  }
);

export interface Doctor {
  id: number;
  user: number;
  full_name: string;
  email: string;
  specialty: string;
  appointment_duration_minutes: number;
  active: boolean;
  created_at: string;
}

export interface Slot {
  start_datetime: string;
  end_datetime: string;
}

export interface Appointment {
  id: number;
  patient: string;
  patient_name: string;
  doctor: number;
  doctor_name: string;
  start_datetime: string;
  end_datetime: string;
  status: "CONFIRMADA" | "ATENDIDA" | "NO_ASISTIO" | "CANCELADA";
  notes: string;
  created_at: string;
}

export interface TreatmentRecord {
  id: number;
  patient: string;
  doctor: number;
  doctor_name: string;
  appointment: number | null;
  reason: string;
  /** Observaciones */
  description: string;
  treatment: string;
  created_at: string;
}

export interface Patient {
  document_number: string;
  name: string;
  phone: string;
  email: string;
  created_at: string;
}

export interface PatientDetail extends Patient {
  appointments: Appointment[];
  treatment_records: TreatmentRecord[];
}

export interface Me {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: "DOCTOR" | "ADMIN" | "PACIENTE";
  is_active: boolean;
  date_joined: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type ApiFieldErrors = Record<string, string[]>;

export function extractFieldErrors(err: unknown): ApiFieldErrors {
  if (axios.isAxiosError(err) && err.response?.status === 400) {
    return err.response.data as ApiFieldErrors;
  }
  return { non_field_errors: ["Ocurrió un error inesperado. Intentá de nuevo."] };
}

// --- Auth (doctor/admin) ---

export async function loginDoctor(username: string, password: string) {
  const res = await client.post("/auth/login/", { username, password });
  return res.data as { access: string; refresh: string };
}

export async function logoutDoctor() {
  const refresh = getRefreshToken();
  if (refresh) {
    try {
      await client.post("/auth/logout/", { refresh });
    } catch {
      // best-effort, seguimos limpiando el token local igual
    }
  }
  clearTokens();
}

export async function getMe() {
  const res = await client.get("/users/me/");
  return res.data as Me;
}

// --- Doctores ---

export async function getDoctors() {
  const res = await client.get("/doctors/", { params: { active: true } });
  return (res.data as Paginated<Doctor>).results;
}

// --- Disponibilidad ---

export async function getAvailability(doctorId: number, date: string) {
  const res = await client.get(`/doctors/${doctorId}/availability/`, { params: { date } });
  return res.data as Slot[];
}

/** Días del rango [start, end] con al menos un horario libre. */
export async function getAvailableDays(doctorId: number, start: string, end: string) {
  const res = await client.get(`/doctors/${doctorId}/available-days/`, { params: { start, end } });
  return res.data as { date: string; available_slots: number }[];
}

// --- Turnos: flujo paciente (público) ---

/**
 * Si la cédula ya existe, el backend ignora name/phone/email y usa los
 * datos guardados; para un paciente nuevo name y phone son obligatorios.
 */
export interface CreateAppointmentInput {
  document_number: string;
  name?: string;
  phone?: string;
  email?: string;
  doctor: number;
  start_datetime: string;
  /** Motivo de la consulta. */
  notes?: string;
}

export async function createAppointment(data: CreateAppointmentInput) {
  const res = await client.post("/appointments/", data);
  return res.data as Appointment;
}

/** Público: dice si la cédula ya es paciente (devuelve solo el nombre). */
export async function checkPatientExists(documentNumber: string) {
  const res = await client.get(`/patients/${documentNumber}/exists/`);
  return res.data as { exists: boolean; name?: string };
}

// --- Turnos: flujo doctor/admin ---

export async function getAgenda(date: string, doctorId?: number) {
  const params: Record<string, string | number> = { date };
  if (doctorId) params.doctor = doctorId;
  const res = await client.get("/appointments/agenda/", { params });
  return res.data as { date: string; doctor: number; appointments: Appointment[] };
}

export async function updateAppointmentStatus(
  appointmentId: number,
  status: "ATENDIDA" | "NO_ASISTIO" | "CANCELADA"
) {
  const res = await client.patch(`/appointments/${appointmentId}/status/`, { status });
  return res.data as Appointment;
}

// --- Pacientes (doctor/admin) ---

/** Un DOCTOR recibe solo los pacientes con los que tuvo turnos; un ADMIN, todos. */
export async function getPatients(page = 1) {
  const res = await client.get("/patients/", { params: { page } });
  return res.data as Paginated<Patient>;
}

export async function getPatientDetail(documentNumber: string) {
  const res = await client.get(`/patients/${documentNumber}/`);
  return res.data as PatientDetail;
}

// --- Gestión de usuarios (solo ADMIN) ---

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: "DOCTOR" | "ADMIN" | "PACIENTE";
  is_active: boolean;
  date_joined: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: "DOCTOR" | "ADMIN";
  specialty?: string;
  appointment_duration_minutes?: number;
}

export async function getUsers(role?: "DOCTOR" | "ADMIN") {
  const res = await client.get("/users/", { params: role ? { role } : {} });
  return (res.data as Paginated<AdminUser>).results;
}

export async function createUser(data: CreateUserInput) {
  const res = await client.post("/users/", data);
  return res.data as AdminUser;
}

export async function setUserPassword(userId: number, newPassword: string) {
  await client.patch(`/users/${userId}/set-password/`, { new_password: newPassword });
}

export async function createTreatmentRecord(
  documentNumber: string,
  data: {
    reason?: string;
    /** Observaciones (obligatorio). */
    description: string;
    treatment?: string;
    appointment?: number;
    doctor?: number;
  }
) {
  const res = await client.post(`/patients/${documentNumber}/treatments/`, data);
  return res.data as TreatmentRecord;
}

// --- Horario semanal (doctor/admin) ---

export interface WeeklyScheduleBlock {
  id: number;
  doctor: number;
  weekday: number;
  weekday_display: string;
  start_time: string;
  end_time: string;
  active: boolean;
}

export async function getWeeklySchedules(doctorId?: number) {
  const res = await client.get("/weekly-schedules/", { params: doctorId ? { doctor: doctorId } : {} });
  return (res.data as Paginated<WeeklyScheduleBlock>).results;
}

export async function createWeeklySchedule(data: {
  weekday: number;
  start_time: string;
  end_time: string;
  doctor?: number;
}) {
  const res = await client.post("/weekly-schedules/", data);
  return res.data as WeeklyScheduleBlock;
}

export async function deleteWeeklySchedule(id: number) {
  await client.delete(`/weekly-schedules/${id}/`);
}
