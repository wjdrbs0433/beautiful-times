// Compile in an ASCII path: Kotlin may misread jars inside a Korean source path.
import { spawn, spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const mirror = join(os.tmpdir(), `bt-native-${process.getuid?.() ?? 'local'}`);
const env = { ...process.env, ANDROID_HOME: process.env.ANDROID_HOME || join(os.homedir(), 'Library/Android/sdk') };
const java17 = '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home';
if (!env.JAVA_HOME && existsSync(java17)) env.JAVA_HOME = java17;
function run(command, args, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command}: ${code}`)));
  });
}
try {
  if (os.platform() !== 'darwin') throw new Error('이 실행 도우미는 현재 Mac용입니다.');
  const adb = join(env.ANDROID_HOME, 'platform-tools/adb');
  const probe = spawnSync(adb, ['devices'], { encoding: 'utf8', env });
  if (probe.status !== 0) throw new Error('ADB를 실행하지 못했어요. Android SDK 경로를 확인해 주세요.');
  const devices = probe.stdout.split('\n').filter(line => /\tdevice\s*$/.test(line)).map(line => line.split('\t')[0]);
  const device = process.env.BT_ANDROID_SERIAL || (devices.length === 1 ? devices[0] : null);
  if (!device || !devices.includes(device)) throw new Error('USB 디버깅을 허용한 기기 1대를 연결해 주세요. 여러 대라면 BT_ANDROID_SERIAL을 지정하세요.');
  if (!existsSync(join(root, 'android'))) await run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install']);
  await mkdir(mirror, { recursive: true, mode: 0o700 });
  console.log('BT Android 빌드 준비:', mirror);
  await run('rsync', ['-a', '--exclude=/.git', '--exclude=/.env.route.local', '--exclude=/.expo', '--exclude=/dist', '--exclude=/dist-android', '--exclude=/android/.gradle', '--exclude=/android/build', '--exclude=/android/app/build', '--exclude=/node_modules/**/android/**/build', '--exclude=/node_modules/**/android/**/.gradle', '--exclude=/node_modules/@react-native/gradle-plugin/**/build', `${root}/`, `${mirror}/`]);
  await run('./gradlew', ['app:assembleDebug', '-x', 'lint', '-x', 'test', '--no-build-cache', '-Dkotlin.incremental=false', '-PreactNativeDevServerPort=8081', '-PreactNativeArchitectures=arm64-v8a'], join(mirror, 'android'));
  const apk = join(mirror, 'android/app/build/outputs/apk/debug/app-debug.apk');
  await run(adb, ['-s', device, 'install', '-r', apk]);
  await run(adb, ['-s', device, 'reverse', 'tcp:8081', 'tcp:8081']);
  await run(adb, ['-s', device, 'reverse', 'tcp:8090', 'tcp:8090']);
  await run(adb, ['-s', device, 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'bt://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081', 'com.beautifultimes.bt']);
  console.log('설치 완료. 다른 터미널에서 npm start로 개발 서버를 실행하세요.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
