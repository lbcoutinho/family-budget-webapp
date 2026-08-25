const assert = require('node:assert/strict');
const test = require('node:test');

const { regressions, scanSource } = require('./check-design-system');

test('allows shared design tokens and components', () => {
  assert.deepEqual(scanSource('<Button className="bg-primary font-sans p-4" />'), {});
});

test('allows state and selector variants', () => {
  assert.deepEqual(scanSource('<Button className="data-[placeholder]:text-muted-foreground data-[state=open]:animate-in has-[>svg]:px-3" />'), {});
});

test('detects design-system escapes', () => {
  assert.deepEqual(scanSource('<button className="mt-[13px] font-mono" style={{ color: "#123456", fontFamily: "Inter" }} />'), {
    arbitraryValue: 1,
    literalColor: 1,
    nativeControl: 1,
    unsupportedFont: 2,
  });
});

test('rejects only increases over the per-file baseline', () => {
  const baseline = { 'screen.tsx': { arbitraryValue: 2 } };
  assert.deepEqual(regressions({ 'screen.tsx': { arbitraryValue: 2 } }, baseline), []);
  assert.deepEqual(regressions({ 'screen.tsx': { arbitraryValue: 3 }, 'new.tsx': { nativeControl: 1 } }, baseline), [
    'screen.tsx: arbitraryValue increased from 2 to 3',
    'new.tsx: nativeControl increased from 0 to 1',
  ]);
});
