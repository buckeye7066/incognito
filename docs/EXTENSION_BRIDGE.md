# Browser Extension Bridge

True autofill — reading the active tab's domain and injecting credentials into a
page — is impossible from a sandboxed web app. It requires a companion browser
extension. Until one is installed, the web app shows **"extension bridge not
installed"** and never claims full autofill.

Contract: `src/lib/extensionBridge.js`. When present, the extension injects
`window.__INCOGNITO_EXTENSION__` with `version: string` and the methods below.
Absent that, every method rejects with `code === 'E_NO_EXTENSION'`.

## Protocol

| Method | Purpose |
|---|---|
| `getMatchingLogins(domain)` | Logins whose URL matches the current domain. |
| `getMatchingIdentities(domain)` | Cloaked identities for the domain. |
| `fillPassword(id)` | Fill username+password for a login. |
| `fillIdentity(id)` | Fill a full identity (name/email/phone/…). |
| `fillTOTP(id)` | Fill the current TOTP code. |
| `saveDetectedLogin(payload)` | Save a login the page just submitted. |
| `createIdentityFromSignupPage(payload)` | Build an identity from a signup form. |
| `requestVaultUnlock()` | Ask the app to unlock the vault. |

## Security model

- The extension **never** receives the master password or the whole vault.
- For a fill, the app decrypts **only the single item** being filled, after an
  explicit user gesture, and hands the extension just that.
- All messages are origin-checked; the extension talks only to the Incognito
  app origin and the active tab it was invoked on.
- Save/create flows return data **to** the app to be encrypted there; the
  extension does not persist secrets.
