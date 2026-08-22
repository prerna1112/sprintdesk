function containsUnsafeCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (
      character === '\\'
      || codePoint <= 0x1f
      || (codePoint >= 0x7f && codePoint <= 0x9f)
      || codePoint === 0x2028
      || codePoint === 0x2029
    ) {
      return true;
    }
  }

  return false;
}

function hasSafeInternalShape(value: string): boolean {
  return value.startsWith('/')
    && !value.startsWith('//')
    && !containsUnsafeCharacter(value);
}

/**
 * Returns whether a value is a same-application absolute path.
 *
 * Constant route destinations may be used directly. Any destination influenced
 * by a URL, API response, browser storage, or other user-controlled input must
 * pass through this boundary before it reaches React Router.
 */
export function isSafeInternalPath(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  let candidate = value;
  let decodedAtLeastOnce = false;

  // Every successful decoding pass shortens the string, so its initial length
  // is a strict upper bound that also prevents unbounded attacker-controlled work.
  for (let attempt = 0; attempt <= value.length; attempt += 1) {
    if (!hasSafeInternalShape(candidate)) {
      return false;
    }

    if (!candidate.includes('%')) {
      return true;
    }

    let decoded: string;
    try {
      decoded = decodeURIComponent(candidate);
    } catch {
      // A malformed original encoding is unsafe. A later failure can be a
      // legitimate encoded percent (for example, `%25`) and cannot introduce
      // a slash, backslash, or control character that was not already checked.
      return decodedAtLeastOnce;
    }

    decodedAtLeastOnce = true;
    if (decoded === candidate) {
      return true;
    }
    candidate = decoded;
  }

  return false;
}

/**
 * Resolves a potentially dynamic navigation target to a safe internal path.
 * The fallback is treated as trusted configuration and must itself be safe.
 */
export function safeInternalPath(value: unknown, fallback: string): string {
  if (!isSafeInternalPath(fallback)) {
    throw new Error('Navigation fallback must be a safe internal path');
  }

  return isSafeInternalPath(value) ? value : fallback;
}
