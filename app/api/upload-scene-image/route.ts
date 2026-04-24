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
      return NextResponse.json({ success: false, error: 'No image file received' }, { status: 400 });
    }

    const ext = path.extname(file.name || '').toLowerCase() || '.png';
    const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp']);
    const safeExt = allowed.has(ext) ? ext : '.png';
    const fileName = `${uuidv4()}${safeExt}`;
    const publicDir = path.join(WORKSPACE_DIR, 'public', 'uploads', 'scene-images');
    const targetPath = path.join(publicDir, fileName);

    await fs.ensureDir(publicDir);
    const bytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(targetPath, bytes);

    return NextResponse.json({
      success: true,
      path: `/uploads/scene-images/${fileName}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
