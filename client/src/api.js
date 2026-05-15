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
    body: JSON.stringify({
      codebase_id: codebaseId,
      files
    })
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
    body: JSON.stringify({
      code_context: codeContext,
      cursor_position: cursorPosition,
      language,
      instruction:
        "Complete the code at the cursor position using indexed codebase context.",
      codebase_id: codebaseId
    })
  });
}

async function explainCode(
  selectedCode,
  language = "javascript",
  codebaseId = null
) {
  return apiRequest("/ai/explain", {
    method: "POST",
    body: JSON.stringify({
      selected_code: selectedCode,
      language,
      codebase_id: codebaseId
    })
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
    body: JSON.stringify({
      question,
      code_context: codeContext,
      language,
      codebase_id: codebaseId
    })
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