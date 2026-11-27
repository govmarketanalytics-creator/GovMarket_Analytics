import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  async check() {
    const timestamp = new Date().toISOString();

    try {
      await this.dataSource.query('SELECT 1');

      return {
        status: 'ok',
        service: 'govmarket-analytics-api',
        database: 'connected',
        timestamp,
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'govmarket-analytics-api',
        database: 'disconnected',
        timestamp,
      });
    }
  }
}
