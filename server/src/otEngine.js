function isValidOperation(operation) {
  if (!operation || typeof operation !== "object") {
    return false;
  }

  if (operation.type === "insert") {
    return (
      Number.isInteger(operation.position) &&
      operation.position >= 0 &&
      typeof operation.text === "string"
    );
  }

  if (operation.type === "delete") {
    return (
      Number.isInteger(operation.position) &&
      operation.position >= 0 &&
      Number.isInteger(operation.length) &&
      operation.length > 0
    );
  }

  return false;
}

function applyOperation(content, operation) {
  if (!isValidOperation(operation)) {
    throw new Error("Invalid operation format");
  }

  if (operation.position > content.length) {
    throw new Error("Operation position is outside document content");
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

  throw new Error(`Unsupported operation type: ${operation.type}`);
}

function transformInsertAgainstInsert(incoming, existing) {
  const transformed = { ...incoming };

  if (existing.position < incoming.position) {
    transformed.position += existing.text.length;
  }

  if (existing.position === incoming.position) {
    transformed.position += existing.text.length;
  }

  return transformed;
}

function transformInsertAgainstDelete(incoming, existing) {
  const transformed = { ...incoming };

  if (existing.position < incoming.position) {
    const deletedBeforeIncoming = Math.min(
      existing.length,
      incoming.position - existing.position
    );

    transformed.position -= deletedBeforeIncoming;
  }

  return transformed;
}

function transformDeleteAgainstInsert(incoming, existing) {
  const transformed = { ...incoming };

  if (existing.position <= incoming.position) {
    transformed.position += existing.text.length;
  }

  return transformed;
}

function transformDeleteAgainstDelete(incoming, existing) {
  const transformed = { ...incoming };

  const existingEnd = existing.position + existing.length;
  const incomingEnd = incoming.position + incoming.length;

  if (existingEnd <= incoming.position) {
    transformed.position -= existing.length;
    return transformed;
  }

  if (existing.position >= incomingEnd) {
    return transformed;
  }

  const overlapStart = Math.max(existing.position, incoming.position);
  const overlapEnd = Math.min(existingEnd, incomingEnd);
  const overlapLength = Math.max(0, overlapEnd - overlapStart);

  transformed.length = Math.max(0, incoming.length - overlapLength);

  if (existing.position < incoming.position) {
    transformed.position = existing.position;
  }

  return transformed;
}

function transformOperation(incomingOperation, existingOperation) {
  if (!isValidOperation(incomingOperation)) {
    throw new Error("Invalid incoming operation");
  }

  if (!isValidOperation(existingOperation)) {
    throw new Error("Invalid existing operation");
  }

  if (incomingOperation.type === "insert" && existingOperation.type === "insert") {
    return transformInsertAgainstInsert(incomingOperation, existingOperation);
  }

  if (incomingOperation.type === "insert" && existingOperation.type === "delete") {
    return transformInsertAgainstDelete(incomingOperation, existingOperation);
  }

  if (incomingOperation.type === "delete" && existingOperation.type === "insert") {
    return transformDeleteAgainstInsert(incomingOperation, existingOperation);
  }

  if (incomingOperation.type === "delete" && existingOperation.type === "delete") {
    return transformDeleteAgainstDelete(incomingOperation, existingOperation);
  }

  return incomingOperation;
}

function transformAgainstHistory(incomingOperation, history) {
  let transformedOperation = { ...incomingOperation };

  for (const operationRecord of history) {
    transformedOperation = transformOperation(
      transformedOperation,
      operationRecord.operation
    );
  }

  return transformedOperation;
}

module.exports = {
  isValidOperation,
  applyOperation,
  transformOperation,
  transformAgainstHistory
};