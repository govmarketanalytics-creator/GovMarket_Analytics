import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { environmentSchema } from '../config/environment.schema';

config();

const environment = environmentSchema.parse(process.env);

const AppDataSource = new DataSource({
  type: 'postgres',
  host: environment.DB_HOST,
  port: environment.DB_PORT,
  username: environment.DB_USERNAME,
  password: environment.DB_PASSWORD,
  database: environment.DB_NAME,
  ssl: environment.DB_SSL,

  synchronize: false,
  logging: false,

  entities: [__dirname + '/../**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  migrationsTableName: 'migrations',
});

export default AppDataSource;
