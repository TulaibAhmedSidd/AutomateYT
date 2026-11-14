import fs from 'fs';
import path from 'path';

// Social account connections, saved on this PC only (storage/connections.json, gitignored). Server only.
// Tokens never go to the browser.

export type YoutubeConnection = { refreshToken: string; channelId: string; channelTitle: string; connectedAt: string };
export type Connections = { youtube?: YoutubeConnection };

const FILE = path.join(process.cwd(), 'storage', 'connections.json');

/** Saved connections (empty when none). */
export function readConnections(): Connections {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8')) as Connections;
  } catch {
    return {};
  }
}

/** Saves or removes (undefined) one connection. */
export function saveConnection<K extends keyof Connections>(key: K, value: Connections[K] | undefined) {
  const all = readConnections();
  if (value === undefined) delete all[key];
  else all[key] = value;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
}
