import { google } from 'googleapis';
import fs from 'fs';

export async function getYoutubeClient(settings: any) {
  const oauth2Client = new google.auth.OAuth2(
    settings.apiKeys.youtubeClientId || process.env.YOUTUBE_CLIENT_ID,
    settings.apiKeys.youtubeClientSecret || process.env.YOUTUBE_CLIENT_SECRET,
    'http://localhost:3000/oauth2callback' // Adjust redirect URI
  );

  const refreshToken = settings.apiKeys.youtubeRefreshToken || process.env.YOUTUBE_REFRESH_TOKEN;
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

export async function uploadVideo(video: any, videoFilePath: string, thumbnailPath: string, settings: any) {
  const youtube = await getYoutubeClient(settings);

  console.log('Uploading Youtube Video', video.title);

  const fileSize = fs.statSync(videoFilePath).size;

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: video.title,
        description: video.description,
        tags: video.tags,
        categoryId: '27', // Education
        defaultLanguage: 'en'
      },
      status: {
        privacyStatus: 'private', // private or public
        selfDeclaredMadeForKids: false
      }
    },
    media: {
      body: fs.createReadStream(videoFilePath)
    }
  });

  if (res.data.id && thumbnailPath && fs.existsSync(thumbnailPath)) {
    console.log('Video uploaded. Uploading thumbnail...');
    await youtube.thumbnails.set({
      videoId: res.data.id,
      media: {
        body: fs.createReadStream(thumbnailPath)
      }
    });
  }

  return res.data;
}
