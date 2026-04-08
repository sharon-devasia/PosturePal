export const API_BASE_URL = "https://posturepal-api-1077447360745.us-central1.run.app";

export const getAuthToken = () => localStorage.getItem("access_token");

export const setAuthToken = (token: string) => localStorage.setItem("access_token", token);

export const clearAuthToken = () => localStorage.removeItem("access_token");

export const apiFetch = async (endpoint: string, options?: RequestInit) => {
  const token = getAuthToken();
  const headers: HeadersInit = {
    ...options?.headers,
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Unauthorized - token might be invalid or expired
    clearAuthToken();
    window.location.href = "/auth";
    return null;
  }

  return response;
};
