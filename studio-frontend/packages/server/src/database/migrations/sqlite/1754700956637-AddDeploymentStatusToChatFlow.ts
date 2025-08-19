import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddDeploymentStatusToChatFlow1754700956637 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const deploymentStatusExists = await queryRunner.hasColumn('chat_flow', 'deploymentStatus')
        if (!deploymentStatusExists) {
            await queryRunner.query(`ALTER TABLE \`chat_flow\` ADD COLUMN \`deploymentStatus\` varchar(255) DEFAULT NULL;`)
        }

        const deploymentConfigExists = await queryRunner.hasColumn('chat_flow', 'deploymentConfig')
        if (!deploymentConfigExists) {
            await queryRunner.query(`ALTER TABLE \`chat_flow\` ADD COLUMN \`deploymentConfig\` TEXT DEFAULT NULL;`)
        }

        const deploymentLogsExists = await queryRunner.hasColumn('chat_flow', 'deploymentLogs')
        if (!deploymentLogsExists) {
            await queryRunner.query(`ALTER TABLE \`chat_flow\` ADD COLUMN \`deploymentLogs\` TEXT DEFAULT NULL;`)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`chat_flow\` DROP COLUMN \`deploymentStatus\`;`)
        await queryRunner.query(`ALTER TABLE \`chat_flow\` DROP COLUMN \`deploymentConfig\`;`)
        await queryRunner.query(`ALTER TABLE \`chat_flow\` DROP COLUMN \`deploymentLogs\`;`)
    }
}
