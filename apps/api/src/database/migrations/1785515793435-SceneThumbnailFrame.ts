import { MigrationInterface, QueryRunner } from "typeorm";

export class SceneThumbnailFrame1785515793435 implements MigrationInterface {
    name = 'SceneThumbnailFrame1785515793435'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "scene_images" ADD "thumbnail_frame_index" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "scene_images" DROP COLUMN "thumbnail_frame_index"`);
    }

}
