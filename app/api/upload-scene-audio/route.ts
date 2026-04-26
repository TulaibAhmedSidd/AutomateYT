import { NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const IS_VERCEL = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const WORKSPACE_DIR = IS_VERCEL ? '/tmp' : process.cwd();

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No audio file received' }, { status: 400 });
    }

    const ext = path.extname(file.name || '').toLowerCase() || '.mp3';
    const allowed = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg']);
    if (!allowed.has(ext)) {
      return NextResponse.json({ success: false, error: 'Unsupported audio type' }, { status: 400 });
    }

    const fileName = `${uuidv4()}${ext}`;
    const publicDir = path.join(WORKSPACE_DIR, 'public', 'uploads', 'scene-audio');
    const targetPath = path.join(publicDir, fileName);

    await fs.ensureDir(publicDir);
    const bytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(targetPath, bytes);

    return NextResponse.json({
      success: true,
      path: `/uploads/scene-audio/${fileName}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Audio upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
