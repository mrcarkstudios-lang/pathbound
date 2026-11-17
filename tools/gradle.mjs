// Runs the Gradle wrapper of the Android project on any shell: node tools/gradle.mjs assembleDebug
import { spawnSync } from 'node:child_process'; import path from 'node:path';
const cwd = path.resolve(import.meta.dirname, '../android'); const win = process.platform === 'win32';
const exe = path.join(cwd, win ? 'gradlew.bat' : 'gradlew'); const args = process.argv.slice(2).length ? process.argv.slice(2) : ['assembleDebug'];
const r = win ? spawnSync(`"${exe}" ${args.join(' ')}`, { cwd, stdio: 'inherit', shell: true }) : spawnSync(exe, args, { cwd, stdio: 'inherit' });
process.exit(r.status ?? 1);
