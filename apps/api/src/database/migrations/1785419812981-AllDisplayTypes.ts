import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Opens scene elements up to every display type Draw/SendHttpItemList supports.
 *
 * Two things change. `text` arrives to carry TextString, which the `text` and
 * `url_text` types need and no other type uses. And the six original type names are
 * renamed onto Divoom's own vocabulary, now that all 23 are available:
 *
 *   date_separator was mapped to item type 22, which is not a date separator at all
 *   but an arbitrary text message. Those rows become `text` carrying the ':' they
 *   were previously rendering through a hardcoded TextString.
 */
const RENAMES: [from: string, to: string][] = [
  ['date_month', 'month'],
  ['date_day', 'day'],
  ['day_of_week', 'weekday_medium'],
  ['time', 'hour_minute'],
  ['date_separator', 'text'],
];

export class AllDisplayTypes1785419812981 implements MigrationInterface {
  name = 'AllDisplayTypes1785419812981';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scene_elements" ADD "text" character varying(512)`,
    );

    for (const [from, to] of RENAMES) {
      await queryRunner.query(
        `UPDATE "scene_elements" SET "type" = $1 WHERE "type" = $2`,
        [to, from],
      );
    }

    // The separator rows displayed a colon through a hardcoded TextString; as plain
    // text elements they have to carry it themselves.
    await queryRunner.query(
      `UPDATE "scene_elements" SET "text" = ':' WHERE "type" = 'text' AND "text" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of RENAMES) {
      await queryRunner.query(
        `UPDATE "scene_elements" SET "type" = $1 WHERE "type" = $2`,
        [from, to],
      );
    }
    await queryRunner.query(`ALTER TABLE "scene_elements" DROP COLUMN "text"`);
  }
}
