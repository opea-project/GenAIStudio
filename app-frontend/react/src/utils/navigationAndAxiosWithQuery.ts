// navigationAndAxiosWithQuery.ts
// Consolidated navigation and axios helpers for query string retention
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";

// --- Axios Client with Query String Propagation ---
const axiosClient = axios.create();

axiosClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    config.headers = config.headers || {};
    // Note: Setting Referer is blocked by browsers, but you can set a custom header if needed
    // config.headers["Referer"] = window.location.href;
    // Optionally, propagate query string as a custom header
    config.headers["X-Current-Query"] = window.location.search;
  }
  return config;
});

export { axiosClient };

// --- React Router: Navigation with Query String ---
/**
 * Custom hook to navigate while retaining current query parameters.
 * Usage: const navigateWithQuery = useNavigateWithQuery();
 *        navigateWithQuery('/chat/123');
 */
export function useNavigateWithQuery() {
  const navigate = useNavigate();
  const location = useLocation();
  return (to: string, options?: Parameters<typeof navigate>[1]) => {
    const hasQuery = to.includes("?");
    const query = location.search;
    if (hasQuery || !query) {
      navigate(to, options);
    } else {
      navigate(`${to}${query}`, options);
    }
  };
}

/**
 * Appends the current location's search (query string) to a given path.
 * Usage: const toWithQuery = useToWithQuery();
 *        <Link to={toWithQuery('/chat/123')} />
 */
export function useToWithQuery() {
  const location = useLocation();
  return (to: string) => {
    if (to.includes("?")) return to;
    return `${to}${location.search}`;
  };
}
