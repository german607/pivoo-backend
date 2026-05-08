import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { extname } from 'path';

@Injectable()
export class StorageService {
  private readonly client: S3Client | undefined;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    this.endpoint = config.get('AWS_ENDPOINT_URL') ?? '';
    this.bucket = config.get('AWS_S3_BUCKET_NAME') ?? '';

    const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');

    // Public URL for reading — can be a CDN/proxy in front of the bucket.
    // Falls back to the direct endpoint path if not set.
    this.publicBaseUrl =
      config.get('AWS_PUBLIC_URL') ?? `${this.endpoint}/${this.bucket}`;

    if (accessKeyId && secretAccessKey && this.endpoint && this.bucket) {
      this.client = new S3Client({
        endpoint: this.endpoint,
        region: config.get('AWS_DEFAULT_REGION') ?? 'auto',
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
      });
    }
  }

  async uploadProfileImage(userId: string, file: Express.Multer.File): Promise<string> {
    if (!this.client) throw new InternalServerErrorException('S3 storage is not configured');
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

    return `${this.publicBaseUrl}/${key}`;
  }

  async deleteProfileImage(userId: string): Promise<void> {
    if (!this.client) return;
    for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
      const key = `users-service/profile-images/${userId}/profile${ext}`;
      await this.client
        .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
        .catch(() => null);
    }
  }
}
