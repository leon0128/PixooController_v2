import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLES = [
  'scenes',
  'scene_images',
  'scene_image_details',
  'scene_elements',
  'schedules',
];
const COLUMNS = ['created_at', 'updated_at'];

/**
 * Moves the audit timestamps to `timestamptz`.
 *
 * As plain `timestamp` the values carried no zone, so the driver read them back in
 * the API container's timezone (Asia/Tokyo) even though Postgres had written them
 * in UTC — every createdAt/updatedAt came out of the API nine hours off.
 *
 * The generated migration dropped and re-added the columns, discarding the values.
 * Converting in place with an explicit `AT TIME ZONE 'UTC'` keeps them and states
 * the assumption the old values were written under.
 */
export class TimestampsWithTimeZone1785246809465 implements MigrationInterface {
  name = 'TimestampsWithTimeZone1785246809465';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      for (const column of COLUMNS) {
        await queryRunner.query(
          `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE TIMESTAMP WITH TIME ZONE USING "${column}" AT TIME ZONE 'UTC'`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      for (const column of COLUMNS) {
        await queryRunner.query(
          `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE TIMESTAMP USING "${column}" AT TIME ZONE 'UTC'`,
        );
      }
    }
  }
}
