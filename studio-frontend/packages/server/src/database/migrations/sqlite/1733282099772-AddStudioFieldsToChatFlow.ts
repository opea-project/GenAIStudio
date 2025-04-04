import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddStudioFieldsToChatFlow1733282099772 implements MigrationInterface {
    additionalColumns = ['userid', 'sandboxStatus', 'sandboxAppUrl', 'sandboxGrafanaUrl']

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (let column of this.additionalColumns) {
            let columnExists = await queryRunner.hasColumn('chat_flow', column)
            if (!columnExists) {
                await queryRunner.query(`ALTER TABLE \`chat_flow\` ADD COLUMN \`${column}\` varchar(255) DEFAULT NULL;`)
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (let column of this.additionalColumns) {
            await queryRunner.query(`ALTER TABLE \`chat_flow\` DROP COLUMN \`${column}\`;`)
        }
    }
}
