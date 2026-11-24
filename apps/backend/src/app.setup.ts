import { INestApplication } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { BetterAuth } from './shared/auth/providers/better-auth.provider';
import { Config } from './shared/config/config.service';

/**
 * Middleware and routing shared by the running app (main.ts) and the
 * integration tests, so the tests exercise the same HTTP stack as production.
 */
export const configureApp = (app: INestApplication): void => {
  const config = app.get(Config);

  // Configure CORS - Allows cross-origin requests from specific origins
  app.enableCors({
    origin: [config.backendUrl, config.frontendUrl],
    credentials: true,
  });

  // Setup cookie parser middleware
  app.use(cookieParser());

  const appInstance = app.getHttpAdapter().getInstance();
  const betterAuth = app.get<BetterAuth>('BetterAuth');
  // Express 5 (via NestJS 11) requires named wildcards — a bare `*` throws.
  appInstance.all('/api/auth/*splat', toNodeHandler(betterAuth));
  appInstance.use(express.json());

  // Configure API prefix for all routes
  app.setGlobalPrefix('api');
};
