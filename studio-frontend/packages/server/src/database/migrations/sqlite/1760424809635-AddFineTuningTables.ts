import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddFineTuningTables1760424809635 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "fine_tuning_job" (
                "id" varchar PRIMARY KEY NOT NULL,
                "name" varchar,
                "model" varchar,
                "task" varchar,
                "status" varchar,
                "training_file" varchar,
                "training_file_id" varchar,
                "lora_config" text,
                "hyperparameters" text,
                "result_files" text,
                "error" text,
                "progress" integer,
                "trained_tokens" integer,
                "estimated_finish" datetime,
                "finishedDate" datetime,
                "createdDate" datetime NOT NULL DEFAULT (datetime('now')),
                "updatedDate" datetime NOT NULL DEFAULT (datetime('now'))
            );`
        )

        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "fine_tuning_checkpoint" (
                "id" varchar PRIMARY KEY NOT NULL,
                "fine_tuning_job_id" varchar NOT NULL,
                "filename" varchar NOT NULL,
                "metadata" text,
                "createdDate" datetime NOT NULL DEFAULT (datetime('now'))
            );`
        )

        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_fine_tuning_checkpoint_job" ON "fine_tuning_checkpoint" ("fine_tuning_job_id") ;`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS fine_tuning_checkpoint`)
        await queryRunner.query(`DROP TABLE IF EXISTS fine_tuning_job`)
    }
}
