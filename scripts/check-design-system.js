#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOT = path.join(ROOT, 'apps/web/src');

const rules = {
  arbitraryValue: /\b(?:[a-z][a-z0-9-]*:)*(?!(?:data|group-data|peer-data|has)-\[)-?[a-z][a-z0-9-]*-\[(?![^\]\r\n"'`]*[=>])[^\]\r\n"'`]+\]/g,
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

function violations(current) {
  return Object.entries(current).flatMap(([file, counts]) =>
    Object.entries(counts).map(([rule, count]) => `${file}: ${rule} has ${count} violation${count === 1 ? '' : 's'}`),
  );
}

function main() {
  const current = scanRepository();
  const failures = violations(current);
  if (failures.length) {
    console.error(`Design-system violations:\n${failures.join('\n')}\nUse shared components and design tokens.`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { scanSource, violations };
