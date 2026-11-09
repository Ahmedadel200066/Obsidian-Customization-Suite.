function findRuleEnd(css, start) {
  let quote = null;
  let parentheses = 0;
  let brackets = 0;
  for (let index = start; index < css.length; index += 1) {
    const character = css[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === "(") parentheses += 1;
    else if (character === ")") parentheses -= 1;
    else if (character === "[") brackets += 1;
    else if (character === "]") brackets -= 1;
    else if (parentheses === 0 && brackets === 0 && (character === "{" || character === ";")) {
      return { index, delimiter: character };
    }
  }
  return { index: css.length, delimiter: "" };
}

function findBlockEnd(css, start) {
  let depth = 1;
  let quote = null;
  for (let index = start; index < css.length; index += 1) {
    const character = css[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return index;
  }
  throw new Error("Custom CSS contains an unclosed block.");
}

function splitSelectors(prelude) {
  const selectors = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  for (let index = 0; index < prelude.length; index += 1) {
    const character = prelude[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = null;
    } else if (character === "'" || character === '"') quote = character;
    else if (character === "(" || character === "[") depth += 1;
    else if (character === ")" || character === "]") depth -= 1;
    else if (character === "," && depth === 0) {
      selectors.push(prelude.slice(start, index).trim());
      start = index + 1;
    }
  }
  selectors.push(prelude.slice(start).trim());
  return selectors;
}

function scopeCss(css, rootSelector) {
  if (!css.trim()) return "";

  function parseRules(source) {
    let output = "";
    let cursor = 0;
    while (cursor < source.length) {
      while (/\s/.test(source[cursor] || "")) cursor += 1;
      if (source.slice(cursor, cursor + 2) === "/*") {
        const end = source.indexOf("*/", cursor + 2);
        if (end < 0) throw new Error("Custom CSS contains an unclosed comment.");
        output += source.slice(cursor, end + 2);
        cursor = end + 2;
        continue;
      }
      if (cursor >= source.length) break;

      const rule = findRuleEnd(source, cursor);
      const prelude = source.slice(cursor, rule.index).trim();
      if (!prelude) throw new Error("Custom CSS contains an empty rule.");
      if (rule.delimiter === ";") {
        throw new Error("Custom CSS at-rules such as @import are not allowed in module CSS.");
      }
      if (rule.delimiter !== "{") throw new Error("Custom CSS contains an incomplete rule.");
      const end = findBlockEnd(source, rule.index + 1);
      const body = source.slice(rule.index + 1, end);

      if (prelude.startsWith("@")) {
        if (!/^@(media|supports|container|layer)\b/i.test(prelude)) {
          throw new Error(`Custom CSS at-rule "${prelude.split(/\s/)[0]}" is not supported in module CSS.`);
        }
        output += `${prelude} {${parseRules(body)}}`;
      } else {
        const selectors = splitSelectors(prelude);
        if (selectors.some((selector) => !selector)) {
          throw new Error("Custom CSS contains an empty selector.");
        }
        output += `${selectors.map((selector) => `:where(${rootSelector}) ${selector}`).join(", ")} {${body}}`;
      }
      cursor = end + 1;
    }
    return output;
  }

  return parseRules(css);
}

module.exports = { scopeCss };
