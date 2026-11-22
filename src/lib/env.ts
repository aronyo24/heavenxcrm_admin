// The Control Center calls the API on its own host (/api), which nginx (or
// the Vite dev proxy) forwards to Django. The backend only answers
// /api/control/ on hosts listed in CONTROL_HOSTS, never on a company's
// subdomain. Set VITE_API_BASE_URL only if the API lives elsewhere.
const raw = import.meta.env.VITE_API_BASE_URL as string | undefined

export const API_BASE_URL = raw && raw.trim() ? raw.trim().replace(/\/$/, '') : '/api'
