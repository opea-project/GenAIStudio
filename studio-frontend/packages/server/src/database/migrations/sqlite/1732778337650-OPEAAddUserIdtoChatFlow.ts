import { MigrationInterface, QueryRunner } from "typeorm";

export class OPEAAddUserIdtoChatFlow1732778337650 implements MigrationInterface {
    name = 'OPEAAddUserIdtoChatFlow1732778337650'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "temporary_chat_flow" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "flowData" text NOT NULL, "deployed" boolean, "isPublic" boolean, "apikeyid" varchar, "chatbotConfig" text, "createdDate" datetime NOT NULL DEFAULT (datetime('now')), "updatedDate" datetime NOT NULL DEFAULT (datetime('now')), "sandboxStatus" text, "sandboxAppUrl" text, "sandboxGrafanaUrl" text, "apiConfig" text, "analytic" text, "category" text, "speechToText" text, "type" text, "userid" text)`);
        await queryRunner.query(`INSERT INTO "temporary_chat_flow"("id", "name", "flowData", "deployed", "isPublic", "apikeyid", "chatbotConfig", "createdDate", "updatedDate", "sandboxStatus", "sandboxAppUrl", "sandboxGrafanaUrl", "apiConfig", "analytic", "category", "speechToText", "type", "userid") SELECT "id", "name", "flowData", "deployed", "isPublic", "apikeyid", "chatbotConfig", "createdDate", "updatedDate", "sandboxStatus", "sandboxAppUrl", "sandboxGrafanaUrl", "apiConfig", "analytic", "category", "speechToText", "type", "userid" FROM "chat_flow"`);
        await queryRunner.query(`DROP TABLE "chat_flow"`);
        await queryRunner.query(`ALTER TABLE "temporary_chat_flow" RENAME TO "chat_flow"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_flow" RENAME TO "temporary_chat_flow"`);
        await queryRunner.query(`CREATE TABLE "chat_flow" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "flowData" text NOT NULL, "deployed" text, "isPublic" boolean, "apikeyid" varchar, "chatbotConfig" text, "createdDate" datetime NOT NULL DEFAULT (datetime('now')), "updatedDate" datetime NOT NULL DEFAULT (datetime('now')), "sandboxStatus" text, "sandboxAppUrl" text, "sandboxGrafanaUrl" text, "apiConfig" text, "analytic" text, "category" text, "speechToText" text, "type" text, "userid" varchar NOT NULL)`);
        await queryRunner.query(`INSERT INTO "chat_flow"("id", "name", "flowData", "deployed", "isPublic", "apikeyid", "chatbotConfig", "createdDate", "updatedDate", "sandboxStatus", "sandboxAppUrl", "sandboxGrafanaUrl", "apiConfig", "analytic", "category", "speechToText", "type", "userid") SELECT "id", "name", "flowData", "deployed", "isPublic", "apikeyid", "chatbotConfig", "createdDate", "updatedDate", "sandboxStatus", "sandboxAppUrl", "sandboxGrafanaUrl", "apiConfig", "analytic", "category", "speechToText", "type", "userid" FROM "temporary_chat_flow"`);
        await queryRunner.query(`DROP TABLE "temporary_chat_flow"`);
    }

}
