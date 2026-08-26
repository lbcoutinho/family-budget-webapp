const assert = require('node:assert/strict');
const test = require('node:test');

const { scanSource, violations } = require('./check-design-system');

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

test('rejects every design-system escape', () => {
  assert.deepEqual(violations({}), []);
  assert.deepEqual(violations({ 'screen.tsx': { arbitraryValue: 3 }, 'new.tsx': { nativeControl: 1 } }), [
    'screen.tsx: arbitraryValue has 3 violations',
    'new.tsx: nativeControl has 1 violation',
  ]);
});
