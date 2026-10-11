import { DataSource, DataSourceOptions } from 'typeorm';
import { dropBoardGroupTriggers } from './board-group-constraints.service';

/**
 * Открывает `DataSource` и синхронизирует схему вручную, вместо того чтобы
 * доверить это `synchronize: true` внутри `DataSource.initialize()`.
 * Между открытием соединения и синхронизацией снимает триггеры
 * {@link dropBoardGroupTriggers} — иначе SQLite ревалидирует их при
 * пересборке `board_groups`/`tasks` и падает с `no such table`, если тело
 * триггера в этот момент ссылается на другую из этих таблиц. Только для
 * режима запуска с синхронизацией схемы — не поддерживает
 * `synchronize: false`.
 */
export async function initializeWithSchemaSync(
  options: DataSourceOptions,
): Promise<DataSource> {
  const dataSource = new DataSource({ ...options, synchronize: false });
  await dataSource.initialize();
  await dropBoardGroupTriggers(dataSource);
  await dataSource.synchronize();
  return dataSource;
}
