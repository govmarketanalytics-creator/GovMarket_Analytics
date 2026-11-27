import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  esSuperadministrador: boolean;
  iat: number;
  exp: number;
  iss: string;
  aud: string | string[];
}

export interface RequestConUsuario extends Request {
  user: JwtPayload;
}
