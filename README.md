# probe-guard

Detects WhatsApp silent pings (Careless Whisper).

A probe is an edit / reaction / delete aimed at a **message ID that does not exist**. WhatsApp hides this in the UI. Baileys still sees it.

```
probe edit 9725...@s.whatsapp.net 3A00B2C4D5E6F7A8
```

## How it works

Runs as a **linked device**. The app UI never shows silent pings, but the protocol still delivers them.

1. `messages.upsert` - every real message stores `(chat jid, message id)` in memory using an hash map (specific chat JID: message IDs)
2. `messages.update` **/** `messages.reaction` - if someone edits, deletes, or reacts to an id that was **never** stored, that's a probe.

Real edit on a message you already received → id is in the set → no log.

Only ids seen **while this process is running** count (history that syncs in via upsert counts too). No disk store.

## Run

```bash
git clone https://github.com/l1am-s/probe-guard.git
cd probe-guard
npm install
npm start
```

Scan the QR (WhatsApp → Linked devices). Session is stored in `auth/`.

## Blind spot

Probes target **one device index**. This tool only sees probes aimed at **itself**.

An attacker who enumerates devices (using Tal Beery's Project) can ping the phone and skip this linked session entirely.

## Phone hooks

Attackers usually probe a specific device `by id` (the phone). If you intercept protocol handling inside the official WhatsApp app via Frida, Xposed/LSPosed, or similar script hooks you can:

- See probes aimed at the phone itself (the most common target)
- Avoid exposing an extra linked device in the device list

That closes the gap this tool cannot.