import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('fine_tuning_job')
export class FineTuningJob {
    @PrimaryColumn()
    id!: string

    @Column({ nullable: true })
    name?: string

    @Column({ nullable: true })
    model?: string

    @Column({ nullable: true })
    task?: string

    @Column({ nullable: true })
    status?: string

    @Column({ nullable: true })
    training_file?: string

    @Column({ nullable: true })
    training_file_id?: string

    @Column({ type: 'text', nullable: true })
    lora_config?: string

    @Column({ type: 'text', nullable: true })
    hyperparameters?: string

    @Column({ type: 'text', nullable: true })
    result_files?: string

    @Column({ type: 'text', nullable: true })
    error?: string

    @Column({ nullable: true, type: 'int' })
    progress?: number

    @Column({ nullable: true, type: 'int' })
    trained_tokens?: number

    @Column({ nullable: true, type: 'datetime' })
    estimated_finish?: Date

    @Column({ nullable: true, type: 'datetime' })
    finishedDate?: Date

    @CreateDateColumn({ type: 'datetime' })
    createdDate!: Date

    @UpdateDateColumn({ type: 'datetime' })
    updatedDate!: Date
}
