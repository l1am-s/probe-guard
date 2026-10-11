import makeWASocket, {
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  DisconnectReason,
  WAMessageStubType,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

// msg ids we've actually received, per chat
const seen = new Map<string, Set<string>>();

function add(jid: string, id: string) {
  let s = seen.get(jid);
  if (!s) seen.set(jid, (s = new Set()));
  s.add(id);
}

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();
  const silent = pino({ level: 'silent' });

  const sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, silent) },
    logger: silent,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) qrcode.generate(qr, { small: true });

    if (connection === 'open') {
      console.log('connected', sock.user?.id);
    }

    if (connection === 'close') {
      const code = (lastDisconnect?.error as any)?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.log('logged out — delete auth/ and run again');
        return;
      }
      console.log('reconnect');
      connect();
    }
  });

  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const m of messages) {
      const jid = m.key.remoteJid;
      const id = m.key.id;
      if (jid && id) add(jid, id);
    }
  });

  sock.ev.on('messages.update', (updates) => {
    for (const { key, update } of updates) {
      const jid = key.remoteJid;
      const id = key.id;
      if (!jid || !id || seen.get(jid)?.has(id)) continue;
      if (update.message?.editedMessage) console.log('probe edit', jid, id);
      if (update.messageStubType === WAMessageStubType.REVOKE) console.log('probe delete', jid, id);
    }
  });

  sock.ev.on('messages.reaction', (reactions) => {
    for (const { key } of reactions) {
      const jid = key.remoteJid;
      const id = key.id;
      if (jid && id && !seen.get(jid)?.has(id)) console.log('probe reaction', jid, id);
    }
  });
}

console.log('probe-guard');
connect();
