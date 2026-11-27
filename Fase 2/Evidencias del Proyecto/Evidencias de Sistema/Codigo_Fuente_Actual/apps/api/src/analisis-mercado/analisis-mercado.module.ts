import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MembresiasModule } from "../membresias/membresias.module";
import { PlanesEmpresaModule } from "../planes-empresa/planes-empresa.module";
import { AnalisisMercadoController } from "./analisis-mercado.controller";
import { AnalisisMercadoService } from "./analisis-mercado.service";
import { NoticiasMercadoService } from "./noticias-mercado.service";

@Module({
  imports: [AuthModule, MembresiasModule, PlanesEmpresaModule],
  controllers: [AnalisisMercadoController],
  providers: [AnalisisMercadoService, NoticiasMercadoService],
})
export class AnalisisMercadoModule {}
