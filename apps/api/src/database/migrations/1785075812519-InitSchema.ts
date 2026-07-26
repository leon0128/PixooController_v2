import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1785075812519 implements MigrationInterface {
    name = 'InitSchema1785075812519'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "scene_elements" ("id" SERIAL NOT NULL, "scene_id" integer NOT NULL, "type" character varying(32) NOT NULL, "x" integer NOT NULL, "y" integer NOT NULL, "dir" integer NOT NULL, "font" integer NOT NULL, "text_width" integer NOT NULL, "text_height" integer NOT NULL, "speed" integer NOT NULL, "color" character varying(7) NOT NULL, "update_time" integer NOT NULL, "align" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d35827ff87a7ddbe79109185566" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "scene_image_details" ("id" SERIAL NOT NULL, "scene_image_id" integer NOT NULL, "frame_index" integer NOT NULL, "image_data" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_1785a92502918bd6db25358efbd" UNIQUE ("scene_image_id", "frame_index"), CONSTRAINT "PK_8c9c6329317a68a09c6320312d2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "scene_images" ("id" SERIAL NOT NULL, "scene_id" integer NOT NULL, "pic_speed" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_cdcd835274e015f39a7a81a765" UNIQUE ("scene_id"), CONSTRAINT "PK_36a8f5a663d703e036e891cba86" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "scenes" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_071fd0f410cbb449feebafd46ac" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "schedules" ("id" SERIAL NOT NULL, "day_of_week" smallint NOT NULL, "slot" smallint NOT NULL, "scene_id" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_00e6dbfba91e6731fad7c551bc3" UNIQUE ("day_of_week", "slot"), CONSTRAINT "CHK_643b2c9ccc6367f2bf1d493382" CHECK ("slot" BETWEEN 0 AND 143), CONSTRAINT "CHK_cf8b97bf61b0ba08474a817d1b" CHECK ("day_of_week" BETWEEN 0 AND 6), CONSTRAINT "PK_7e33fc2ea755a5765e3564e66dd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "scene_elements" ADD CONSTRAINT "FK_e188ea358456868bed445977e73" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "scene_image_details" ADD CONSTRAINT "FK_bef244beac5e304e04bd1fc3728" FOREIGN KEY ("scene_image_id") REFERENCES "scene_images"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "scene_images" ADD CONSTRAINT "FK_cdcd835274e015f39a7a81a7650" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "schedules" ADD CONSTRAINT "FK_cd3053b437910f81a2f44c4038a" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "schedules" DROP CONSTRAINT "FK_cd3053b437910f81a2f44c4038a"`);
        await queryRunner.query(`ALTER TABLE "scene_images" DROP CONSTRAINT "FK_cdcd835274e015f39a7a81a7650"`);
        await queryRunner.query(`ALTER TABLE "scene_image_details" DROP CONSTRAINT "FK_bef244beac5e304e04bd1fc3728"`);
        await queryRunner.query(`ALTER TABLE "scene_elements" DROP CONSTRAINT "FK_e188ea358456868bed445977e73"`);
        await queryRunner.query(`DROP TABLE "schedules"`);
        await queryRunner.query(`DROP TABLE "scenes"`);
        await queryRunner.query(`DROP TABLE "scene_images"`);
        await queryRunner.query(`DROP TABLE "scene_image_details"`);
        await queryRunner.query(`DROP TABLE "scene_elements"`);
    }

}
