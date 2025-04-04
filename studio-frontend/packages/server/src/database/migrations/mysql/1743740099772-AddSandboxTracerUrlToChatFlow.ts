import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSandboxTracerUrlToChatFlow1743740099772 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const columnExists = await queryRunner.hasColumn('chat_flow', 'sandboxTracerUrl')
        if (!columnExists) queryRunner.query(`ALTER TABLE \`chat_flow\` ADD COLUMN \`sandboxTracerUrl\` varchar(255) DEFAULT NULL;`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`chat_flow\` DROP COLUMN \`sandboxTracerUrl\`;`)
    }
}
