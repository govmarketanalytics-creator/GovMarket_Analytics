import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SuperadministradorGuard } from './guards/superadministrador.guard';
import { opcionesFirmaJwt, secretoJwt } from './opciones-jwt';

@Module({
  imports: [
    ConfigModule,
    UsuariosModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const issuer = configService.getOrThrow<string>('JWT_ISSUER');
        const audience = configService.getOrThrow<string>('JWT_AUDIENCE');

        return {
          secret: secretoJwt(configService),
          signOptions: opcionesFirmaJwt(configService),
          verifyOptions: {
            issuer,
            audience,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, SuperadministradorGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard, SuperadministradorGuard],
})
export class AuthModule {}
