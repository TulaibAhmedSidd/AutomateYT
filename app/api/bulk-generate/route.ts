import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Video } from '@/models/Video';
import { addVideoJob } from '@/lib/queue';
import { Settings } from '@/models/Settings';
import { DEFAULT_MODEL_SELECTIONS, normalizeModelSelections } from '@/lib/generation-config';

export async function POST(req: Request) {
  try {
    const { count, modelSelections } = await req.json();
    const amount = Number(count) || 1;
    
    await connectToDatabase();
    const settings = await Settings.findOne();
    const resolvedModels = normalizeModelSelections(modelSelections, settings?.generationDefaults || DEFAULT_MODEL_SELECTIONS);
    
    const videos = [];
    for(let i=0; i<amount; i++) {
        const video = await Video.create({
            status: 'generating',
            title: `Bulk Generating Job ${i+1}`,
            videoPath: '',
            sourceContent: '',
            promptType: 'idea',
            modelSelections: resolvedModels
        });
        await addVideoJob(video._id.toString(), '', 'idea', resolvedModels.script, { modelSelections: resolvedModels });
        videos.push(video._id);
    }
    
    return NextResponse.json({ success: true, videos });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Bulk generation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
