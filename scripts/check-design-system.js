#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOT = path.join(ROOT, 'apps/web/src');
const BASELINE_PATH = path.join(ROOT, 'scripts/design-system-baseline.json');

const rules = {
  arbitraryValue: /\b(?:[a-z][a-z0-9-]*:)*-?[a-z][a-z0-9-]*-\[[^\]\r\n"'`]+\]/g,
  literalColor: /#[0-9a-f]{3,8}\b|\b(?:rgb|hsl|oklch|lab|color)\(/gi,
  nativeControl: /<(?:button|input|select|textarea)\b/g,
  unsupportedFont: /\bfont-(?:mono|serif)\b|fontFamily\s*:/g,
};

function scanSource(source) {
  return Object.fromEntries(
    Object.entries(rules)
      .map(([name, pattern]) => [name, (source.match(pattern) || []).length])
      .filter(([, count]) => count),
  );
}

function sourceFiles(directory = SOURCE_ROOT) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    if (!entry.name.endsWith('.tsx') || entry.name.endsWith('.test.tsx')) return [];
    return [path.relative(ROOT, fullPath)];
  });
}

function scanRepository() {
  return Object.fromEntries(
    sourceFiles()
      .map((file) => {
        const counts = scanSource(fs.readFileSync(path.join(ROOT, file), 'utf8'));
        if (file.startsWith('apps/web/src/components/ui/')) delete counts.nativeControl;
        return [file, counts];
      })
      .filter(([, counts]) => Object.keys(counts).length),
  );
}

function regressions(current, baseline) {
  return Object.entries(current).flatMap(([file, counts]) =>
    Object.entries(counts)
      .filter(([rule, count]) => count > ((baseline[file] && baseline[file][rule]) || 0))
      .map(([rule, count]) => `${file}: ${rule} increased from ${(baseline[file] && baseline[file][rule]) || 0} to ${count}`),
  );
}

function main() {
  const current = scanRepository();
  if (process.argv.includes('--write-baseline')) {
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  const failures = regressions(current, baseline);
  if (failures.length) {
    console.error(
      `Design-system violations:\n${failures.join('\n')}\nUse shared components and design tokens. Update the baseline only for an approved exception.`,
    );
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { regressions, scanSource };
