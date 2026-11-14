import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { oauthClient } from '@/lib/youtube-connect';
import { saveConnection } from '@/lib/connections';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Google sends the owner back here after sign-in. Saves the refresh token on this PC and reads the channel name.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(`${url.origin}/connections?${q}`);
  const error = url.searchParams.get('error');
  if (error) return back(`youtube_error=${encodeURIComponent(error === 'access_denied' ? 'Sign-in was cancelled.' : error)}`);
  const code = url.searchParams.get('code');
  if (!code) return back('youtube_error=No%20code%20from%20Google');
  try {
    const client = await oauthClient(url.origin);
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) throw new Error('Google did not return a refresh token. Remove the app at myaccount.google.com/permissions and connect again.');
    client.setCredentials(tokens);
    const yt = google.youtube({ version: 'v3', auth: client });
    const me = await yt.channels.list({ part: ['snippet'], mine: true });
    const channel = me.data.items?.[0];
    if (!channel?.id) throw new Error('This Google account has no YouTube channel. Create one at youtube.com first.');
    saveConnection('youtube', {
      refreshToken: tokens.refresh_token,
      channelId: channel.id,
      channelTitle: channel.snippet?.title || 'YouTube channel',
      connectedAt: new Date().toISOString(),
    });
    return back('youtube=connected');
  } catch (e) {
    return back(`youtube_error=${encodeURIComponent(e instanceof Error ? e.message : String(e))}`);
  }
}
