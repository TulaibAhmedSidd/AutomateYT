import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Video } from '@/models/Video';
import fs from 'fs-extra';
import path from 'path';

export async function DELETE() {
  try {
    await connectToDatabase();
    
    // Clear out the database
    await Video.deleteMany({});
    
    // Delete all files in public directories except .keep
    const dirs = ['public/videos', 'public/audio', 'public/images'];
    for (const dir of dirs) {
      const dirPath = path.resolve(dir);
      if (await fs.pathExists(dirPath)) {
        await fs.emptyDir(dirPath);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
