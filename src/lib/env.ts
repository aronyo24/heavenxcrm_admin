// Production builds call the API directly (VITE_API_BASE_URL in
// .env.production, e.g. https://uapi.heavenxcrm.com/api). When it is empty
// the app calls /api on its own host (the Vite dev proxy locally). The
// backend only answers /api/control/ on hosts in CONTROL_HOSTS, and trusts
// this app's origin via CONTROL_FRONTEND_URLS.
const raw = import.meta.env.VITE_API_BASE_URL as string | undefined

export const API_BASE_URL = raw && raw.trim() ? raw.trim().replace(/\/$/, '') : '/api'
