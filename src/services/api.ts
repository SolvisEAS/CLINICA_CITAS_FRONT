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

/** Se dispara en `window` cuando la sesión venció y no se pudo renovar (lo escucha AuthContext). */
export const SESSION_EXPIRED_EVENT = "auth:session-expired";

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
    if (error.response?.status !== 401 || !original || original._retry || !original.headers.Authorization) {
      return Promise.reject(error);
    }
    original._retry = true;
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newAccess = await refreshPromise;
    if (newAccess) {
      original.headers.Authorization = `Bearer ${newAccess}`;
      return client(original);
    }
    // No se pudo renovar: la app vuelve al login, y la request se reintenta sin token para que
    // un endpoint público (portal del paciente) no falle solo por un token viejo en el navegador.
    clearTokens();
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    original.headers.delete("Authorization");
    return client(original);
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
  /** Fecha del registro: la de la consulta asociada o, si no tiene, la de carga. */
  date: string;
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
  /** Última consulta atendida (con cualquier doctor), o null. */
  last_visit: string | null;
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
  /** Administra usuarios (grupo Administradores o superusuario). */
  is_admin: boolean;
  /** Perfil de doctor, o null si no tiene (un administrador). */
  doctor_id: number | null;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type ApiFieldErrors = Record<string, string[]>;

export const TOO_MANY_ATTEMPTS = "Hiciste demasiados intentos seguidos. Esperá un minuto y probá de nuevo.";

/** El backend limita los intentos por IP en los endpoints públicos con CI (429). */
export function isTooManyAttempts(err: unknown) {
  return axios.isAxiosError(err) && err.response?.status === 429;
}

export function extractFieldErrors(err: unknown): ApiFieldErrors {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    if (status === 400) return err.response!.data as ApiFieldErrors;
    if (status === 429) return { non_field_errors: [TOO_MANY_ATTEMPTS] };
    const detail = (err.response?.data as { detail?: string } | undefined)?.detail;
    if (detail) return { non_field_errors: [detail] };
  }
  return { non_field_errors: ["Ocurrió un error inesperado. Intentá de nuevo."] };
}

/** Todos los mensajes de error de una respuesta, en un solo texto. */
export function errorText(err: unknown) {
  return Object.values(extractFieldErrors(err)).flat().join(" ");
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

/** Lo que el portal público muestra de una consulta (sin datos personales). */
export interface PublicAppointment {
  id: number;
  doctor: number;
  doctor_name: string;
  doctor_specialty: string;
  start_datetime: string;
  end_datetime: string;
  status: Appointment["status"];
  /** El backend igual lo vuelve a validar al modificar. */
  can_modify: boolean;
}

/** Consultas futuras pendientes de una CI. Una CI nunca registrada da lista vacía. */
export async function getMyAppointments(documentNumber: string) {
  try {
    const res = await client.get(`/patients/${documentNumber}/appointments/`);
    return (res.data as Paginated<PublicAppointment>).results;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return [];
    throw err;
  }
}

/** Cambiar de doctor exige también un horario nuevo. */
export async function modifyMyAppointment(
  documentNumber: string,
  appointmentId: number,
  data: { start_datetime: string; doctor?: number }
) {
  const res = await client.patch(`/patients/${documentNumber}/appointments/${appointmentId}/`, data);
  return res.data as PublicAppointment;
}

// --- Turnos: flujo doctor ---

export async function getAgenda(date: string) {
  const res = await client.get("/appointments/agenda/", { params: { date } });
  return res.data as { date: string; doctor: number; appointments: Appointment[] };
}

/** Próximas consultas pendientes del doctor, de ahora en adelante. */
export async function getUpcomingAppointments(page = 1) {
  const res = await client.get("/appointments/upcoming/", { params: { page } });
  return res.data as Paginated<Appointment>;
}

export async function updateAppointmentStatus(
  appointmentId: number,
  status: "ATENDIDA" | "NO_ASISTIO" | "CANCELADA"
) {
  const res = await client.patch(`/appointments/${appointmentId}/status/`, { status });
  return res.data as Appointment;
}

// --- Pacientes (doctor) ---

/** Pacientes con los que el doctor tuvo turnos; `search` filtra por nombre o CI en el servidor. */
export async function getPatients(page = 1, search = "") {
  const res = await client.get("/patients/", { params: search ? { page, search } : { page } });
  return res.data as Paginated<Patient>;
}

export async function getPatientDetail(documentNumber: string) {
  const res = await client.get(`/patients/${documentNumber}/`);
  return res.data as PatientDetail;
}

// --- Usuarios médicos (solo administradores) ---

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: "DOCTOR" | "ADMIN" | "PACIENTE";
  is_active: boolean;
  is_superuser: boolean;
  is_admin: boolean;
  date_joined: string;
  last_login: string | null;
  doctor: { id: number; specialty: string; appointment_duration_minutes: number; active: boolean } | null;
}

export interface UserInput {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone: string;
  role: "DOCTOR" | "ADMIN";
  is_active: boolean;
  specialty?: string;
  appointment_duration_minutes?: number;
}

/** Todos los usuarios del panel (recorre las páginas: son pocos). */
export async function getAllUsers() {
  const users: AdminUser[] = [];
  for (let page = 1; ; page++) {
    const res = await client.get("/users/", { params: { page } });
    const data = res.data as Paginated<AdminUser>;
    users.push(...data.results);
    if (!data.next) return users;
  }
}

export async function getUser(userId: number) {
  const res = await client.get(`/users/${userId}/`);
  return res.data as AdminUser;
}

export async function createUser(data: UserInput & { password: string; password_confirm: string }) {
  const res = await client.post("/users/", data);
  return res.data as AdminUser;
}

export async function updateUser(userId: number, data: Partial<UserInput>) {
  const res = await client.patch(`/users/${userId}/`, data);
  return res.data as AdminUser;
}

export async function setUserPassword(userId: number, newPassword: string, confirmation: string) {
  await client.patch(`/users/${userId}/set-password/`, {
    new_password: newPassword,
    new_password_confirm: confirmation,
  });
}

export async function createTreatmentRecord(
  documentNumber: string,
  data: {
    reason?: string;
    /** Observaciones (obligatorio). */
    description: string;
    treatment?: string;
    /** Consulta a la que corresponde: de ahí sale la fecha del registro. */
    appointment?: number;
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
