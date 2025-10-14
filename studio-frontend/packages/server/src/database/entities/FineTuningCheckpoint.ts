import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm'

@Entity('fine_tuning_checkpoint')
export class FineTuningCheckpoint {
    @PrimaryColumn()
    id!: string

    @Column()
    fine_tuning_job_id!: string

    @Column()
    filename!: string

    @Column({ type: 'text', nullable: true })
    metadata?: string

    @CreateDateColumn({ type: 'datetime' })
    createdDate!: Date
}
