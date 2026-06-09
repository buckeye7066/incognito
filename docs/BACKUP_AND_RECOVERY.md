# Backup & Recovery (read this — it holds your family's high-value data)

Incognito is **local-first**: your vault lives in this browser profile on this
device. That is a privacy strength and a **durability risk**. If you clear
browser data, lose the device, or forget the master password, the data is
**gone** — there is no Incognito server to restore from.

## The two things that can destroy your data

1. **Forgetting the master password.** It is never stored and cannot be reset.
   The vault key is derived from it; without it, encrypted records are
   unrecoverable by design.
2. **Losing local storage.** "Clear browsing data", a wiped device, or a new
   browser profile all erase the vault.

## What you must do

- **Make encrypted backups regularly** (Settings → Vault → Backup). The export
  is encrypted with your master password; store it somewhere safe (a second
  device, a USB key, an encrypted drive).
- **Record the master password** in a separate, secure place (a physical safe,
  a separate password manager). Consider a sealed copy for your spouse /
  emergency contact.
- **Test a restore** at least once so you know the flow works.

## Unencrypted exports

Plain CSV exports (e.g. passwords) are supported **only** behind a strong
warning and a vault-unlock confirmation. An unencrypted export is plaintext
secrets on disk — delete it immediately after use and never sync it to cloud
storage.

## Moving the household vault

Use the encrypted export → import flow to move to a new device. The import asks
for the master password to decrypt. Do not copy `localStorage`/IndexedDB files
directly between machines.
