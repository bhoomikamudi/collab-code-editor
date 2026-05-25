import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import "./index.css";
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

function getWebSocketUrl() {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  if (import.meta.env.DEV) {
    return "ws://localhost:5000";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

const WS_URL = getWebSocketUrl();

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
      <main className="flex min-h-screen items-center justify-center bg-slate-900 p-6 font-sans text-slate-50">
        <section className="w-full max-w-md rounded-3xl border border-slate-700 bg-gray-900 p-9 shadow-panel">
          <p className="mb-3 inline-block rounded-full bg-blue-600 px-3 py-1.5 text-sm font-bold text-white">
            Project A
          </p>
          <h1 className="mb-3 text-4xl font-bold leading-tight">
            Collab Code Editor
          </h1>
          <p className="mb-6 leading-relaxed text-slate-300">
            Sign in to manage collaborative coding documents with real-time sync
            and AI assistance.
          </p>

          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2 font-semibold text-slate-200">
              Email
              <input
                className="input-field"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label className="flex flex-col gap-2 font-semibold text-slate-200">
              Password
              <input
                className="input-field"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 8 characters"
              />
            </label>

            <button className="btn-primary" disabled={isLoading}>
              {isLoading
                ? "Please wait..."
                : authMode === "login"
                  ? "Login"
                  : "Create Account"}
            </button>
          </form>

          <button
            className="mt-4 border-0 bg-transparent p-0 font-bold text-blue-300 transition hover:text-blue-200"
            onClick={() =>
              setAuthMode(authMode === "login" ? "register" : "login")
            }
          >
            {authMode === "login"
              ? "Need an account? Register"
              : "Already have an account? Login"}
          </button>

          {status && <p className="mt-4 text-slate-300">{status}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen grid-cols-[340px_1fr] bg-slate-900 font-sans text-slate-50">
      <aside className="flex flex-col gap-6 border-r border-slate-700 bg-gray-900 p-6">
        <div>
          <p className="mb-3 inline-block rounded-full bg-blue-600 px-3 py-1.5 text-sm font-bold text-white">
            Project A
          </p>
          <h1 className="text-3xl font-bold">Documents</h1>
          <p className="mt-2 text-slate-300">{user.email}</p>
        </div>

        <form onSubmit={handleCreateDocument} className="flex flex-col gap-3">
          <input
            className="input-field"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="New document title"
          />
          <button className="btn-primary" disabled={isLoading}>
            Create Document
          </button>
        </form>

        <div className="flex flex-col gap-3 overflow-y-auto">
          {documents.length === 0 ? (
            <p className="mt-2 leading-normal text-slate-400">
              No documents yet. Create one above.
            </p>
          ) : (
            documents.map((document) => (
              <div
                key={document.id}
                className={`grid grid-cols-[1fr_auto] gap-2 rounded-2xl border bg-slate-950 p-2.5 ${
                  selectedDocument?.id === document.id
                    ? "border-blue-400"
                    : "border-slate-700"
                }`}
              >
                <button
                  className="flex cursor-pointer flex-col gap-1 border-0 bg-transparent text-left text-slate-50"
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
                  <span className="text-sm text-slate-400">
                    {new Date(document.updated_at).toLocaleString()}
                  </span>
                </button>

                <button
                  className="cursor-pointer rounded-lg border border-red-900 bg-red-950 px-2.5 py-2 text-red-200 transition hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => handleDeleteDocument(document.id)}
                  disabled={isLoading}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>

        <button className="btn-secondary mt-auto" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <section className="flex flex-col gap-5 p-7">
        <header className="flex items-start justify-between gap-5">
          <div>
            <p className="mb-3 inline-block rounded-full bg-blue-600 px-3 py-1.5 text-sm font-bold text-white">
              Editor
            </p>
            <h2 className="text-3xl font-bold">
              {selectedDocument ? selectedDocument.title : "Select a document"}
            </h2>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <span
              className={`rounded-full border px-3 py-2 text-sm ${
                connectionStatus === "Connected"
                  ? "border-emerald-700 bg-emerald-950 text-emerald-200"
                  : connectionStatus === "Connecting..."
                    ? "border-amber-700 bg-amber-950 text-amber-200"
                    : "border-slate-700 bg-slate-950 text-slate-300"
              }`}
            >
              {connectionStatus}
            </span>
            <button
              className="btn-secondary-sm"
              onClick={handleIndexCurrentDocument}
              disabled={!selectedDocument || isLoading}
            >
              Index for RAG
            </button>
            <button
              className="btn-secondary-sm"
              onClick={() => loadHistory()}
              disabled={!selectedDocument || isLoading}
            >
              Load History
            </button>
            <button
              className="btn-ai"
              onClick={handleAiComplete}
              disabled={!selectedDocument || isLoading}
            >
              AI Complete
            </button>
            <button
              className="btn-ai"
              onClick={handleExplainSelection}
              disabled={!selectedDocument || isLoading}
            >
              Explain Selection
            </button>
          </div>
        </header>

        <div className="grid grid-cols-[1fr_380px] items-stretch gap-[18px]">
          <div className="min-h-[660px] flex-1 overflow-hidden rounded-3xl border border-slate-700 bg-slate-950">
            {selectedDocument ? (
              <>
                <div className="flex h-11 items-center gap-2 border-b border-slate-700 bg-gray-900 px-4">
                  <span className="h-3 w-3 rounded-full bg-slate-500" />
                  <span className="h-3 w-3 rounded-full bg-slate-500" />
                  <span className="h-3 w-3 rounded-full bg-slate-500" />
                  <span className="ml-3 text-sm text-slate-300">
                    {selectedDocument.title}
                  </span>
                  <span className="ml-auto text-sm text-slate-400">
                    Revision {revision}
                  </span>
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

                <div className="border-t border-slate-700 bg-gray-900 px-4 py-3.5 text-slate-300">
                  <strong>Presence:</strong>{" "}
                  {presence.length === 0
                    ? "No active users"
                    : presence.map((item) => item.email).join(", ")}
                </div>
              </>
            ) : (
              <div className="flex min-h-[540px] flex-col items-center justify-center p-6 text-center text-slate-300">
                <h3 className="text-xl font-semibold">
                  Select a document to start editing.
                </h3>
                <p className="mt-2 max-w-md leading-relaxed">
                  The editor will connect to WebSocket sync after a document is
                  selected.
                </p>
              </div>
            )}
          </div>

          <aside className="flex max-h-[760px] min-h-[660px] flex-col gap-4 overflow-y-auto rounded-3xl border border-slate-700 bg-gray-900 p-4">
            <p className="inline-block rounded-full bg-blue-600 px-3 py-1.5 text-sm font-bold text-white">
              AI Assistant
            </p>

            <div className="flex flex-wrap gap-2">
              {["completion", "explain", "chat"].map((mode) => (
                <button
                  key={mode}
                  className={
                    aiPanelMode === mode
                      ? "rounded-full border border-blue-300 bg-blue-700 px-2.5 py-2 font-bold capitalize text-white"
                      : "rounded-full border border-slate-700 bg-slate-950 px-2.5 py-2 font-bold capitalize text-slate-300 transition hover:border-slate-500"
                  }
                  onClick={() => setAiPanelMode(mode)}
                >
                  {mode === "completion" ? "Completion" : mode}
                </button>
              ))}
            </div>

            <form onSubmit={handleChatSubmit} className="flex flex-col gap-2.5">
              <textarea
                className="input-field min-h-[90px] resize-y text-sm leading-normal"
                value={chatQuestion}
                onChange={(event) => setChatQuestion(event.target.value)}
                placeholder="Ask about this codebase..."
              />
              <button
                className="btn-primary"
                disabled={!selectedDocument || isLoading}
              >
                Ask Codebase
              </button>
            </form>

            <div className="panel-card min-h-[150px]">
              <h3 className="mb-2.5 text-lg font-semibold text-slate-50">
                {aiPanelMode === "completion"
                  ? "Inline Completion"
                  : aiPanelMode === "explain"
                    ? "Selection Explanation"
                    : "Codebase Chat"}
              </h3>
              <p className="m-0 whitespace-pre-wrap leading-relaxed">
                {aiOutput || "AI responses will appear here."}
              </p>
            </div>

            <div className="panel-card">
              <strong className="text-slate-50">RAG References</strong>
              <p className="mt-2">{formatRagReferences(ragReferences)}</p>
            </div>

            <div className="panel-card">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-slate-50">Version History</strong>
                <button
                  className="rounded-lg border border-slate-600 bg-gray-900 px-2.5 py-1.5 text-sm font-bold text-slate-50 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => loadHistory()}
                  disabled={!selectedDocument || isLoading}
                >
                  Refresh
                </button>
              </div>

              <p className="my-2 text-slate-400">{historyStatus}</p>

              {snapshots.length === 0 ? (
                <p className="mt-2 leading-normal text-slate-400">
                  No snapshots loaded. Snapshots are created every 50 operations.
                </p>
              ) : (
                snapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="mt-2.5 flex flex-col gap-1.5 rounded-xl border border-slate-700 bg-gray-900 p-2.5"
                  >
                    <strong>Revision {snapshot.revision}</strong>
                    <span className="text-sm text-slate-400">
                      {new Date(snapshot.created_at).toLocaleString()}
                    </span>
                    <p>{snapshot.preview || "No preview available."}</p>
                    <button
                      className="w-fit rounded-lg border-0 bg-emerald-600 px-2.5 py-2 font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => handleRestoreSnapshot(snapshot.id)}
                      disabled={isLoading}
                    >
                      Restore
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="panel-card mt-auto border-slate-600 bg-slate-900">
              <strong className="text-slate-50">How to test history:</strong>
              <p className="mt-2">
                Snapshots are saved every 50 WebSocket operations. Use AI
                Complete or typing to increase revisions, then click Load
                History.
              </p>
            </div>
          </aside>
        </div>

        {status && <p className="max-w-[920px] text-slate-300">{status}</p>}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
