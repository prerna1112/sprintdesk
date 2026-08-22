import { describe, expect, it } from 'vitest';
import { isSafeInternalPath, safeInternalPath } from './safe-internal-path';

describe('safeInternalPath', () => {
  it.each([
    '/',
    '/login',
    '/dashboard?tab=assigned',
    '/board/task/123#comments',
    '/analytics?range=30%20days#velocity',
    '/search?q=https%3A%2F%2Fexample.com',
    '/teams%2Fengineering/board',
  ])('accepts the same-app path %s', (path) => {
    expect(isSafeInternalPath(path)).toBe(true);
    expect(safeInternalPath(path, '/login')).toBe(path);
  });

  it.each([
    ['', 'empty destination'],
    ['dashboard', 'relative path'],
    ['?next=/dashboard', 'query-only destination'],
    ['https://evil.example/path', 'HTTPS URL'],
    ['http://evil.example/path', 'HTTP URL'],
    ['javascript:alert(1)', 'JavaScript scheme'],
    ['data:text/html,<h1>bad</h1>', 'data scheme'],
    ['//evil.example/path', 'protocol-relative URL'],
    ['///evil.example/path', 'multi-slash URL'],
    ['\\\\evil.example\\path', 'backslash-relative URL'],
    ['/\\evil.example/path', 'mixed slash URL'],
    ['/%5cevil.example/path', 'encoded lowercase backslash'],
    ['/%5Cevil.example/path', 'encoded uppercase backslash'],
    ['/%255Cevil.example/path', 'double-encoded backslash'],
    ['/%2f%2fevil.example/path', 'encoded protocol-relative URL'],
    ['/%252f%252fevil.example/path', 'double-encoded protocol-relative URL'],
    ['/safe\n//evil.example', 'line-feed control character'],
    ['/safe\t//evil.example', 'tab control character'],
    ['/safe%0a//evil.example', 'encoded line feed'],
    ['/safe%00evil.example', 'encoded null byte'],
    ['/bad%2', 'truncated encoding'],
    ['/bad%E0%A4%A', 'malformed UTF-8 encoding'],
  ])('falls back for %s (%s)', (target) => {
    expect(isSafeInternalPath(target)).toBe(false);
    expect(safeInternalPath(target, '/dashboard')).toBe('/dashboard');
  });

  it.each([null, undefined, 42, {}, ['/dashboard']])(
    'falls back for a non-string target',
    (target) => {
      expect(safeInternalPath(target, '/login')).toBe('/login');
    },
  );

  it('rejects an unsafe fallback instead of returning it', () => {
    expect(() => safeInternalPath('/dashboard', '//evil.example')).toThrow(
      'Navigation fallback must be a safe internal path',
    );
  });
});
