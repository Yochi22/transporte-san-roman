import axios from 'axios'

export const API_BASE = import.meta.env.VITE_API_BASE || '/api'
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
})
