import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

/**
 * Shared by the running app (via AppModule) and the TypeORM CLI, so migrations are
 * always generated against the same schema the app uses.
 */
export const dataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  // Entities stay camelCase in TypeScript; the database stays snake_case.
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
} satisfies DataSourceOptions;

export default new DataSource(dataSourceOptions);
