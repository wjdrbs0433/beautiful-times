# Repository workflow

## Private USB backup before Git upload

The user requires the local encrypted USB backup to be refreshed before any
Git commit/push from this workspace. Do not upload merely because the backup
was updated; preserve the user's requested review/approval sequence.

1. Use `bt/scripts/private-backup.py` to refresh
   `docs/BT-개발설정-USB백업.zip` from the current local environment files.
2. Run the same script with `--check` to verify encryption, archive contents,
   and byte-for-byte correspondence with the current local files.
3. Run `npm run security:secrets` from `bt/`, then inspect staged paths.
4. Never stage the ZIP, `.env.usb-backup-password`, actual `.env` files, or
   `.backup-tools/`. If tracked accidentally, stop before commit/push.

Use the private Python virtual environment `.backup-tools/` when present:
`.backup-tools/bin/python bt/scripts/private-backup.py` on macOS/Linux, or
`.backup-tools/Scripts/python.exe bt/scripts/private-backup.py` on Windows.
The script requires `pyzipper==0.4.0`; install it into a separate local virtual
environment when needed. Do not silently fall back to an unencrypted ZIP or
legacy ZipCrypto. Never print secrets or the archive password in tool output.

The password file must remain separate from the USB ZIP. Do not replace an
existing password automatically. If the password is missing but an archive
already exists, request recovery of the password instead of overwriting it.

The backup contains only `bt/.env.local`, `bt/.env.route.local`, an encrypted
restore guide, and an encrypted integrity manifest. Do not add user records,
photos, node_modules, build output, or signing credentials without a new review.

This rule is local workflow guidance, not a background sync service. Changes
made outside this workflow do not automatically update an already copied USB.
