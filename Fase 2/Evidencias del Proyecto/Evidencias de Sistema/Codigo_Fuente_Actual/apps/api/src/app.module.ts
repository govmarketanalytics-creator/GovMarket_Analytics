import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';
import { AlertasModule } from './alertas/alertas.module';
import { AnalisisMercadoModule } from './analisis-mercado/analisis-mercado.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AutomatizacionModule } from './automatizacion/automatizacion.module';
import { environmentSchema } from './config/environment.schema';
import { EmpresasModule } from './empresas/empresas.module';
import { FavoritosModule } from './favoritos/favoritos.module';
import { HealthModule } from './health/health.module';
import { MercadoPublicoModule } from './integraciones/mercado-publico/mercado-publico.module';
import { LicitacionesModule } from './licitaciones/licitaciones.module';
import { MembresiasModule } from './membresias/membresias.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { OportunidadesModule } from './oportunidades/oportunidades.module';
import { PagosModule } from './pagos/pagos.module';
import { PerfilesEmpresaModule } from './perfiles-empresa/perfiles-empresa.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: environmentSchema,
    }),

    ScheduleModule.forRoot(),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.getOrThrow<string>('DB_HOST'),
        port: configService.getOrThrow<number>('DB_PORT'),
        username: configService.getOrThrow<string>('DB_USERNAME'),
        password: configService.getOrThrow<string>('DB_PASSWORD'),
        database: configService.getOrThrow<string>('DB_NAME'),
        ssl: configService.getOrThrow<boolean>('DB_SSL'),
        autoLoadEntities: true,
        synchronize: false,
        retryAttempts: 3,
        retryDelay: 1000,
      }),
    }),

    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'web', 'dist'),
      exclude: ['/api/{*path}'],
    }),

    HealthModule,
    EmpresasModule,
    UsuariosModule,
    MembresiasModule,
    OnboardingModule,
    AuthModule,
    MercadoPublicoModule,
    LicitacionesModule,
    FavoritosModule,
    PerfilesEmpresaModule,
    AnalisisMercadoModule,
    OportunidadesModule,
    PagosModule,
    NotificacionesModule,
    AlertasModule,
    AutomatizacionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
