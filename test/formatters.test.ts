/**
 * Tests for formatter utilities
 */

import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  createExpandableBlockquote,
  formatBashOutput,
  truncate,
} from '../src/utils/formatters';

describe('formatters', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<div>Hello</div>')).toBe('&lt;div&gt;Hello&lt;/div&gt;');
      expect(escapeHtml('A & B')).toBe('A &amp; B');
      expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
    });

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });
  });

  describe('createExpandableBlockquote', () => {
    it('should create expandable blockquote', () => {
      const result = createExpandableBlockquote('Title', 'Content');
      expect(result).toContain('<b>Title</b>');
      expect(result).toContain('<blockquote expandable>Content</blockquote>');
    });

    it('should escape HTML in title and content', () => {
      const result = createExpandableBlockquote('<title>', '<content>');
      expect(result).toContain('&lt;title&gt;');
      expect(result).toContain('&lt;content&gt;');
    });
  });

  describe('formatBashOutput', () => {
    it('should format short output inline', () => {
      const result = formatBashOutput('ls -la', 'file1.txt\nfile2.txt', 0);
      expect(result).toContain('🔧');
      expect(result).toContain('<code>ls -la</code>');
      expect(result).toContain('<pre>file1.txt');
    });

    it('should use expandable blockquote for long output', () => {
      const longOutput = 'line\n'.repeat(50);
      const result = formatBashOutput('npm install', longOutput, 0);
      expect(result).toContain('<blockquote expandable>');
    });

    it('should show warning icon for non-zero exit code', () => {
      const result = formatBashOutput('npm test', 'Tests failed', 1);
      expect(result).toContain('⚠️');
      expect(result).toContain('(exit code: 1)');
    });
  });

  describe('truncate', () => {
    it('should truncate long text', () => {
      const result = truncate('Hello World', 8);
      expect(result).toBe('Hello...');
    });

    it('should not truncate short text', () => {
      const result = truncate('Hello', 10);
      expect(result).toBe('Hello');
    });
  });
});
