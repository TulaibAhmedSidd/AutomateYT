import { google } from 'googleapis';
import fs from 'fs';

type YoutubeSettings = {
  apiKeys?: {
    youtubeClientId?: string;
    youtubeClientSecret?: string;
    youtubeRefreshToken?: string;
  };
};

type YoutubeVideo = {
  title?: string;
  description?: string;
  tags?: string[];
};

export async function getYoutubeClient(settings: YoutubeSettings) {
  const oauth2Client = new google.auth.OAuth2(
    settings.apiKeys?.youtubeClientId || process.env.YOUTUBE_CLIENT_ID,
    settings.apiKeys?.youtubeClientSecret || process.env.YOUTUBE_CLIENT_SECRET,
    'http://localhost:3000/oauth2callback'
  );

  const refreshToken = settings.apiKeys?.youtubeRefreshToken || process.env.YOUTUBE_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error('No YouTube refresh token found');
  }

  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });

  return google.youtube({
    version: 'v3',
    auth: oauth2Client
  });
}

export async function uploadVideo(video: YoutubeVideo, videoFilePath: string, thumbnailPath: string, settings: YoutubeSettings) {
  try {
    const youtube = await getYoutubeClient(settings);
    console.log('Uploading Youtube Video', video.title);

    const res = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: video.title,
          description: video.description,
          tags: video.tags,
          categoryId: '27',
          defaultLanguage: 'en'
        },
        status: {
          privacyStatus: 'private',
          selfDeclaredMadeForKids: false
        }
      },
      media: {
        body: fs.createReadStream(videoFilePath)
      }
    });

    if (res.data.id && thumbnailPath && fs.existsSync(thumbnailPath)) {
      await youtube.thumbnails.set({
        videoId: res.data.id,
        media: {
          body: fs.createReadStream(thumbnailPath)
        }
      });
    }

    return res.data;
  } catch (error: unknown) {
    const maybeMessage = error instanceof Error ? error.message : String(error);
    if (maybeMessage.includes('invalid_grant')) {
      throw new Error('YouTube upload failed: Google rejected the refresh token (`invalid_grant`). Reconnect or replace the refresh token in Settings.');
    }
    throw error;
  }
}
