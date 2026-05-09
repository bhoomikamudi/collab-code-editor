import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import {
  clearAuthToken,
  completeCode,
  createDocument,
  deleteDocument,
  getAuthToken,
  getCurrentUser,
  listDocuments,
  login,
  register
} from "./api";

const WS_URL = "ws://localhost:5000";

function applySimpleOperation(content, operation) {
  if (!operation || typeof operation !== "object") {
    return content;
  }

  if (operation.type === "insert") {
    return (
      content.slice(0, operation.position) +
      operation.text +
      content.slice(operation.position)
    );
  }

  if (operation.type === "delete") {
    return (
      content.slice(0, operation.position) +
      content.slice(operation.position + operation.length)
    );
  }

  return content;
}

function getInsertOperation(previousValue, nextValue) {
  if (nextValue.length <= previousValue.length) {
    return null;
  }

  let index = 0;

  while (
    index < previousValue.length &&
    previousValue[index] === nextValue[index]
  ) {
    index += 1;
  }

  const insertedText = nextValue.slice(index, index + nextValue.length - previousValue.length);

  return {
    type: "insert",
    position: index,
    text: insertedText
  };
}

function App() {
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("password123");
  const [newTitle, setNewTitle] = useState("Untitled JavaScript File");
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [editorValue, setEditorValue] = useState("");
  const [revision, setRevision] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [presence, setPresence] = useState([]);
  const [status, setStatus] = useState("Checking session...");
  const [isLoading, setIsLoading] = useState(false);

  const wsRef = useRef(null);
  const editorValueRef = useRef("");
  const suppressChangeRef = useRef(false);

  useEffect(() => {
    async function loadSession() {
      if (!getAuthToken()) {
        setStatus("Please login or create an account.");
        return;
      }

      try {
        const data = await getCurrentUser();
        setUser(data.user);
        setStatus("Session restored.");
        await loadDocuments();
      } catch (error) {
        clearAuthToken();
        setStatus("Session expired. Please login again.");
      }
    }

    loadSession();
  }, []);

  useEffect(() => {
    editorValueRef.current = editorValue;
  }, [editorValue]);

  useEffect(() => {
    if (!selectedDocument || !getAuthToken()) {
      return;
    }

    const socket = new WebSocket(WS_URL);
    wsRef.current = socket;
    setConnectionStatus("Connecting...");

    socket.onopen = () => {
      setConnectionStatus("Connected");

      socket.send(
        JSON.stringify({
          type: "JOIN_DOCUMENT",
          documentId: selectedDocument.id,
          token: getAuthToken()
        })
      );
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "DOCUMENT_JOINED") {
        suppressChangeRef.current = true;
        setEditorValue(message.document.content || "");
        editorValueRef.current = message.document.content || "";
        setRevision(message.revision || 0);
        setPresence(message.presence || []);
        setStatus("Joined real-time document room.");
        setTimeout(() => {
          suppressChangeRef.current = false;
        }, 0);
      }

      if (message.type === "OPERATION_ACK") {
        setRevision(message.revision);
        setStatus(`Saved at revision ${message.revision}.`);
      }

      if (message.type === "REMOTE_OPERATION") {
        suppressChangeRef.current = true;
        const nextValue = applySimpleOperation(
          editorValueRef.current,
          message.operation
        );

        setEditorValue(nextValue);
        editorValueRef.current = nextValue;
        setRevision(message.revision);
        setStatus(`Remote update received at revision ${message.revision}.`);

        setTimeout(() => {
          suppressChangeRef.current = false;
        }, 0);
      }

      if (message.type === "CURSOR_UPDATE") {
        setPresence((currentPresence) => {
          const others = currentPresence.filter(
            (item) => item.userId !== message.presence.userId
          );
          return [...others, message.presence];
        });
      }

      if (message.type === "USER_JOINED") {
        setPresence((currentPresence) => {
          const others = currentPresence.filter(
            (item) => item.userId !== message.presence.userId
          );
          return [...others, message.presence];
        });
      }

      if (message.type === "USER_LEFT") {
        setPresence((currentPresence) =>
          currentPresence.filter((item) => item.userId !== message.user.userId)
        );
      }

      if (message.type === "ERROR") {
        setStatus(message.error);
      }
    };

    socket.onerror = () => {
      setConnectionStatus("Error");
      setStatus("WebSocket connection error.");
    };

    socket.onclose = () => {
      setConnectionStatus("Disconnected");
    };

    return () => {
      socket.close();
    };
  }, [selectedDocument]);

  async function loadDocuments() {
    const data = await listDocuments();
    setDocuments(data.documents);
  }

  async function handleAuth(event) {
    event.preventDefault();
    setIsLoading(true);
    setStatus("");

    try {
      const data =
        authMode === "login"
          ? await login(email, password)
          : await register(email, password);

      setUser(data.user);
      setStatus(authMode === "login" ? "Login successful." : "Account created.");
      await loadDocuments();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateDocument(event) {
    event.preventDefault();

    if (!newTitle.trim()) {
      setStatus("Document title is required.");
      return;
    }

    setIsLoading(true);

    try {
      const data = await createDocument(
        newTitle,
        'function helloWorld() {\n  console.log("Hello from Collab Code Editor");\n}'
      );

      setSelectedDocument(data.document);
      setNewTitle("Untitled JavaScript File");
      setStatus("Document created successfully.");
      await loadDocuments();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteDocument(documentId) {
    setIsLoading(true);

    try {
      await deleteDocument(documentId);

      if (selectedDocument?.id === documentId) {
        setSelectedDocument(null);
        setEditorValue("");
      }

      setStatus("Document deleted successfully.");
      await loadDocuments();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleEditorChange(nextValue) {
    if (suppressChangeRef.current) {
      return;
    }

    const previousValue = editorValueRef.current;
    const operation = getInsertOperation(previousValue, nextValue);

    setEditorValue(nextValue);
    editorValueRef.current = nextValue;

    if (!operation) {
      setStatus("Only insert operations are synced in this prototype.");
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "OPERATION",
          revision,
          operation
        })
      );
    }
  }

  function handleEditorUpdate(viewUpdate) {
    if (!viewUpdate.selectionSet || !wsRef.current) {
      return;
    }

    const cursorPosition = viewUpdate.state.selection.main.head;

    if (wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "CURSOR",
          cursor: {
            position: cursorPosition,
            selectionStart: viewUpdate.state.selection.main.from,
            selectionEnd: viewUpdate.state.selection.main.to
          }
        })
      );
    }
  }

  async function handleAiComplete() {
    if (!selectedDocument) {
      setStatus("Select a document before using AI completion.");
      return;
    }

    setIsLoading(true);
    setStatus("Generating AI completion...");

    try {
      const cursorPosition = editorValue.length;
      const data = await completeCode(editorValue, cursorPosition, "javascript");
      const nextValue = editorValue + data.completion;

      handleEditorChange(nextValue);
      setStatus(`AI completion inserted using ${data.model}.`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleLogout() {
    clearAuthToken();
    setUser(null);
    setDocuments([]);
    setSelectedDocument(null);
    setEditorValue("");
    setPresence([]);
    setStatus("Logged out.");
  }

  if (!user) {
    return (
      <main style={styles.page}>
        <section style={styles.authCard}>
          <p style={styles.badge}>Project A</p>
          <h1 style={styles.title}>Collab Code Editor</h1>
          <p style={styles.description}>
            Sign in to manage collaborative coding documents with real-time sync
            and AI assistance.
          </p>

          <form onSubmit={handleAuth} style={styles.form}>
            <label style={styles.label}>
              Email
              <input
                style={styles.input}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label style={styles.label}>
              Password
              <input
                style={styles.input}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 8 characters"
              />
            </label>

            <button style={styles.primaryButton} disabled={isLoading}>
              {isLoading
                ? "Please wait..."
                : authMode === "login"
                  ? "Login"
                  : "Create Account"}
            </button>
          </form>

          <button
            style={styles.linkButton}
            onClick={() =>
              setAuthMode(authMode === "login" ? "register" : "login")
            }
          >
            {authMode === "login"
              ? "Need an account? Register"
              : "Already have an account? Login"}
          </button>

          {status && <p style={styles.status}>{status}</p>}
        </section>
      </main>
    );
  }

  return (
    <main style={styles.appShell}>
      <aside style={styles.sidebar}>
        <div>
          <p style={styles.badge}>Project A</p>
          <h1 style={styles.sidebarTitle}>Documents</h1>
          <p style={styles.userText}>{user.email}</p>
        </div>

        <form onSubmit={handleCreateDocument} style={styles.createForm}>
          <input
            style={styles.input}
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="New document title"
          />
          <button style={styles.primaryButton} disabled={isLoading}>
            Create Document
          </button>
        </form>

        <div style={styles.documentList}>
          {documents.length === 0 ? (
            <p style={styles.emptyText}>No documents yet. Create one above.</p>
          ) : (
            documents.map((document) => (
              <div
                key={document.id}
                style={{
                  ...styles.documentItem,
                  ...(selectedDocument?.id === document.id
                    ? styles.documentItemActive
                    : {})
                }}
              >
                <button
                  style={styles.documentButton}
                  onClick={() => setSelectedDocument(document)}
                >
                  <strong>{document.title}</strong>
                  <span>{new Date(document.updated_at).toLocaleString()}</span>
                </button>

                <button
                  style={styles.deleteButton}
                  onClick={() => handleDeleteDocument(document.id)}
                  disabled={isLoading}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>

        <button style={styles.secondaryButton} onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <section style={styles.workspace}>
        <header style={styles.workspaceHeader}>
          <div>
            <p style={styles.badge}>Editor</p>
            <h2 style={styles.workspaceTitle}>
              {selectedDocument ? selectedDocument.title : "Select a document"}
            </h2>
          </div>

          <div style={styles.headerRight}>
            <span style={styles.connectionPill}>{connectionStatus}</span>
            <button
              style={styles.aiButton}
              onClick={handleAiComplete}
              disabled={!selectedDocument || isLoading}
            >
              AI Complete
            </button>
          </div>
        </header>

        <div style={styles.editorPreview}>
          {selectedDocument ? (
            <>
              <div style={styles.editorTopBar}>
                <span style={styles.dot}></span>
                <span style={styles.dot}></span>
                <span style={styles.dot}></span>
                <span style={styles.fileName}>{selectedDocument.title}</span>
                <span style={styles.revisionText}>Revision {revision}</span>
              </div>

              <CodeMirror
                value={editorValue}
                height="520px"
                extensions={[javascript()]}
                theme="dark"
                onChange={handleEditorChange}
                onUpdate={handleEditorUpdate}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  highlightActiveLine: true
                }}
              />

              <div style={styles.presencePanel}>
                <strong>Presence:</strong>{" "}
                {presence.length === 0
                  ? "No active users"
                  : presence.map((item) => item.email).join(", ")}
              </div>
            </>
          ) : (
            <div style={styles.placeholder}>
              <h3>Select a document to start editing.</h3>
              <p>
                The editor will connect to WebSocket sync after a document is
                selected.
              </p>
            </div>
          )}
        </div>

        {status && <p style={styles.status}>{status}</p>}
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    background: "#0f172a",
    color: "#f8fafc",
    padding: "24px"
  },
  authCard: {
    width: "100%",
    maxWidth: "480px",
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: "22px",
    padding: "36px",
    boxShadow: "0 24px 70px rgba(0, 0, 0, 0.38)"
  },
  appShell: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    background: "#0f172a",
    color: "#f8fafc"
  },
  sidebar: {
    borderRight: "1px solid #334155",
    background: "#111827",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "24px"
  },
  workspace: {
    padding: "28px",
    display: "flex",
    flexDirection: "column",
    gap: "20px"
  },
  workspaceHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    alignItems: "flex-start"
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px"
  },
  badge: {
    display: "inline-block",
    margin: "0 0 12px",
    padding: "6px 12px",
    borderRadius: "999px",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "13px"
  },
  title: {
    margin: "0 0 12px",
    fontSize: "38px",
    lineHeight: 1.1
  },
  sidebarTitle: {
    margin: 0,
    fontSize: "30px"
  },
  workspaceTitle: {
    margin: 0,
    fontSize: "32px"
  },
  description: {
    margin: "0 0 26px",
    color: "#cbd5e1",
    lineHeight: 1.6
  },
  userText: {
    color: "#cbd5e1",
    margin: "8px 0 0"
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  },
  createForm: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    color: "#e2e8f0",
    fontWeight: 600
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #475569",
    borderRadius: "12px",
    padding: "12px 14px",
    background: "#020617",
    color: "#f8fafc",
    outline: "none",
    fontSize: "15px"
  },
  primaryButton: {
    border: 0,
    borderRadius: "12px",
    padding: "12px 16px",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer"
  },
  aiButton: {
    border: 0,
    borderRadius: "12px",
    padding: "12px 16px",
    background: "#7c3aed",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer"
  },
  secondaryButton: {
    border: "1px solid #475569",
    borderRadius: "12px",
    padding: "12px 16px",
    background: "transparent",
    color: "#f8fafc",
    fontWeight: 700,
    cursor: "pointer",
    marginTop: "auto"
  },
  linkButton: {
    border: 0,
    background: "transparent",
    color: "#93c5fd",
    cursor: "pointer",
    marginTop: "18px",
    padding: 0,
    fontWeight: 700
  },
  status: {
    color: "#cbd5e1",
    margin: "0",
    maxWidth: "640px"
  },
  documentList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    overflowY: "auto"
  },
  documentItem: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "8px",
    border: "1px solid #334155",
    borderRadius: "14px",
    background: "#020617",
    padding: "10px"
  },
  documentItemActive: {
    borderColor: "#60a5fa"
  },
  documentButton: {
    border: 0,
    background: "transparent",
    color: "#f8fafc",
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: "5px"
  },
  deleteButton: {
    border: "1px solid #7f1d1d",
    borderRadius: "10px",
    background: "#450a0a",
    color: "#fecaca",
    cursor: "pointer",
    padding: "8px 10px"
  },
  emptyText: {
    color: "#94a3b8",
    lineHeight: 1.5
  },
  editorPreview: {
    flex: 1,
    border: "1px solid #334155",
    borderRadius: "22px",
    background: "#020617",
    overflow: "hidden",
    minHeight: "620px"
  },
  editorTopBar: {
    height: "44px",
    borderBottom: "1px solid #334155",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "0 16px",
    background: "#111827"
  },
  dot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    background: "#64748b"
  },
  fileName: {
    marginLeft: "12px",
    color: "#cbd5e1",
    fontSize: "14px"
  },
  revisionText: {
    marginLeft: "auto",
    color: "#94a3b8",
    fontSize: "13px"
  },
  connectionPill: {
    border: "1px solid #334155",
    borderRadius: "999px",
    padding: "8px 12px",
    color: "#cbd5e1",
    background: "#020617",
    fontSize: "13px"
  },
  presencePanel: {
    borderTop: "1px solid #334155",
    padding: "14px 18px",
    color: "#cbd5e1",
    background: "#111827"
  },
  placeholder: {
    minHeight: "540px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#cbd5e1",
    textAlign: "center",
    padding: "24px"
  }
};

createRoot(document.getElementById("root")).render(<App />);