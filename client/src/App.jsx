import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import {
  chatWithCodebase,
  clearAuthToken,
  completeCode,
  createDocument,
  deleteDocument,
  explainCode,
  getAuthToken,
  getCurrentUser,
  indexCodebase,
  listDocumentHistory,
  listDocuments,
  login,
  register,
  restoreDocumentSnapshot
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

function getSimpleOperation(previousValue, nextValue) {
  if (previousValue === nextValue) {
    return null;
  }

  let start = 0;

  while (
    start < previousValue.length &&
    start < nextValue.length &&
    previousValue[start] === nextValue[start]
  ) {
    start += 1;
  }

  let previousEnd = previousValue.length - 1;
  let nextEnd = nextValue.length - 1;

  while (
    previousEnd >= start &&
    nextEnd >= start &&
    previousValue[previousEnd] === nextValue[nextEnd]
  ) {
    previousEnd -= 1;
    nextEnd -= 1;
  }

  const removedText = previousValue.slice(start, previousEnd + 1);
  const insertedText = nextValue.slice(start, nextEnd + 1);

  if (removedText.length > 0 && insertedText.length === 0) {
    return {
      type: "delete",
      position: start,
      length: removedText.length
    };
  }

  if (removedText.length === 0 && insertedText.length > 0) {
    return {
      type: "insert",
      position: start,
      text: insertedText
    };
  }

  if (removedText.length > 0 && insertedText.length > 0) {
    return {
      type: "replace",
      position: start,
      length: removedText.length,
      text: insertedText
    };
  }

  return null;
}

function getCodebaseId(user, document) {
  if (!user || !document) {
    return null;
  }

  return `user-${user.id}-document-${document.id}`;
}

function formatRagReferences(chunks) {
  if (!chunks || chunks.length === 0) {
    return "No RAG references returned.";
  }

  return chunks
    .slice(0, 5)
    .map((chunk) => {
      return `${chunk.filename || "unknown"}:${chunk.start_line || "?"}-${
        chunk.end_line || "?"
      }`;
    })
    .join(", ");
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

  const [selectionRange, setSelectionRange] = useState({ from: 0, to: 0 });
  const [aiPanelMode, setAiPanelMode] = useState("explain");
  const [aiOutput, setAiOutput] = useState("");
  const [ragReferences, setRagReferences] = useState([]);
  const [chatQuestion, setChatQuestion] = useState(
    "Where is the main logic in this file?"
  );
  const [lastIndexedCodebaseId, setLastIndexedCodebaseId] = useState(null);

  const [snapshots, setSnapshots] = useState([]);
  const [historyStatus, setHistoryStatus] = useState("No history loaded yet.");

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

        if (message.snapshot_created) {
          setStatus(`Saved at revision ${message.revision}. Snapshot created.`);
          loadHistory(selectedDocument.id);
        } else {
          setStatus(`Saved at revision ${message.revision}.`);
        }
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

  async function loadHistory(documentId = selectedDocument?.id) {
    if (!documentId) {
      setHistoryStatus("Select a document before loading history.");
      return;
    }

    try {
      const data = await listDocumentHistory(documentId);
      setSnapshots(data.snapshots || []);
      setHistoryStatus(
        data.snapshots?.length
          ? `Loaded ${data.snapshots.length} snapshot(s).`
          : "No snapshots yet. Snapshots are created every 50 operations."
      );
    } catch (error) {
      setHistoryStatus(error.message);
    }
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
      setSnapshots([]);
      setHistoryStatus("No history loaded yet.");
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
        setAiOutput("");
        setRagReferences([]);
        setSnapshots([]);
        setHistoryStatus("No history loaded yet.");
      }

      setStatus("Document deleted successfully.");
      await loadDocuments();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRestoreSnapshot(snapshotId) {
    if (!selectedDocument) {
      setStatus("Select a document before restoring history.");
      return;
    }

    setIsLoading(true);
    setHistoryStatus("Restoring snapshot...");

    try {
      const data = await restoreDocumentSnapshot(selectedDocument.id, snapshotId);

      suppressChangeRef.current = true;
      setSelectedDocument(data.document);
      setEditorValue(data.document.content || "");
      editorValueRef.current = data.document.content || "";
      setStatus(`Restored from snapshot revision ${data.restored_from.revision}.`);
      setHistoryStatus("Snapshot restored successfully.");

      setTimeout(() => {
        suppressChangeRef.current = false;
      }, 0);

      await loadDocuments();
      await loadHistory(selectedDocument.id);
    } catch (error) {
      setHistoryStatus(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function sendOperationToServer(operation) {
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

  function handleEditorChange(nextValue) {
    if (suppressChangeRef.current) {
      return;
    }

    const previousValue = editorValueRef.current;
    const operation = getSimpleOperation(previousValue, nextValue);

    setEditorValue(nextValue);
    editorValueRef.current = nextValue;

    if (!operation) {
      setStatus("No syncable editor operation detected.");
      return;
    }

    if (operation.type === "replace") {
      setStatus("Replace operations are not synced yet. Use insert/delete edits.");
      return;
    }

    sendOperationToServer(operation);
  }

  function handleEditorUpdate(viewUpdate) {
    const selection = viewUpdate.state.selection.main;

    setSelectionRange({
      from: selection.from,
      to: selection.to
    });

    if (!viewUpdate.selectionSet || !wsRef.current) {
      return;
    }

    if (wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "CURSOR",
          cursor: {
            position: selection.head,
            selectionStart: selection.from,
            selectionEnd: selection.to
          }
        })
      );
    }
  }

  async function handleIndexCurrentDocument() {
    if (!selectedDocument || !user) {
      setStatus("Select a document before indexing.");
      return;
    }

    setIsLoading(true);
    setStatus("Indexing current document into ChromaDB...");

    try {
      const codebaseId = getCodebaseId(user, selectedDocument);

      const result = await indexCodebase(codebaseId, [
        {
          filename: selectedDocument.title.endsWith(".js")
            ? selectedDocument.title
            : `${selectedDocument.title}.js`,
          language: "javascript",
          content: editorValue
        }
      ]);

      setLastIndexedCodebaseId(codebaseId);
      setStatus(
        `Indexed ${result.files_indexed} file(s), ${result.chunks_indexed} chunk(s).`
      );
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAiComplete() {
    if (!selectedDocument) {
      setStatus("Select a document before using AI completion.");
      return;
    }

    setIsLoading(true);
    setStatus("Generating inline AI completion...");

    try {
      const cursorPosition =
        selectionRange.from === selectionRange.to
          ? selectionRange.to
          : editorValue.length;

      const codebaseId =
        lastIndexedCodebaseId || getCodebaseId(user, selectedDocument);

      const data = await completeCode(
        editorValue,
        cursorPosition,
        "javascript",
        codebaseId
      );

      const nextValue =
        editorValue.slice(0, cursorPosition) +
        data.completion +
        editorValue.slice(cursorPosition);

      handleEditorChange(nextValue);
      setAiPanelMode("completion");
      setAiOutput(data.completion);
      setRagReferences(data.rag_chunks || []);
      setStatus(`Inline AI completion inserted using ${data.model}.`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExplainSelection() {
    if (!selectedDocument) {
      setStatus("Select a document before using explain.");
      return;
    }

    const selectedCode = editorValue.slice(selectionRange.from, selectionRange.to);

    if (!selectedCode.trim()) {
      setStatus("Select code in the editor first, then click Explain Selection.");
      return;
    }

    setIsLoading(true);
    setStatus("Explaining selected code...");

    try {
      const codebaseId =
        lastIndexedCodebaseId || getCodebaseId(user, selectedDocument);

      const data = await explainCode(selectedCode, "javascript", codebaseId);

      setAiPanelMode("explain");
      setAiOutput(data.explanation);
      setRagReferences(data.rag_chunks || []);
      setStatus(`Explanation generated using ${data.model}.`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleChatSubmit(event) {
    event.preventDefault();

    if (!selectedDocument) {
      setStatus("Select a document before chatting with the codebase.");
      return;
    }

    if (!chatQuestion.trim()) {
      setStatus("Enter a codebase question first.");
      return;
    }

    setIsLoading(true);
    setStatus("Asking codebase chat...");

    try {
      const codebaseId =
        lastIndexedCodebaseId || getCodebaseId(user, selectedDocument);

      const data = await chatWithCodebase(
        chatQuestion,
        editorValue,
        "javascript",
        codebaseId
      );

      setAiPanelMode("chat");
      setAiOutput(data.answer);
      setRagReferences(data.rag_chunks || []);
      setStatus(`Codebase chat answered using ${data.model}.`);
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
    setAiOutput("");
    setRagReferences([]);
    setLastIndexedCodebaseId(null);
    setSnapshots([]);
    setHistoryStatus("No history loaded yet.");
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
                  onClick={() => {
                    setSelectedDocument(document);
                    setAiOutput("");
                    setRagReferences([]);
                    setLastIndexedCodebaseId(null);
                    setSnapshots([]);
                    setHistoryStatus("No history loaded yet.");
                  }}
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
              style={styles.secondarySmallButton}
              onClick={handleIndexCurrentDocument}
              disabled={!selectedDocument || isLoading}
            >
              Index for RAG
            </button>
            <button
              style={styles.secondarySmallButton}
              onClick={() => loadHistory()}
              disabled={!selectedDocument || isLoading}
            >
              Load History
            </button>
            <button
              style={styles.aiButton}
              onClick={handleAiComplete}
              disabled={!selectedDocument || isLoading}
            >
              AI Complete
            </button>
            <button
              style={styles.aiButton}
              onClick={handleExplainSelection}
              disabled={!selectedDocument || isLoading}
            >
              Explain Selection
            </button>
          </div>
        </header>

        <div style={styles.mainGrid}>
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
                  height="560px"
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

          <aside style={styles.aiPanel}>
            <p style={styles.badge}>AI Assistant</p>

            <div style={styles.aiTabs}>
              <button
                style={{
                  ...styles.tabButton,
                  ...(aiPanelMode === "completion" ? styles.tabButtonActive : {})
                }}
                onClick={() => setAiPanelMode("completion")}
              >
                Completion
              </button>
              <button
                style={{
                  ...styles.tabButton,
                  ...(aiPanelMode === "explain" ? styles.tabButtonActive : {})
                }}
                onClick={() => setAiPanelMode("explain")}
              >
                Explain
              </button>
              <button
                style={{
                  ...styles.tabButton,
                  ...(aiPanelMode === "chat" ? styles.tabButtonActive : {})
                }}
                onClick={() => setAiPanelMode("chat")}
              >
                Chat
              </button>
            </div>

            <form onSubmit={handleChatSubmit} style={styles.chatForm}>
              <textarea
                style={styles.chatInput}
                value={chatQuestion}
                onChange={(event) => setChatQuestion(event.target.value)}
                placeholder="Ask about this codebase..."
              />
              <button
                style={styles.primaryButton}
                disabled={!selectedDocument || isLoading}
              >
                Ask Codebase
              </button>
            </form>

            <div style={styles.aiOutputBox}>
              <h3 style={styles.aiOutputTitle}>
                {aiPanelMode === "completion"
                  ? "Inline Completion"
                  : aiPanelMode === "explain"
                    ? "Selection Explanation"
                    : "Codebase Chat"}
              </h3>
              <p style={styles.aiOutputText}>
                {aiOutput || "AI responses will appear here."}
              </p>
            </div>

            <div style={styles.ragBox}>
              <strong>RAG References</strong>
              <p>{formatRagReferences(ragReferences)}</p>
            </div>

            <div style={styles.historyBox}>
              <div style={styles.historyHeader}>
                <strong>Version History</strong>
                <button
                  style={styles.historyRefreshButton}
                  onClick={() => loadHistory()}
                  disabled={!selectedDocument || isLoading}
                >
                  Refresh
                </button>
              </div>

              <p style={styles.historyStatus}>{historyStatus}</p>

              {snapshots.length === 0 ? (
                <p style={styles.emptyText}>
                  No snapshots loaded. Snapshots are created every 50 operations.
                </p>
              ) : (
                snapshots.map((snapshot) => (
                  <div key={snapshot.id} style={styles.snapshotItem}>
                    <strong>Revision {snapshot.revision}</strong>
                    <span>{new Date(snapshot.created_at).toLocaleString()}</span>
                    <p>{snapshot.preview || "No preview available."}</p>
                    <button
                      style={styles.restoreButton}
                      onClick={() => handleRestoreSnapshot(snapshot.id)}
                      disabled={isLoading}
                    >
                      Restore
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={styles.tipBox}>
              <strong>How to test history:</strong>
              <p>
                Snapshots are saved every 50 WebSocket operations. Use AI
                Complete or typing to increase revisions, then click Load
                History.
              </p>
            </div>
          </aside>
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
    gridTemplateColumns: "340px 1fr",
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
    gap: "10px",
    flexWrap: "wrap",
    justifyContent: "flex-end"
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 380px",
    gap: "18px",
    alignItems: "stretch"
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
  secondarySmallButton: {
    border: "1px solid #475569",
    borderRadius: "12px",
    padding: "11px 14px",
    background: "#020617",
    color: "#f8fafc",
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
    maxWidth: "920px"
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
    lineHeight: 1.5,
    margin: "8px 0 0"
  },
  editorPreview: {
    flex: 1,
    border: "1px solid #334155",
    borderRadius: "22px",
    background: "#020617",
    overflow: "hidden",
    minHeight: "660px"
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
  },
  aiPanel: {
    border: "1px solid #334155",
    borderRadius: "22px",
    background: "#111827",
    minHeight: "660px",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxHeight: "760px",
    overflowY: "auto"
  },
  aiTabs: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap"
  },
  tabButton: {
    border: "1px solid #334155",
    borderRadius: "999px",
    padding: "8px 10px",
    background: "#020617",
    color: "#cbd5e1",
    cursor: "pointer",
    fontWeight: 700
  },
  tabButtonActive: {
    borderColor: "#93c5fd",
    color: "#ffffff",
    background: "#1d4ed8"
  },
  chatForm: {
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },
  chatInput: {
    width: "100%",
    minHeight: "90px",
    resize: "vertical",
    boxSizing: "border-box",
    border: "1px solid #475569",
    borderRadius: "12px",
    padding: "12px 14px",
    background: "#020617",
    color: "#f8fafc",
    outline: "none",
    fontSize: "14px",
    lineHeight: 1.5
  },
  aiOutputBox: {
    border: "1px solid #334155",
    borderRadius: "16px",
    background: "#020617",
    padding: "14px",
    minHeight: "150px"
  },
  aiOutputTitle: {
    margin: "0 0 10px",
    fontSize: "17px"
  },
  aiOutputText: {
    margin: 0,
    color: "#cbd5e1",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap"
  },
  ragBox: {
    border: "1px solid #334155",
    borderRadius: "16px",
    background: "#020617",
    padding: "14px",
    color: "#cbd5e1",
    lineHeight: 1.5
  },
  historyBox: {
    border: "1px solid #334155",
    borderRadius: "16px",
    background: "#020617",
    padding: "14px",
    color: "#cbd5e1",
    lineHeight: 1.5
  },
  historyHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px"
  },
  historyRefreshButton: {
    border: "1px solid #475569",
    borderRadius: "10px",
    padding: "7px 10px",
    background: "#111827",
    color: "#f8fafc",
    cursor: "pointer",
    fontWeight: 700
  },
  historyStatus: {
    color: "#94a3b8",
    margin: "8px 0"
  },
  snapshotItem: {
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "10px",
    marginTop: "10px",
    background: "#111827",
    display: "flex",
    flexDirection: "column",
    gap: "6px"
  },
  restoreButton: {
    border: 0,
    borderRadius: "10px",
    padding: "8px 10px",
    background: "#059669",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
    width: "fit-content"
  },
  tipBox: {
    border: "1px solid #475569",
    borderRadius: "16px",
    background: "#0f172a",
    padding: "14px",
    color: "#cbd5e1",
    lineHeight: 1.5,
    marginTop: "auto"
  }
};

createRoot(document.getElementById("root")).render(<App />);