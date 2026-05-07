import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { extname } from 'path';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor(config: ConfigService) {
    this.endpoint = config.getOrThrow('S3_ENDPOINT');
    this.bucket = config.getOrThrow('S3_BUCKET');

    this.client = new S3Client({
      endpoint: this.endpoint,
      region: config.get('S3_REGION') ?? 'auto',
      credentials: {
        accessKeyId: config.getOrThrow('S3_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow('S3_SECRET_ACCESS_KEY'),
      },
      forcePathStyle: true,
    });
  }

  async uploadProfileImage(userId: string, file: Express.Multer.File): Promise<string> {
    const ext = extname(file.originalname).toLowerCase() || '.jpg';
    const key = `users-service/profile-images/${userId}/profile${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'public, max-age=31536000',
      }),
    );

    return `${this.endpoint}/${this.bucket}/${key}`;
  }

  async deleteProfileImage(userId: string): Promise<void> {
    for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
      const key = `users-service/profile-images/${userId}/profile${ext}`;
      await this.client
        .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
        .catch(() => null);
    }
  }
}
