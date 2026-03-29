import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSubscription } from '../../shared/entities/push-subscription.entity';
import { SubscribePushDto } from './dto/subscribe-push.dto';

@Injectable()
export class PushSubscriptionService {
  constructor(
    @InjectRepository(PushSubscription)
    private readonly repo: Repository<PushSubscription>,
  ) {}

  async subscribe(
    userId: number,
    dto: SubscribePushDto,
  ): Promise<PushSubscription> {
    const existing = await this.repo.findOne({
      where: { endpoint: dto.endpoint },
    });

    if (existing) {
      existing.userId = userId;
      existing.p256dh = dto.p256dh;
      existing.auth = dto.auth;
      return this.repo.save(existing);
    }

    const sub = this.repo.create({
      userId,
      endpoint: dto.endpoint,
      p256dh: dto.p256dh,
      auth: dto.auth,
    });
    return this.repo.save(sub);
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.repo.delete({ endpoint });
  }

  async findByUserId(userId: number): Promise<PushSubscription[]> {
    return this.repo.find({ where: { userId } });
  }

  async removeByEndpoint(endpoint: string): Promise<void> {
    await this.repo.delete({ endpoint });
  }
}
