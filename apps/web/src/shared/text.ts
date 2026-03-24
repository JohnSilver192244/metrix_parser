const HTML_ENTITY_REPLACEMENTS: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
  "&rarr;": "→",
  "&larr;": "←",
  "&mdash;": "-",
  "&ndash;": "-",
};

const HTML_ENTITY_PATTERN = /&(?:amp|lt|gt|quot|#39|nbsp|rarr|larr|mdash|ndash);/g;

export function decodeHtmlEntities(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value.replace(HTML_ENTITY_PATTERN, (entity) => {
    return HTML_ENTITY_REPLACEMENTS[entity] ?? entity;
  });
}
