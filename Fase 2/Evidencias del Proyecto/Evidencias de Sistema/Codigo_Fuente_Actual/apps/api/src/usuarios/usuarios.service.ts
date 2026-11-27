import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstadoUsuario, Usuario } from './entities/usuario.entity';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepository: Repository<Usuario>,
  ) {}

  async buscarPorEmailParaAutenticacion(
    email: string,
  ): Promise<Usuario | null> {
    const emailNormalizado = email.trim().toLowerCase();

    return this.usuariosRepository
      .createQueryBuilder('usuario')
      .addSelect('usuario.passwordHash')
      .where('usuario.email = :email', { email: emailNormalizado })
      .getOne();
  }

  async buscarPorIdParaAutenticacion(id: string): Promise<Usuario | null> {
    return this.usuariosRepository
      .createQueryBuilder('usuario')
      .addSelect('usuario.passwordHash')
      .where('usuario.id = :id', { id })
      .getOne();
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    return this.usuariosRepository.findOne({ where: { id } });
  }

  async registrarConPassword(datos: {
    email: string;
    passwordHash: string;
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string | null;
  }): Promise<Usuario> {
    // Lista explícita: el registro público nunca recibe roles ni membresías.
    // save + UQ_usuarios_email rechazan también los duplicados concurrentes.
    const usuario = this.usuariosRepository.create({
      email: datos.email.trim().toLowerCase(),
      passwordHash: datos.passwordHash,
      googleSub: null,
      nombres: datos.nombres,
      apellidoPaterno: datos.apellidoPaterno,
      apellidoMaterno: datos.apellidoMaterno,
      correoVerificado: false,
      esSuperadministrador: false,
      estado: EstadoUsuario.ACTIVO,
    });
    return this.usuariosRepository.save(usuario);
  }

  async buscarPorGoogleSub(googleSub: string): Promise<Usuario | null> {
    return this.usuariosRepository
      .createQueryBuilder('usuario')
      .addSelect('usuario.googleSub')
      .where('usuario.googleSub = :googleSub', { googleSub })
      .getOne();
  }

  async buscarPorEmailConGoogleSub(email: string): Promise<Usuario | null> {
    return this.usuariosRepository
      .createQueryBuilder('usuario')
      .addSelect('usuario.googleSub')
      .where('usuario.email = :email', { email: email.trim().toLowerCase() })
      .getOne();
  }

  async vincularGoogle(id: string, googleSub: string): Promise<boolean> {
    const resultado = await this.usuariosRepository
      .createQueryBuilder()
      .update(Usuario)
      .set({ googleSub })
      .where('id = :id', { id })
      .andWhere('google_sub IS NULL')
      .execute();

    return resultado.affected === 1;
  }

  async registrarGmailSiNoExiste(datos: {
    email: string;
    googleSub: string;
    nombres: string;
    apellidoPaterno: string;
  }): Promise<Usuario | null> {
    await this.usuariosRepository
      .createQueryBuilder()
      .insert()
      .into(Usuario)
      .values({
        email: datos.email,
        googleSub: datos.googleSub,
        passwordHash: null,
        nombres: datos.nombres,
        apellidoPaterno: datos.apellidoPaterno,
        apellidoMaterno: null,
        correoVerificado: true,
        esSuperadministrador: false,
      })
      .orIgnore()
      .execute();

    // ON CONFLICT DO NOTHING permite que dos accesos simultáneos reutilicen
    // la misma identidad sin duplicarla ni conceder acceso a otra empresa.
    return (
      (await this.buscarPorGoogleSub(datos.googleSub)) ??
      (await this.buscarPorEmailConGoogleSub(datos.email))
    );
  }

  async actualizarPerfil(
  id: string,
  datos: {
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string | null;
  },
): Promise<void> {
await this.usuariosRepository.update(
  { id },
  {
    nombres: datos.nombres,
    apellidoPaterno: datos.apellidoPaterno,
    apellidoMaterno: datos.apellidoMaterno,
  },
);

}



  async actualizarPasswordHash(
    id: string,
    passwordHash: string,
  ): Promise<void> {
    await this.usuariosRepository.update({ id }, { passwordHash });
  }
}
