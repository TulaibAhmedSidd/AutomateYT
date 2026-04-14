import mongoose from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import fs from 'fs-extra';
import path from 'path';

type StoredAssetRef = {
  fileId: string;
  filename: string;
  contentType: string;
  url: string;
};

function getBucket() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB connection is not ready for GridFS storage');
  }

  return new GridFSBucket(db, { bucketName: 'videoauto_media' });
}

export async function saveLocalFileToGridFS(localPath: string, remoteName: string, contentType: string) {
  const bucket = getBucket();
  const uploadStream = bucket.openUploadStream(remoteName, {
    contentType,
    metadata: {
      sourcePath: localPath,
    },
  });

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(localPath)
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => resolve());
  });

  return {
    fileId: uploadStream.id.toString(),
    filename: remoteName,
    contentType,
    url: `/api/media/${uploadStream.id.toString()}`,
  } satisfies StoredAssetRef;
}

export async function readGridFSFile(fileId: string) {
  const bucket = getBucket();
  const objectId = new ObjectId(fileId);
  const fileDoc = await mongoose.connection.db?.collection('videoauto_media.files').findOne({ _id: objectId });
  if (!fileDoc) {
    throw new Error('Stored media file not found');
  }

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    bucket.openDownloadStream(objectId)
      .on('data', (chunk: Buffer) => chunks.push(chunk))
      .on('error', reject)
      .on('end', () => resolve());
  });

  return {
    buffer: Buffer.concat(chunks),
    contentType: typeof fileDoc.contentType === 'string' ? fileDoc.contentType : 'application/octet-stream',
    filename: typeof fileDoc.filename === 'string' ? fileDoc.filename : path.basename(fileId),
  };
}
