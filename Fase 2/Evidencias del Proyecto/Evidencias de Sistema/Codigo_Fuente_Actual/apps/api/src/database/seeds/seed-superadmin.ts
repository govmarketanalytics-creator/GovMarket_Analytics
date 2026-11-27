import * as argon2 from 'argon2';
import { config } from 'dotenv';
import { z } from 'zod';
import { EstadoUsuario, Usuario } from '../../usuarios/entities/usuario.entity';
import AppDataSource from '../data-source';

config();

const seedSchema = z.object({
  SEED_ADMIN_EMAIL: z.string().trim().toLowerCase().email(),
  SEED_ADMIN_PASSWORD: z.string().min(12).max(128),
  SEED_ADMIN_NOMBRES: z.string().trim().min(1).max(120),
  SEED_ADMIN_APELLIDO_PATERNO: z.string().trim().min(1).max(80),
  SEED_ADMIN_APELLIDO_MATERNO: z.string().trim().max(80).optional(),
});

async function ejecutarSeed(): Promise<void> {
  const environment = seedSchema.parse(process.env);

  await AppDataSource.initialize();

  try {
    await AppDataSource.transaction(async (manager) => {
      const usuariosRepository = manager.getRepository(Usuario);

      const usuarioExistente = await usuariosRepository.findOne({
        where: { email: environment.SEED_ADMIN_EMAIL },
      });

      if (usuarioExistente) {
        console.log(
          `El usuario ${environment.SEED_ADMIN_EMAIL} ya existe. No se realizaron cambios.`,
        );
        return;
      }

      const passwordHash = await argon2.hash(environment.SEED_ADMIN_PASSWORD, {
        type: argon2.argon2id,
      });

      const usuario = usuariosRepository.create({
        email: environment.SEED_ADMIN_EMAIL,
        passwordHash,
        nombres: environment.SEED_ADMIN_NOMBRES,
        apellidoPaterno: environment.SEED_ADMIN_APELLIDO_PATERNO,
        apellidoMaterno: environment.SEED_ADMIN_APELLIDO_MATERNO || null,
        correoVerificado: true,
        esSuperadministrador: true,
        estado: EstadoUsuario.ACTIVO,
        ultimoAccesoEn: null,
      });

      await usuariosRepository.save(usuario);

      console.log(`Superadministrador creado correctamente: ${usuario.email}`);
    });
  } finally {
    await AppDataSource.destroy();
  }
}

void ejecutarSeed().catch((error: unknown) => {
  console.error('No fue posible crear el superadministrador.', error);
  process.exitCode = 1;
});
