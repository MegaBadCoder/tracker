import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      const req = { headers: {} } as unknown as Request;
      expect(appController.getHello(req)).toBe('Hello World!');
    });
  });
});
