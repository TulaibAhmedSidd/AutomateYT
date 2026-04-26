import { NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import connectToDatabase from '@/lib/mongodb';
import { Settings } from '@/models/Settings';
import { generateImage } from '@/lib/ai';

const IS_VERCEL = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const WORKSPACE_DIR = IS_VERCEL ? '/tmp' : process.cwd();

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = typeof body.prompt === 'string' ? body.prompt : '';
    const model = typeof body.model === 'string' ? body.model : 'leonardo-sdxl-basic';

    if (!prompt.trim()) {
      return NextResponse.json({ success: false, error: 'Image prompt is required' }, { status: 400 });
    }

    await connectToDatabase();
    const settings = await Settings.findOne() || {};
    const publicDir = path.join(WORKSPACE_DIR, 'public', 'uploads', 'scene-images');
    const fileName = `${uuidv4()}.png`;
    const targetPath = path.join(publicDir, fileName);

    await fs.ensureDir(publicDir);
    await generateImage(prompt, targetPath, settings, model);

    return NextResponse.json({
      success: true,
      path: `/uploads/scene-images/${fileName}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Scene image generation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
