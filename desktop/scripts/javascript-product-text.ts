export type JavaScriptProductTextReplacement = {
  source: string;
  replacementCount: number;
  firstReplacementOffset?: number;
};

type ReplacementState = {
  replacementCount: number;
  firstReplacementOffset?: number;
};

const regexPrefixKeywords = new Set([
  "await",
  "case",
  "delete",
  "else",
  "in",
  "instanceof",
  "of",
  "return",
  "throw",
  "typeof",
  "void",
  "yield",
]);

function skipQuotedString(source: string, start: number): number {
  const quote = source[start];
  let index = start + 1;

  while (index < source.length) {
    const character = source[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === quote) {
      return index + 1;
    }
    index += 1;
  }

  throw new Error("Unable to find end of string literal.");
}

function skipLineComment(source: string, start: number): number {
  const end = source.indexOf("\n", start + 2);
  return end === -1 ? source.length : end + 1;
}

function skipBlockComment(source: string, start: number): number {
  const end = source.indexOf("*/", start + 2);
  if (end === -1) {
    throw new Error("Unable to find end of block comment.");
  }
  return end + 2;
}

function skipRegexLiteral(source: string, start: number): number {
  let escaped = false;
  let inCharacterClass = false;
  let index = start + 1;

  while (index < source.length) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      index += 1;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      index += 1;
      continue;
    }
    if (character === "[") {
      inCharacterClass = true;
      index += 1;
      continue;
    }
    if (character === "]") {
      inCharacterClass = false;
      index += 1;
      continue;
    }
    if (character === "/" && !inCharacterClass) {
      index += 1;
      while (/[A-Za-z]/.test(source[index] ?? "")) {
        index += 1;
      }
      return index;
    }
    index += 1;
  }

  throw new Error("Unable to find end of regex literal.");
}

function previousSignificantToken(source: string, index: number): string | undefined {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/.test(source[cursor] ?? "")) {
    cursor -= 1;
  }
  if (cursor < 0) {
    return undefined;
  }

  const character = source[cursor];
  if (/[A-Za-z0-9_$]/.test(character ?? "")) {
    let start = cursor;
    while (start > 0 && /[A-Za-z0-9_$]/.test(source[start - 1] ?? "")) {
      start -= 1;
    }
    return source.slice(start, cursor + 1);
  }

  return character;
}

function canStartRegex(source: string, index: number): boolean {
  const previousToken = previousSignificantToken(source, index);
  return (
    previousToken == null ||
    regexPrefixKeywords.has(previousToken) ||
    "({[=,:;!&|?+-*~^<>".includes(previousToken)
  );
}

function skipTemplateExpression(source: string, start: number): number {
  const end = findJavaScriptBlockEnd(source, start);
  if (end === undefined) {
    throw new Error("Unable to find end of template expression.");
  }
  return end;
}

function skipTemplateLiteral(source: string, start: number): number {
  let index = start + 1;

  while (index < source.length) {
    const character = source[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "`") {
      return index + 1;
    }
    if (character === "$" && source[index + 1] === "{") {
      index = skipTemplateExpression(source, index + 2);
      continue;
    }
    index += 1;
  }

  throw new Error("Unable to find end of template literal.");
}

function replaceChatGptProductText(
  value: string,
  sourceOffset: number,
  state: ReplacementState,
): string {
  const lowercaseValue = value.toLowerCase();
  return value.replace(/ChatGPT/g, (match, offset: number) => {
    if (lowercaseValue.startsWith("chatgpt-account-id", offset)) {
      return match;
    }
    state.firstReplacementOffset ??= sourceOffset + offset;
    state.replacementCount += 1;
    return "Codex";
  });
}

function replaceChatGptProductTextInTemplate(
  source: string,
  start: number,
  sourceOffset: number,
  state: ReplacementState,
): { source: string; end: number } {
  let output = "`";
  let segmentStart = start + 1;
  let index = segmentStart;

  while (index < source.length) {
    const character = source[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "`") {
      const text = replaceChatGptProductText(
        source.slice(segmentStart, index),
        sourceOffset + segmentStart,
        state,
      );
      return {
        source: output + text + "`",
        end: index + 1,
      };
    }
    if (character === "$" && source[index + 1] === "{") {
      const text = replaceChatGptProductText(
        source.slice(segmentStart, index),
        sourceOffset + segmentStart,
        state,
      );
      const expressionEnd = skipTemplateExpression(source, index + 2);
      const expression = replaceJavaScriptStrings(
        source.slice(index + 2, expressionEnd - 1),
        sourceOffset + index + 2,
        state,
      );
      output += `${text}\${${expression}}`;
      index = expressionEnd;
      segmentStart = index;
      continue;
    }
    index += 1;
  }

  throw new Error("Unable to find end of template literal while replacing product text.");
}

function replaceJavaScriptStrings(
  source: string,
  sourceOffset: number,
  state: ReplacementState,
): string {
  let output = "";
  let copyStart = 0;
  let index = 0;

  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];

    if (character === "'" || character === '"') {
      const end = skipQuotedString(source, index);
      const text = replaceChatGptProductText(
        source.slice(index + 1, end - 1),
        sourceOffset + index + 1,
        state,
      );
      output += source.slice(copyStart, index + 1) + text + character;
      copyStart = end;
      index = end;
      continue;
    }
    if (character === "`") {
      const template = replaceChatGptProductTextInTemplate(source, index, sourceOffset, state);
      output += source.slice(copyStart, index) + template.source;
      copyStart = template.end;
      index = template.end;
      continue;
    }
    if (character === "/" && next === "/") {
      index = skipLineComment(source, index);
      continue;
    }
    if (character === "/" && next === "*") {
      index = skipBlockComment(source, index);
      continue;
    }
    if (character === "/" && canStartRegex(source, index)) {
      index = skipRegexLiteral(source, index);
      continue;
    }
    index += 1;
  }

  return output + source.slice(copyStart);
}

export function replaceChatGptProductTextInJavaScriptStrings(
  source: string,
): JavaScriptProductTextReplacement {
  const state: ReplacementState = { replacementCount: 0 };
  return {
    source: replaceJavaScriptStrings(source, 0, state),
    replacementCount: state.replacementCount,
    firstReplacementOffset: state.firstReplacementOffset,
  };
}

export function findReplaceableChatGptProductTextInJavaScriptStrings(
  source: string,
): number | undefined {
  return replaceChatGptProductTextInJavaScriptStrings(source).firstReplacementOffset;
}

export function findJavaScriptBlockEnd(source: string, start: number): number | undefined {
  let depth = 1;
  let index = start;

  while (index < source.length && depth > 0) {
    const character = source[index];
    const next = source[index + 1];
    if (character === "'" || character === '"') {
      index = skipQuotedString(source, index);
      continue;
    }
    if (character === "`") {
      index = skipTemplateLiteral(source, index);
      continue;
    }
    if (character === "/" && next === "/") {
      index = skipLineComment(source, index);
      continue;
    }
    if (character === "/" && next === "*") {
      index = skipBlockComment(source, index);
      continue;
    }
    if (character === "/" && canStartRegex(source, index)) {
      index = skipRegexLiteral(source, index);
      continue;
    }

    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
    }
    index += 1;
  }

  return depth === 0 ? index : undefined;
}
