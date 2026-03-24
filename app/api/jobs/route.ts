import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Job } from '@/models/Job';

export async function GET() {
  await connectToDatabase();
  const jobs = await Job.find().sort({ createdAt: -1 }).populate('videoId').limit(20);
  return NextResponse.json(jobs);
}
