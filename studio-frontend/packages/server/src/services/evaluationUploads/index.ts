import path from 'path'

type DatasetEntryPayload = {
    input: string
    expected_output?: string
    context?: string[]
}

type DatasetCreatePayload = {
    name: string
    description?: string
    entries: DatasetEntryPayload[]
}

const DATASET_FILE_TYPES = new Set(['.json', '.jsonl'])
const DATASET_INPUT_KEYS = ['input', 'question', 'prompt', 'query']
const DATASET_EXPECTED_KEYS = ['expected_output', 'expectedOutput', 'expected', 'answer', 'ground_truth', 'groundTruth']
const DATASET_CONTEXT_KEYS = ['context', 'contexts', 'retrieval_context', 'retrievalContexts', 'reference_context']

const getStringField = (value: unknown): string => {
    if (typeof value !== 'string') return ''
    return value.trim()
}

const deriveNameFromFilename = (filename: string): string => path.basename(filename, path.extname(filename)).trim()

const getExtension = (filename: string): string => path.extname(filename || '').toLowerCase()

const normalizeWhitespace = (value: string): string => value.replace(/\r\n/g, '\n').replace(/\uFEFF/g, '').trim()

const getFirstNonEmptyValue = (record: Record<string, unknown>, keys: string[]): string => {
    for (const key of keys) {
        const value = record[key]
        if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return ''
}

const normalizeContext = (value: unknown): string[] | undefined => {
    if (value == null) return undefined

    if (Array.isArray(value)) {
        const normalized = value
            .map((item) => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
            .filter(Boolean)
        return normalized.length ? normalized : undefined
    }

    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!trimmed) return undefined

        try {
            const parsed = JSON.parse(trimmed)
            if (Array.isArray(parsed)) return normalizeContext(parsed)
        } catch {
            return [trimmed]
        }

        return [trimmed]
    }

    return [String(value).trim()].filter(Boolean)
}

const ensureDatasetExtension = (filename: string) => {
    const extension = getExtension(filename)
    if (!DATASET_FILE_TYPES.has(extension)) {
        throw new Error('Dataset upload must be a .json or .jsonl file.')
    }
    return extension
}

const normalizeDatasetEntry = (item: unknown, index: number): DatasetEntryPayload => {
    if (typeof item === 'string') {
        const input = item.trim()
        if (!input) throw new Error(`Dataset entry ${index + 1} is empty.`)
        return { input }
    }

    if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(`Dataset entry ${index + 1} must be a JSON object.`)
    }

    const record = item as Record<string, unknown>
    const input = getFirstNonEmptyValue(record, DATASET_INPUT_KEYS)
    if (!input) {
        throw new Error(`Dataset entry ${index + 1} is missing an input field.`)
    }

    const expectedOutput = getFirstNonEmptyValue(record, DATASET_EXPECTED_KEYS)
    let context: string[] | undefined
    for (const key of DATASET_CONTEXT_KEYS) {
        context = normalizeContext(record[key])
        if (context?.length) break
    }

    return {
        input,
        ...(expectedOutput ? { expected_output: expectedOutput } : {}),
        ...(context?.length ? { context } : {})
    }
}

const parseJsonDatasetEntries = (rawText: string): { name?: string; description?: string; entries: DatasetEntryPayload[] } => {
    const parsed = JSON.parse(rawText)
    const topLevel = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null

    let rawEntries: unknown[] = []
    if (Array.isArray(parsed)) {
        rawEntries = parsed
    } else if (topLevel && Array.isArray(topLevel.entries)) {
        rawEntries = topLevel.entries
    } else if (topLevel && Array.isArray(topLevel.items)) {
        rawEntries = topLevel.items
    } else if (topLevel && Array.isArray(topLevel.data)) {
        rawEntries = topLevel.data
    } else if (topLevel) {
        rawEntries = [topLevel]
    }

    if (!rawEntries.length) {
        throw new Error('Dataset file does not contain any entries.')
    }

    return {
        name: topLevel ? getStringField(topLevel.name) || undefined : undefined,
        description: topLevel ? getStringField(topLevel.description) || undefined : undefined,
        entries: rawEntries.map((entry, index) => normalizeDatasetEntry(entry, index))
    }
}

const parseJsonlDatasetEntries = (rawText: string): DatasetEntryPayload[] => {
    const lines = rawText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

    if (!lines.length) {
        throw new Error('Dataset JSONL file is empty.')
    }

    return lines.map((line, index) => {
        try {
            return normalizeDatasetEntry(JSON.parse(line), index)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Invalid JSONL entry.'
            throw new Error(`Invalid JSONL on line ${index + 1}: ${message}`)
        }
    })
}

export const parseDatasetUpload = (file: Express.Multer.File, fields: Record<string, unknown>): DatasetCreatePayload => {
    const extension = ensureDatasetExtension(file.originalname)
    const rawText = normalizeWhitespace(file.buffer.toString('utf8'))
    if (!rawText) {
        throw new Error('Uploaded dataset file is empty.')
    }

    const parsed = extension === '.jsonl' ? { entries: parseJsonlDatasetEntries(rawText) } : parseJsonDatasetEntries(rawText)
    const name = getStringField(fields.name) || parsed.name || deriveNameFromFilename(file.originalname)
    if (!name) {
        throw new Error('Dataset name is required.')
    }

    const description = getStringField(fields.description) || parsed.description

    return {
        name,
        ...(description ? { description } : {}),
        entries: parsed.entries
    }
}