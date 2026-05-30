/**
 * Shared server types for incremental TypeScript migration.
 * JavaScript modules may adopt these gradually via JSDoc `@typedef` imports.
 */
import type { JwtPayload } from "jsonwebtoken";

/** JWT payload attached to `req.user` after `requireAuth`. */
export interface AuthenticatedUser extends JwtPayload {
  userId: string;
  email: string;
}

export type DocumentAccessRole = "owner" | "collaborator";

export type PermissionLevel = "read" | "write";

/** Client → server WebSocket message discriminant. */
export type ClientWebSocketMessageType =
  | "JOIN_DOCUMENT"
  | "OPERATION"
  | "CURSOR";

/** Server → client WebSocket message discriminant. */
export type ServerWebSocketMessageType =
  | "CONNECTED"
  | "DOCUMENT_JOINED"
  | "OPERATION_ACK"
  | "REMOTE_OPERATION"
  | "CURSOR_ACK"
  | "CURSOR_UPDATE"
  | "USER_JOINED"
  | "USER_LEFT"
  | "ERROR";

export type WebSocketMessageType =
  | ClientWebSocketMessageType
  | ServerWebSocketMessageType;

export type CollaborationOperationType = "insert" | "delete";

export interface InsertOperation {
  type: "insert";
  position: number;
  text: string;
}

export interface DeleteOperation {
  type: "delete";
  position: number;
  length: number;
}

export type CollaborationOperation = InsertOperation | DeleteOperation;

export interface CursorPayload {
  position: number;
  selectionStart: number | null;
  selectionEnd: number | null;
}

export interface PresenceEntry {
  userId: string;
  email: string;
  position?: number;
  selectionStart?: number | null;
  selectionEnd?: number | null;
}

export interface JoinDocumentMessage {
  type: "JOIN_DOCUMENT";
  documentId: string;
  token: string;
}

export interface OperationMessage {
  type: "OPERATION";
  revision: number;
  operation: CollaborationOperation;
}

export interface CursorMessage {
  type: "CURSOR";
  cursor: CursorPayload;
}

export type ClientWebSocketMessage =
  | JoinDocumentMessage
  | OperationMessage
  | CursorMessage;

export interface DocumentJoinedMessage {
  type: "DOCUMENT_JOINED";
  document: Record<string, unknown>;
  revision: number;
  presence: PresenceEntry[];
  access_role: DocumentAccessRole;
  permission_level: PermissionLevel;
  can_write: boolean;
}

export interface OperationAckMessage {
  type: "OPERATION_ACK";
  revision: number;
  operation: CollaborationOperation;
  document: Record<string, unknown>;
  snapshot_created?: boolean;
}

export interface RemoteOperationMessage {
  type: "REMOTE_OPERATION";
  revision: number;
  operation: CollaborationOperation;
}

export interface CursorUpdateMessage {
  type: "CURSOR_UPDATE";
  presence: PresenceEntry;
}

export interface CursorAckMessage {
  type: "CURSOR_ACK";
  presence: PresenceEntry[];
}

export interface ErrorMessage {
  type: "ERROR";
  error: string;
}

export interface ConnectedMessage {
  type: "CONNECTED";
}

export interface UserJoinedMessage {
  type: "USER_JOINED";
  presence: PresenceEntry;
}

export interface UserLeftMessage {
  type: "USER_LEFT";
  user: Pick<AuthenticatedUser, "userId" | "email">;
}

export type ServerWebSocketMessage =
  | ConnectedMessage
  | DocumentJoinedMessage
  | OperationAckMessage
  | RemoteOperationMessage
  | CursorUpdateMessage
  | CursorAckMessage
  | ErrorMessage
  | UserJoinedMessage
  | UserLeftMessage;

export type WebSocketMessage = ClientWebSocketMessage | ServerWebSocketMessage;
