import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSandboxDebugLogsUrlToChatFlow1749612373191 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const columnExists = await queryRunner.hasColumn('chat_flow', 'sandboxDebugLogsUrl')
        if (!columnExists) queryRunner.query(`ALTER TABLE \`chat_flow\` ADD COLUMN \`sandboxDebugLogsUrl\` varchar(255) DEFAULT NULL;`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`chat_flow\` DROP COLUMN \`sandboxDebugLogsUrl\`;`)
    }
}
