import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm'

@Entity('fine_tuning_job')
export class FineTuningJob {
    @PrimaryColumn()
    id!: string

    @Column({ nullable: true })
    model?: string

    @Column({ nullable: true })
    task?: string

    @Column({ nullable: true })
    status?: string

    @Column({ nullable: true })
    training_file?: string

    @Column({ type: 'text', nullable: true })
    hyperparameters?: string

    @Column({ type: 'text', nullable: true })
    result_files?: string

    @Column({ type: 'text', nullable: true })
    error?: string

    @Column({ nullable: true, type: 'int' })
    trained_tokens?: number

    @CreateDateColumn({ type: 'datetime' })
    createdDate!: Date
}
