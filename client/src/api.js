const API_BASE_URL = "http://localhost:5000";

function getAuthToken() {
  return localStorage.getItem("authToken");
}

function setAuthToken(token) {
  localStorage.setItem("authToken", token);
}

function clearAuthToken() {
  localStorage.removeItem("authToken");
}

async function apiRequest(path, options = {}) {
  const token = getAuthToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

async function register(email, password) {
  const data = await apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  setAuthToken(data.token);
  return data;
}

async function login(email, password) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  setAuthToken(data.token);
  return data;
}

async function getCurrentUser() {
  return apiRequest("/auth/me");
}

async function listDocuments() {
  return apiRequest("/documents");
}

async function createDocument(title, content = "") {
  return apiRequest("/documents", {
    method: "POST",
    body: JSON.stringify({ title, content })
  });
}

async function deleteDocument(documentId) {
  return apiRequest(`/documents/${documentId}`, {
    method: "DELETE"
  });
}

export {
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  register,
  login,
  getCurrentUser,
  listDocuments,
  createDocument,
  deleteDocument
};