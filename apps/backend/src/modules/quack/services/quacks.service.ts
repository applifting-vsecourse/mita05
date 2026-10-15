import {
  parseSearchTerms,
  Quack,
  QuackMood,
} from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class QuacksService {
  constructor(private readonly quackRepository: QuackRepository) {}

  async getQuacks(viewer: Identity, search?: string): Promise<Quack[]> {
    return this.quackRepository.getQuacks(viewer.id, parseSearchTerms(search));
  }

  async createQuack(
    user: Identity,
    quackData: {
      text: string;
      mood?: QuackMood;
      poll?: { options: string[] };
    },
  ): Promise<Quack> {
    return this.quackRepository.createQuack({
      text: quackData.text,
      mood: quackData.mood ?? null,
      pollOptions: quackData.poll?.options ?? null,
      // the author is taken from the session, never from the request body
      userId: user.id,
    });
  }
}
