/**
 * Prompt-hash manifest helpers.
 *
 * Decision: regenerate is opt-in. A generated file carries a `// buildout:
 * <sha256>` header line; the next run skips regeneration if the prompt hash
 * matches. This avoids surprising the user with rewritten business logic
 * just because they re-ran the CLI.
 *
 * Browser/Node compatibility: we use the Web Crypto API (`crypto.subtle`),
 * which is available in modern Node (>= 16) and in browsers — no Node-only
 * `crypto` import. This keeps buildout usable from the UI later.
 */

const HEADER_PREFIX = "// buildout: ";

/** Hash a string with SHA-256 and return the hex digest. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Build a header line carrying the prompt hash. */
export function buildHeader(promptHash: string, commentSyntax: "//" | "#" | "--" = "//"): string {
  // The `// buildout:` token is recognized across language families; we
  // emit the language-appropriate comment prefix so the file still parses.
  return `${commentSyntax} buildout: ${promptHash}\n`;
}

/** Extract the prompt hash from a generated file's header, if present. */
export function extractPromptHash(contents: string): string | undefined {
  const first = contents.split("\n", 1)[0] ?? "";
  // Accept any of the comment styles we emit.
  for (const prefix of [HEADER_PREFIX, "# buildout: ", "-- buildout: "]) {
    if (first.startsWith(prefix)) return first.slice(prefix.length).trim();
  }
  return undefined;
}

/**
 * Should we regenerate? Compares the freshly-computed prompt hash to the
 * one persisted in the existing file (if any). Missing file → regenerate.
 */
export function shouldRegenerate(
  existingContents: string | undefined,
  newPromptHash: string,
): boolean {
  if (!existingContents) return true;
  const existing = extractPromptHash(existingContents);
  return existing !== newPromptHash;
}
