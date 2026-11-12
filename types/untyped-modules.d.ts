// These packages ship no TypeScript types and we don't add @types/* without asking.
// They are used only in server code (lib/ffmpeg.ts, lib/storage.ts, lib/generator.ts...).
declare module 'fs-extra';
declare module 'fluent-ffmpeg';
