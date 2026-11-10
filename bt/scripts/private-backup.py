#!/usr/bin/env python3
"""Refresh/check an AES-256 ZIP without logging secrets or staging plaintext."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

try:
    import pyzipper
except ImportError:
    sys.exit('Missing pyzipper==0.4.0. Install it into .backup-tools; no backup was created.')

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / 'docs' / 'BT-개발설정-USB백업.zip'
PASSWORD = ROOT / '.env.usb-backup-password'
SOURCES = ('bt/.env.local', 'bt/.env.route.local')
GUIDE = '''# BT 개발 설정 복원

이 압축파일에는 실제 키가 있습니다. GitHub·메일·채팅에 올리지 마세요.
암호는 이 ZIP 안에 없으며 별도로 보관해야 합니다.

1. GitHub에서 프로젝트를 clone하고 bt/에서 npm ci를 실행합니다.
2. 이 ZIP을 AES ZIP을 지원하는 압축 도구로 별도 임시 폴더에 풉니다.
3. bt/.env.local, bt/.env.route.local을 clone한 프로젝트의 bt/에 복사합니다.
4. 기존 설정이 있으면 덮어쓰기 전에 따로 백업하고 맞는 개발 환경인지 확인합니다.
5. Mac에서는 두 파일에 chmod 600을 적용합니다. Windows에서는 사용자 접근 권한을 확인합니다.
6. Git 상태와 제외 규칙을 확인한 뒤 개발 서버를 재시작합니다.
7. 로그인·지도·이동시간을 확인하고 불필요한 임시 평문 복사본은 직접 정리합니다.

이 ZIP은 코드·DB·사진·서버 백업이 아닙니다. 배포 서명 키도 포함하지 않습니다.
키를 변경했으면 ZIP을 갱신하고 USB에 있는 이전 ZIP도 새 파일로 교체합니다.
ZIP의 파일명·개수·크기는 숨겨지지 않지만 각 항목의 내용은 암호화됩니다.
'''


def ignored(path):
    return subprocess.run(['git', 'check-ignore', '-q', str(path.relative_to(ROOT))], cwd=ROOT).returncode == 0


def ensure_private_paths():
    tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    for path in (ARCHIVE, PASSWORD, *(ROOT / name for name in SOURCES)):
        if path.is_symlink():
            raise RuntimeError('Refusing a symbolic link in private backup paths.')
        if path.relative_to(ROOT).as_posix() in tracked or not ignored(path):
            raise RuntimeError('A private backup/input path is tracked or not ignored. Stop before Git upload.')


def get_password(create):
    if not PASSWORD.exists():
        if not create or ARCHIVE.exists():
            raise RuntimeError('Backup password missing. Recover the existing password before proceeding.')
        value = secrets.token_urlsafe(32)
        fd = os.open(PASSWORD, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w', encoding='utf8') as handle:
            handle.write('BT_USB_BACKUP_PASSWORD=' + value + '\n')
    line = PASSWORD.read_text(encoding='utf8').strip()
    prefix = 'BT_USB_BACKUP_PASSWORD='
    if not line.startswith(prefix) or len(line[len(prefix):]) < 32:
        raise RuntimeError('Password file format/strength is invalid; existing password was not changed.')
    if os.name != 'nt':
        os.chmod(PASSWORD, 0o600)
    return line[len(prefix):].encode('utf8')


def current_payloads():
    payloads = {}
    for name in SOURCES:
        path = ROOT / name
        if not path.is_file():
            raise RuntimeError('Required local environment file is missing: ' + name)
        payloads[name] = path.read_bytes()
    payloads['복원안내.md'] = GUIDE.encode('utf8')
    return payloads


def verify(path, password, payloads):
    with pyzipper.AESZipFile(str(path)) as archive:
        expected = set(payloads) | {'manifest.json'}
        if set(archive.namelist()) != expected or len(archive.infolist()) != len(expected):
            raise RuntimeError('Unexpected or duplicate ZIP entries.')
        archive.setpassword(password)
        for info in archive.infolist():
            if not info.flag_bits & 1 or info.wz_aes_strength != 3:
                raise RuntimeError('An archive entry is not AES-256 encrypted.')
        for name, content in payloads.items():
            if archive.read(name) != content:
                raise RuntimeError('Backup is stale or differs from the local files: ' + name)
        manifest = json.loads(archive.read('manifest.json'))
        expected_hashes = {name: hashlib.sha256(data).hexdigest() for name, data in payloads.items()}
        if manifest.get('files') != expected_hashes:
            raise RuntimeError('Encrypted integrity manifest does not match.')
    with pyzipper.AESZipFile(str(path)) as locked:
        try:
            locked.read(SOURCES[0])
        except RuntimeError:
            pass
        else:
            raise RuntimeError('ZIP content can be read without a password.')
    with pyzipper.AESZipFile(str(path)) as locked:
        locked.setpassword(secrets.token_bytes(32))
        try:
            locked.read(SOURCES[0])
        except (RuntimeError, pyzipper.BadZipFile):
            pass
        else:
            raise RuntimeError('ZIP content can be read using an incorrect password.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify without refreshing the archive.')
    args = parser.parse_args()
    ensure_private_paths()
    payloads = current_payloads()
    password = get_password(create=not args.check)
    if args.check:
        verify(ARCHIVE, password, payloads)
        print('Verified: AES-256, exact current contents, password required, Git-excluded.')
        return
    manifest = {'format': 1, 'created_at': datetime.now(timezone.utc).isoformat(),
                'files': {name: hashlib.sha256(data).hexdigest() for name, data in payloads.items()}}
    ARCHIVE.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='.bt-usb-backup-', suffix='.tmp', dir=ARCHIVE.parent)
    os.close(fd)
    try:
        with pyzipper.AESZipFile(temporary, 'w', compression=pyzipper.ZIP_DEFLATED) as archive:
            archive.setpassword(password)
            archive.setencryption(pyzipper.WZ_AES, nbits=256)
            for name, data in payloads.items():
                archive.writestr(name, data)
            archive.writestr('manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2))
        verify(Path(temporary), password, payloads)
        os.replace(temporary, ARCHIVE)
        if os.name != 'nt':
            os.chmod(ARCHIVE, 0o600)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print('Updated: docs/BT-개발설정-USB백업.zip (AES-256, verified, Git-excluded).')
    print('Password retained separately in .env.usb-backup-password; value not printed.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Backup failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
