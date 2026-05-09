import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly messaging: admin.messaging.Messaging | null = null;

  constructor(config: ConfigService) {
    const serviceAccount = config.get<string>('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccount) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled');
      return;
    }

    try {
      const parsed = JSON.parse(serviceAccount);
      if (!admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.cert(parsed) });
      }
      this.messaging = admin.messaging();
    } catch (err) {
      this.logger.error('Failed to initialize Firebase Admin', err);
    }
  }

  async sendToTokens(tokens: string[], title: string, body: string, data?: Record<string, string>) {
    if (!this.messaging || tokens.length === 0) return;

    const chunks = this.chunk(tokens, 500);
    for (const batch of chunks) {
      try {
        const response = await this.messaging.sendEachForMulticast({
          tokens: batch,
          notification: { title, body },
          data,
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        });

        const failedTokens = response.responses
          .map((r, i) => (!r.success ? batch[i] : null))
          .filter((t): t is string => t !== null);

        if (failedTokens.length > 0) {
          this.logger.warn(`${failedTokens.length} push tokens failed delivery`);
        }
      } catch (err) {
        this.logger.error('Error sending push batch', err);
      }
    }
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }
}
