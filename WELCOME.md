# 👋 Welcome to Incognito

Incognito is your family's private **digital bodyguard**. It keeps your personal
information — passwords, identities, phone numbers, payment cards, and more — in
one place, watches for it leaking online, and helps you take it back.

The most important thing to know up front:

> **Everything lives on this device.** There is no Incognito company server, no
> account in the cloud, no one else holding your data. That's the privacy
> superpower — and it means *you* are in charge of your master password and your
> backups (more on that below).

And one promise the whole app is built around: **it never pretends.** If a
feature needs something you haven't set up yet, it says so plainly instead of
faking a result. Those little status tags ("Ready", "Needs provider", "Needs
extension"…) are how it tells you the honest truth at a glance.

---

## When you first open it

1. **Create your household profile** and pick a **master password.** This
   password unlocks an encrypted vault on your device. Choose something strong
   and memorable — it is never sent anywhere and **cannot be reset.** Write it
   down somewhere safe.
2. You land on the **Dashboard** — your home base. It shows your overall
   privacy picture: a risk score, what's exposed, and a new **Protection
   Coverage** panel that tells you, at a glance, which tools are working and
   which still need a quick setup step.
3. From there, explore the sidebar. Here's what each area does, in plain English.

---

## What everything does

### 🏠 Family
- **Household** — add the people you're protecting (you, a spouse, kids).
  Sensitive details like children's birthdays and SSNs are extra-encrypted.

### 🪪 Identity (your "Cloaked"-style tools)
- **Cloaked Identities** — create separate personas (name/email/phone) to use
  with different services so your real details aren't everywhere.
- **Password Manager** — store and generate strong passwords, check them
  against known breaches, and (with the browser extension) autofill them.
- **Authenticator** — your 2-factor (TOTP) codes, with recovery codes saved.
- **Email Aliases** — hand out a forwarding address instead of your real email.
- **Phone Aliases** — the same idea for phone numbers.
- **Cloaked Pay** — virtual payment cards so merchants never see your real card.
- **Identity Sharing** — securely share a login or detail with a family member.

### 🛡️ Privacy
- **VPN Manager** — manage and check VPN configs (turning a system VPN on/off
  needs the companion app).
- **Call Guard** — check whether a phone number looks like a scam, using signals
  your device can actually verify (fake caller IDs, "neighbor spoofing", your own
  allow/block history). It *advises*; it doesn't pick up live calls by itself.
- **Family Call Coverage** — the real call-screening setup. Give each person a
  screening number to hand out; scam/spam callers are stopped and trusted callers
  ring straight through to their real phone — for your whole family, from one
  place. The page has a **built-in step-by-step guide** (with copy buttons) plus a
  one-command helper — `start-backend-tunnel.bat` — that brings the backend online
  for Twilio. Follow the guide top to bottom and you're set.
- **SSN Monitor / AI Defense** — guidance and alerts around SSN exposure and
  AI-era threats.

### 🔎 Monitor
- **Identity Scan, Scans & Breaches, Findings, Threat Intel, Monitoring Hub,
  Password Checker** — scan the web and breach databases for your information,
  see where it turned up, and track the risk over time. External scans only run
  with your explicit consent.

### 🧹 Protect (take your data back)
- **Deletion Center & Broker Directory** — request removal from data-broker
  sites that sell your info.
- **Social Media, Financial Monitor, Legal Support, Spam Tracker** — tighten
  social accounts, watch finances, find class-action settlements you qualify
  for, and track spam.
- **Identity Recovery** — a step-by-step plan if your identity is ever stolen
  (FTC report, credit freezes, the works).

### 💾 Data
- **Vault** — the heart of the app: your encrypted personal information, plus
  the **Recovery Center** (see below).
- **AI Insights / Free Perks** — helpful summaries and benefits you may be
  entitled to.

### ⚙️ System
- **Notifications, Profiles, Settings** — alerts, switching family profiles, and
  where you connect optional services (API keys) and the backend.

---

## 🔑 Autofill (the browser extension)

Filling passwords into websites needs a small companion **browser extension** —
a web page alone isn't allowed to type into other sites. The easiest way to run
everything together: launch with **`launch.bat`**, which opens the app in a
browser with the extension already loaded. Then, when you click "Fill," Incognito
asks *you* to approve before handing over a password — so nothing is filled
silently.

> On phones: Chrome and Samsung Internet can't run extensions, so autofill there
> would need a separate native app. The extension is for your computer.

## 📞 About screening calls (the honest version)

- **Call Guard** rates a number you give it. It can't intercept a live call.
- **Family Call Coverage** *can* screen real calls for you and your family — but
  only because calls route through Twilio numbers you set up. The app can't make
  your carrier do anything; it screens and routes once calls reach it.
- No local app — web or native — can silently grab calls ringing on someone
  else's phone. Central coverage is the only way to cover multiple people.

## 💿 Backups & recovery (please read once)

Because your data lives only here, two things can lose it forever: **forgetting
your master password**, or **losing this device/browser**. So:

- Open **Vault → Recovery Center**. It shows a protection score and a one-click
  **encrypted backup** — save that file somewhere safe (a USB stick, a second
  device).
- Record your master password somewhere secure too.
- The Recovery Center will nudge you if your backup is old or missing.

---

## ✅ A good first 10 minutes

1. Set a strong master password and **write it down**.
2. Add your household members.
3. Add a few key items to the **Vault** (main email, phone, etc.).
4. Run a **scan** from the Dashboard to see what's exposed.
5. Make your first **encrypted backup** in the Recovery Center.
6. Glance at **Protection Coverage** on the Dashboard — it'll show you the next
   useful thing to turn on.

That's it. Everything beyond this is optional and clearly labeled. Welcome aboard. 🛡️
