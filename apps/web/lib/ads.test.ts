import { expect, test } from 'vitest';
import { adsterraDoc } from './ads';

test('adsterraDoc builds the banner document from a key', () => {
  const doc = adsterraDoc('abc123def456', 728, 90, 'www.highperformanceformat.com');
  expect(doc).toContain(
    'atOptions={"key":"abc123def456","format":"iframe","height":90,"width":728,"params":{}}',
  );
  expect(doc).toContain('src="https://www.highperformanceformat.com/abc123def456/invoke.js"');
});
