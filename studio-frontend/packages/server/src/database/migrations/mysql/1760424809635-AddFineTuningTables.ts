import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddFineTuningTables1760424809635 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS fine_tuning_job (
                id varchar(255) PRIMARY KEY NOT NULL,
                name varchar(255),
                model varchar(255),
                task varchar(255),
                status varchar(255),
                training_file varchar(255),
                training_file_id varchar(255),
                lora_config longtext,
                hyperparameters longtext,
                result_files longtext,
                error longtext,
                progress int,
                trained_tokens int,
                estimated_finish datetime,
                finishedDate datetime,
                createdDate datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedDate datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
            `
        )

        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS fine_tuning_checkpoint (
                id varchar(255) PRIMARY KEY NOT NULL,
                fine_tuning_job_id varchar(255) NOT NULL,
                filename varchar(255) NOT NULL,
                metadata longtext,
                createdDate datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX IDX_fine_tuning_checkpoint_job (fine_tuning_job_id)
            ) ENGINE=InnoDB;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS fine_tuning_checkpoint`)
        await queryRunner.query(`DROP TABLE IF EXISTS fine_tuning_job`)
    }
}
