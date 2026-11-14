import fs from 'fs';
import { google } from 'googleapis';
import connectToDatabase from '@/lib/mongodb';
import { Settings } from '@/models/Settings';
import { readConnections } from './connections';

// YouTube: connect once with Google sign-in, then upload finished videos. Server only.
// The Google Cloud OAuth client must list the redirect URL shown on the Connections page.

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'];

/** Where Google sends the owner back after sign-in, e.g. http://localhost:3300/api/youtube/callback. */
export function redirectUrl(origin: string) {
  return `${origin}/api/youtube/callback`;
}

/** OAuth client ID and secret: Settings page first, then .env.local. */
export async function clientKeys() {
  let saved: { youtubeClientId?: string; youtubeClientSecret?: string } = {};
  try {
    await connectToDatabase();
    const s = await Settings.findOne().lean<{ apiKeys?: { youtubeClientId?: string; youtubeClientSecret?: string } }>();
    saved = s?.apiKeys || {};
  } catch {
    // Database not reachable: use .env.local.
  }
  return {
    id: saved.youtubeClientId || process.env.YOUTUBE_CLIENT_ID || '',
    secret: saved.youtubeClientSecret || process.env.YOUTUBE_CLIENT_SECRET || '',
  };
}

/** A Google OAuth client for this app. */
export async function oauthClient(origin: string) {
  const keys = await clientKeys();
  if (!keys.id || !keys.secret) throw new Error('No YouTube OAuth client: add YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET to .env.local.');
  return new google.auth.OAuth2(keys.id, keys.secret, redirectUrl(origin));
}

/** The Google sign-in page URL. prompt=consent makes Google return a refresh token every time. */
export async function authUrl(origin: string) {
  const client = await oauthClient(origin);
  return client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });
}

/** A YouTube API client using the saved connection. */
export async function youtubeApi(origin: string) {
  const conn = readConnections().youtube;
  if (!conn) throw new Error('YouTube is not connected. Open Connections and press Connect YouTube.');
  const client = await oauthClient(origin);
  client.setCredentials({ refresh_token: conn.refreshToken });
  return google.youtube({ version: 'v3', auth: client });
}

/** Uploads an MP4. Videos from an unaudited Google project are always private until changed in YouTube Studio. */
export async function uploadToYoutube(
  origin: string,
  file: string,
  meta: { title: string; description: string; tags: string[]; madeForKids: boolean; privacy: 'private' | 'unlisted' | 'public' },
) {
  const yt = await youtubeApi(origin);
  try {
    const res = await yt.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: { title: meta.title.slice(0, 100), description: meta.description.slice(0, 4900), tags: meta.tags.slice(0, 15), categoryId: '24' },
        status: { privacyStatus: meta.privacy, selfDeclaredMadeForKids: meta.madeForKids },
      },
      media: { body: fs.createReadStream(file) },
    });
    if (!res.data.id) throw new Error('YouTube did not return a video id');
    return { id: res.data.id, url: `https://youtube.com/shorts/${res.data.id}` };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('invalid_grant')) throw new Error('The YouTube login expired. Open Connections and press Connect YouTube again.');
    if (message.includes('quota')) throw new Error('YouTube upload limit for today reached (about 6 uploads a day). Try again tomorrow.');
    throw new Error(`YouTube upload failed: ${message}`);
  }
}
