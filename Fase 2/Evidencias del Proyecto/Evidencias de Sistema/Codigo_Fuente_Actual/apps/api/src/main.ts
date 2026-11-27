import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    routeConflictPolicy: {
      duplicate: 'error',
      shadow: 'warn',
    },
    routeResolutionStrategy: 'specificity',
  });

  const configService = app.get(ConfigService);

  configureApp(app);

  await app.listen(configService.getOrThrow<number>('PORT'));
}

void bootstrap();
