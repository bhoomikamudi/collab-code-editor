/**
 * Collaboration operation helpers for the WebSocket OT protocol.
 *
 * The backend (ot.js) accepts only { type: "insert" } and { type: "delete" }.
 * Replace-style edits (selection overwrite, paste over selection) are expanded
 * into delete-then-insert at the same position before sending.
 */

export function applySimpleOperation(content, operation) {
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

/**
 * Derive insert/delete/replace from a before/after string pair (fallback when
 * CodeMirror change details are unavailable, e.g. programmatic AI insertion).
 */
export function getSimpleOperation(previousValue, nextValue) {
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

/** Map replace ops to delete+insert; pass insert/delete through unchanged. */
export function expandOperationsForServer(operations) {
  const expanded = [];

  for (const operation of operations) {
    if (!operation) {
      continue;
    }

    if (operation.type === "insert" || operation.type === "delete") {
      expanded.push(operation);
      continue;
    }

    if (operation.type === "replace") {
      expanded.push({
        type: "delete",
        position: operation.position,
        length: operation.length
      });
      expanded.push({
        type: "insert",
        position: operation.position,
        text: operation.text
      });
    }
  }

  return expanded;
}

/**
 * Preferred path: read CodeMirror 6 ChangeSet regions in document order.
 * Each region becomes insert, delete, or delete+insert (replace).
 */
export function getOperationsFromCodeMirrorChanges(changes) {
  const operations = [];

  changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    const deletedLength = toA - fromA;
    const text = inserted.toString();

    if (deletedLength === 0 && text.length === 0) {
      return;
    }

    if (deletedLength === 0) {
      operations.push({
        type: "insert",
        position: fromA,
        text
      });
      return;
    }

    if (text.length === 0) {
      operations.push({
        type: "delete",
        position: fromA,
        length: deletedLength
      });
      return;
    }

    operations.push({
      type: "replace",
      position: fromA,
      length: deletedLength,
      text
    });
  });

  return expandOperationsForServer(operations);
}

export function getOperationsFromTextDiff(previousValue, nextValue) {
  const operation = getSimpleOperation(previousValue, nextValue);

  if (!operation) {
    return [];
  }

  return expandOperationsForServer([operation]);
}
