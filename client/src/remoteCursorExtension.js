import { WidgetType } from "@codemirror/view";
import { Decoration, ViewPlugin } from "@codemirror/view";

const PRESENCE_COLORS = [
  "#f87171",
  "#fb923c",
  "#facc15",
  "#4ade80",
  "#38bdf8",
  "#a78bfa",
  "#f472b6"
];

/** Stable accent color per collaborator (userId preferred, email fallback). */
export function getPresenceColor(userKey) {
  const key = String(userKey ?? "");
  let hash = 0;

  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) | 0;
  }

  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

function clampPosition(position, docLength) {
  if (!Number.isInteger(position) || position < 0) {
    return 0;
  }

  return Math.min(position, docLength);
}

export function getRemotePeers(presence, localUserId) {
  const localKey = localUserId == null ? null : String(localUserId);

  return (presence || []).filter((peer) => {
    if (!peer?.userId) {
      return false;
    }

    if (localKey == null) {
      return true;
    }

    return String(peer.userId) !== localKey;
  });
}

class RemoteCursorWidget extends WidgetType {
  constructor(label, color) {
    super();
    this.label = label;
    this.color = color;
  }

  eq(other) {
    return other.label === this.label && other.color === this.color;
  }

  toDOM() {
    const caret = document.createElement("span");
    caret.className = "cm-remote-cursor";
    caret.style.borderLeftColor = this.color;

    const label = document.createElement("span");
    label.className = "cm-remote-cursor-label";
    label.textContent = this.label;
    label.style.backgroundColor = this.color;
    caret.appendChild(label);

    return caret;
  }

  ignoreEvent() {
    return true;
  }
}

function buildRemoteDecorations(presence, localUserId, docLength) {
  const decorations = [];

  for (const peer of getRemotePeers(presence, localUserId)) {
    const cursor = peer.cursor || {};
    const color = getPresenceColor(peer.userId || peer.email);
    const label = peer.email || "User";
    const head = clampPosition(cursor.position, docLength);

    const rawStart = Number.isInteger(cursor.selectionStart)
      ? cursor.selectionStart
      : head;
    const rawEnd = Number.isInteger(cursor.selectionEnd)
      ? cursor.selectionEnd
      : head;
    const selectionFrom = clampPosition(Math.min(rawStart, rawEnd), docLength);
    const selectionTo = clampPosition(Math.max(rawStart, rawEnd), docLength);

    if (selectionFrom !== selectionTo) {
      decorations.push(
        Decoration.mark({
          class: "cm-remote-selection",
          attributes: {
            style: `background-color: ${color}33; outline: 1px solid ${color}55`
          }
        }).range(selectionFrom, selectionTo)
      );
    }

    decorations.push(
      Decoration.widget({
        widget: new RemoteCursorWidget(label, color),
        side: 1
      }).range(head)
    );
  }

  return Decoration.set(decorations, true);
}

/**
 * CodeMirror ViewPlugin that paints remote carets/selections from WebSocket
 * presence. Decorations are read-only (pointer-events: none) and map through
 * local document edits via ChangeSet mapping — they never alter buffer content
 * or OT revisions.
 */
export function remoteCursorExtension(presence, localUserId) {
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = buildRemoteDecorations(
          presence,
          localUserId,
          view.state.doc.length
        );
      }

      update(update) {
        if (update.docChanged) {
          this.decorations = this.decorations.map(update.changes);
        }
      }

      destroy() {}
    },
    {
      decorations: (plugin) => plugin.decorations
    }
  );
}
