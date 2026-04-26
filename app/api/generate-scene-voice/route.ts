import { NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import connectToDatabase from '@/lib/mongodb';
import { Settings } from '@/models/Settings';
import { generateVoiceover } from '@/lib/ai';

const IS_VERCEL = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const WORKSPACE_DIR = IS_VERCEL ? '/tmp' : process.cwd();

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === 'string' ? body.text : '';
    const model = typeof body.model === 'string' ? body.model : 'eleven_multilingual_v2';

    if (!text.trim()) {
      return NextResponse.json({ success: false, error: 'Scene text is required for voice generation' }, { status: 400 });
    }

    await connectToDatabase();
    const settings = await Settings.findOne() || {};
    const publicDir = path.join(WORKSPACE_DIR, 'public', 'uploads', 'scene-audio');
    const fileName = `${uuidv4()}.mp3`;
    const targetPath = path.join(publicDir, fileName);

    await fs.ensureDir(publicDir);
    await generateVoiceover(text, targetPath, settings, model);

    return NextResponse.json({
      success: true,
      path: `/uploads/scene-audio/${fileName}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Scene voice generation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
