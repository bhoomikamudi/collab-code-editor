import axios from "axios";

const API_BASE_URL = "http://localhost:5000";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

function getAuthToken() {
  return localStorage.getItem("authToken");
}

function setAuthToken(token) {
  localStorage.setItem("authToken", token);
}

function clearAuthToken() {
  localStorage.removeItem("authToken");
}

function normalizeErrorMessage(error) {
  const data = error.response?.data;

  if (typeof data?.error === "string") {
    return data.error;
  }

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (Array.isArray(data?.detail)) {
    return data.detail
      .map((item) => item?.msg || item?.message || String(item))
      .join(", ");
  }

  if (typeof data?.message === "string") {
    return data.message;
  }

  return error.message || "Request failed";
}

async function apiRequest(path, options = {}) {
  try {
    const response = await apiClient.request({
      url: path,
      method: options.method || "GET",
      data: options.data,
      headers: options.headers
    });

    return response.data;
  } catch (error) {
    throw new Error(normalizeErrorMessage(error));
  }
}

async function register(email, password) {
  const data = await apiRequest("/auth/register", {
    method: "POST",
    data: { email, password }
  });

  setAuthToken(data.token);
  return data;
}

async function login(email, password) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    data: { email, password }
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
    data: { title, content }
  });
}

async function deleteDocument(documentId) {
  return apiRequest(`/documents/${documentId}`, {
    method: "DELETE"
  });
}

async function listDocumentHistory(documentId) {
  return apiRequest(`/documents/${documentId}/history`);
}

async function restoreDocumentSnapshot(documentId, snapshotId) {
  return apiRequest(`/documents/${documentId}/restore/${snapshotId}`, {
    method: "POST"
  });
}

async function indexCodebase(codebaseId, files) {
  return apiRequest("/ai/index", {
    method: "POST",
    data: {
      codebase_id: codebaseId,
      files
    }
  });
}

async function completeCode(
  codeContext,
  cursorPosition,
  language = "javascript",
  codebaseId = null
) {
  return apiRequest("/ai/complete", {
    method: "POST",
    data: {
      code_context: codeContext,
      cursor_position: cursorPosition,
      language,
      instruction:
        "Complete the code at the cursor position using indexed codebase context.",
      codebase_id: codebaseId
    }
  });
}

async function explainCode(
  selectedCode,
  language = "javascript",
  codebaseId = null
) {
  return apiRequest("/ai/explain", {
    method: "POST",
    data: {
      selected_code: selectedCode,
      language,
      codebase_id: codebaseId
    }
  });
}

async function chatWithCodebase(
  question,
  codeContext = "",
  language = "javascript",
  codebaseId = null
) {
  return apiRequest("/ai/chat", {
    method: "POST",
    data: {
      question,
      code_context: codeContext,
      language,
      codebase_id: codebaseId
    }
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
  deleteDocument,
  listDocumentHistory,
  restoreDocumentSnapshot,
  indexCodebase,
  completeCode,
  explainCode,
  chatWithCodebase
};