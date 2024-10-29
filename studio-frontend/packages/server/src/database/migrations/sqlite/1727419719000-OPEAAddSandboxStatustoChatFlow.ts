import { MigrationInterface, QueryRunner } from 'typeorm'

export class OPEAAddSandboxStatustoChatFlow1727419719000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const columnExists = await queryRunner.hasColumn('chat_flow', 'sandboxStatus')
        if (!columnExists) await queryRunner.query(`ALTER TABLE "chat_flow"    
            ADD COLUMN "sandboxStatus" TEXT, 
            ADD COLUMN "sandboxAppUrl" TEXT,
            ADD COLUMN "sandboxGrafanaUrl" TEXT;`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_flow" 
            DROP COLUMN "sandboxStatus",
            DROP COLUMN "sandboxAppUrl,
            DROP COLUMN "sandboxGrafanaUrl";`)
    }
}
