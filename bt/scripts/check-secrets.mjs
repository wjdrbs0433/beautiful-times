// Scan Git candidates locally; report locations/rules, never matched values.
import { execFileSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { readFileSync, lstatSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root }).toString().split('\0').filter(Boolean))];
const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['supabase-server-key', /sb_secret_[A-Za-z0-9_-]{12,}/],
  ['github-token', /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
  ['aws-key', /(?:AKIA|ASIA)[A-Z0-9]{16}/],
  ['openai-key', /sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}/],
  ['jwt', /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/],
  ['literal-server-credential', /(?:KAKAO_REST_API_KEY|client[_-]?secret|service[_-]?role|password|access[_-]?token|refresh[_-]?token)\s*[=:]\s*["'][A-Za-z0-9_+/=-]{24,}["']/i],
];
const localValues = [];
for (const name of ['bt/.env.local', 'bt/.env.route.local']) {
  let text;
  try { text = readFileSync(join(root, name), 'utf8'); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    // Addresses are intentionally public; compare keys without printing them.
    if (value.length >= 12 && !/^https?:\/\//.test(value)) localValues.push([match[1], Buffer.from(value)]);
  }
}
const findings = [];
for (const file of files) {
  const path = join(root, file);
  if (lstatSync(path).isSymbolicLink()) { findings.push({ file, rule: 'review-symlink' }); continue; }
  if (/^(?:.*\/)?\.env(?:\..*)?$/.test(file) && !['bt/.env.example', 'bt/.env.route.example'].includes(file)) findings.push({ file, rule: 'actual-env-file' });
  const bytes = readFileSync(path);
  for (const [name, value] of localValues) if (bytes.includes(value)) findings.push({ file, rule: 'matches-local-key', variable: name });
  if (bytes.includes(0)) continue;
  for (const [index, line] of bytes.toString('utf8').split(/\r?\n/).entries()) {
    for (const [rule, pattern] of patterns) if (pattern.test(line)) findings.push({ file, line: index + 1, rule });
  }
}
console.log(JSON.stringify({ scannedFiles: files.length, findings }, null, 2));
if (findings.length) process.exitCode = 1;
