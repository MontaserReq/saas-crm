'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');
const destination = path.resolve(process.argv[2] || '');
if (!process.argv[2]) {
  console.error('Usage: node scripts/prepare-release-workspace.cjs <new-directory-outside-repository>');
  process.exit(2);
}
const relativeToRepository = path.relative(repositoryRoot, destination);
if (!relativeToRepository.startsWith('..') || path.isAbsolute(relativeToRepository)) {
  console.error('The isolated release workspace must be outside the repository.');
  process.exit(2);
}
if (fs.existsSync(destination)) {
  console.error('The isolated release workspace must not already exist.');
  process.exit(2);
}

const topLevelFiles = [
  '.eslintrc.json',
  'components.json',
  'next-env.d.ts',
  'next.config.mjs',
  'package-lock.json',
  'package.json',
  'postcss.config.mjs',
  'tailwind.config.ts',
  'tsconfig.json',
];
const topLevelDirectories = ['public', 'src'];
const releaseScripts = ['standalone-xlsx-smoke.cjs', 'verify-release-artifact.cjs'];

fs.mkdirSync(destination, { recursive: false });
for (const name of topLevelFiles) {
  const source = path.join(repositoryRoot, name);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(destination, name));
}
for (const name of topLevelDirectories) {
  const source = path.join(repositoryRoot, name);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(destination, name), { recursive: true, errorOnExist: true });
}
fs.mkdirSync(path.join(destination, 'prisma'), { recursive: true });
fs.copyFileSync(path.join(repositoryRoot, 'prisma', 'schema.prisma'), path.join(destination, 'prisma', 'schema.prisma'));
fs.mkdirSync(path.join(destination, 'scripts'), { recursive: true });
for (const name of releaseScripts) fs.copyFileSync(path.join(repositoryRoot, 'scripts', name), path.join(destination, 'scripts', name));

function assertNoEnvironmentFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (/^\.env(?:\.|$)/i.test(entry.name)) throw new Error(`Refusing isolated workspace containing an environment file: ${entry.name}`);
    if (entry.isDirectory()) assertNoEnvironmentFiles(path.join(directory, entry.name));
  }
}
assertNoEnvironmentFiles(destination);
console.log(`Prepared isolated release source workspace: ${destination}`);
console.log('No repository environment files were copied. Install from the lockfile and supply only synthetic build-time environment values.');
