/**
 * API Configuration and URL Helper
 *
 * Supports:
 * 1. Same-domain deployment (e.g., full-stack Vercel serverless): uses relative `/api/...` paths.
 * 2. Decoupled deployment (e.g., Vercel frontend + Render backend): prepends `VITE_API_URL`.
 */
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export function apiUrl(endpoint) {
  if (!endpoint.startsWith('/')) {
    endpoint = `/${endpoint}`;
  }
  return `${API_BASE}${endpoint}`;
}

/**
 * Safely parses API responses to handle non-JSON / HTML error pages gracefully
 * without throwing SyntaxError.
 */
export async function safeParseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      // Fallback to text parsing
    }
  }

  const text = await response.text();

  if (text.includes('<!DOCTYPE') || text.includes('<html') || text.includes('<body')) {
    if (response.ok) {
      return {
        error:
          'Backend routing mismatch: received HTML (SPA index fallback) instead of JSON. Ensure your serverless API routes are reaching the Flask backend.',
        code: 'ROUTING_MISMATCH_HTML',
      };
    }
    return {
      error: `Server returned an error page (${response.status}). Please verify that the backend service is deployed and running.`,
      code: `SERVER_ERROR_${response.status}`,
    };
  }

  return {
    error: text || `Request completed with status ${response.status}`,
    code: `HTTP_${response.status}`,
  };
}
