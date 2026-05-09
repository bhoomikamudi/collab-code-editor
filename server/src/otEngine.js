const ot = require("ot");

function isValidSimpleOperation(operation) {
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

function simpleToTextOperation(operation, baseContentLength) {
  if (!isValidSimpleOperation(operation)) {
    throw new Error("Invalid operation format");
  }

  if (!Number.isInteger(baseContentLength) || baseContentLength < 0) {
    throw new Error("Valid baseContentLength is required");
  }

  if (operation.position > baseContentLength) {
    throw new Error("Operation position is outside document content");
  }

  const textOperation = new ot.TextOperation();

  if (operation.type === "insert") {
    textOperation
      .retain(operation.position)
      .insert(operation.text)
      .retain(baseContentLength - operation.position);

    return textOperation;
  }

  if (operation.type === "delete") {
    if (operation.position + operation.length > baseContentLength) {
      throw new Error("Delete operation exceeds document content length");
    }

    textOperation
      .retain(operation.position)
      .delete(operation.length)
      .retain(baseContentLength - operation.position - operation.length);

    return textOperation;
  }

  throw new Error(`Unsupported operation type: ${operation.type}`);
}

function manuallyApplyTextOperation(content, textOperation) {
  let cursor = 0;
  let result = "";

  for (const component of textOperation.ops) {
    if (typeof component === "number") {
      if (component > 0) {
        result += content.slice(cursor, cursor + component);
        cursor += component;
      }

      if (component < 0) {
        cursor += Math.abs(component);
      }
    }

    if (typeof component === "string") {
      result += component;
    }
  }

  result += content.slice(cursor);

  return result;
}

function applyTextOperation(content, textOperation) {
  const safeContent = content || "";

  try {
    const applied = textOperation.apply(safeContent);

    if (typeof applied === "string") {
      return applied;
    }

    if (Array.isArray(applied) && typeof applied[0] === "string") {
      return applied[0];
    }
  } catch (error) {
    return manuallyApplyTextOperation(safeContent, textOperation);
  }

  return manuallyApplyTextOperation(safeContent, textOperation);
}

function textOperationToSimple(beforeContent, afterContent) {
  const safeBefore = beforeContent || "";
  const safeAfter = afterContent || "";

  if (safeAfter.length > safeBefore.length) {
    let index = 0;

    while (
      index < safeBefore.length &&
      safeBefore[index] === safeAfter[index]
    ) {
      index += 1;
    }

    const insertedLength = safeAfter.length - safeBefore.length;

    return {
      type: "insert",
      position: index,
      text: safeAfter.slice(index, index + insertedLength)
    };
  }

  if (safeAfter.length < safeBefore.length) {
    let index = 0;

    while (
      index < safeAfter.length &&
      safeBefore[index] === safeAfter[index]
    ) {
      index += 1;
    }

    const deletedLength = safeBefore.length - safeAfter.length;

    return {
      type: "delete",
      position: index,
      length: deletedLength
    };
  }

  return {
    type: "noop",
    position: 0,
    text: ""
  };
}

function getTextOperationFromRecord(operationRecord) {
  if (operationRecord.otOperation) {
    return ot.TextOperation.fromJSON(operationRecord.otOperation);
  }

  if (
    operationRecord.operation &&
    Number.isInteger(operationRecord.baseContentLength)
  ) {
    return simpleToTextOperation(
      operationRecord.operation,
      operationRecord.baseContentLength
    );
  }

  throw new Error("Operation record does not contain a valid OT operation");
}

function transformAgainstHistory(incomingTextOperation, history) {
  let transformedOperation = incomingTextOperation;

  for (const operationRecord of history) {
    const existingOperation = getTextOperationFromRecord(operationRecord);

    const transformedPair = ot.TextOperation.transform(
      transformedOperation,
      existingOperation
    );

    transformedOperation = transformedPair[0];
  }

  return transformedOperation;
}

function buildAndTransformOperation({
  simpleOperation,
  baseContentLength,
  history
}) {
  const incomingTextOperation = simpleToTextOperation(
    simpleOperation,
    baseContentLength
  );

  return transformAgainstHistory(incomingTextOperation, history);
}

module.exports = {
  isValidSimpleOperation,
  simpleToTextOperation,
  textOperationToSimple,
  transformAgainstHistory,
  applyTextOperation,
  buildAndTransformOperation
};