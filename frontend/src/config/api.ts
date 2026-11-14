/**
 * Centralized API Configuration
 * Reads from VITE_API_BASE_URL environment variable with fallback to local development port 4300.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4300';

