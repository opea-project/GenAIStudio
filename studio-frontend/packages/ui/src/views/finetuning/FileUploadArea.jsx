import { useState, useRef } from 'react'
import PropTypes from 'prop-types'

// material-ui
import {
    Box,
    Button,
    LinearProgress,
    Paper,
    Stack,
    Typography,
    IconButton,
    Chip,
    Alert
} from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'

// icons
import {
    IconUpload,
    IconFile,
    IconX,
    IconCheck,
    IconAlertTriangle
} from '@tabler/icons-react'

const FileUploadArea = ({ 
    onFileUpload, 
    acceptedTypes = ['.json', '.jsonl', '.csv'], 
    maxSizeMB = 10, 
    error = null 
}) => {
    const theme = useTheme()
    const fileInputRef = useRef(null)
    
    const [dragActive, setDragActive] = useState(false)
    const [uploadedFile, setUploadedFile] = useState(null)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadError, setUploadError] = useState(null)
    const [preview, setPreview] = useState(null)

    const maxSizeBytes = maxSizeMB * 1024 * 1024

    const validateFile = (file) => {
        const errors = []

        // Check file type
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase()
        if (!acceptedTypes.includes(fileExtension)) {
            errors.push(`File type ${fileExtension} not supported. Accepted types: ${acceptedTypes.join(', ')}`)
        }

        // Check file size
        if (file.size > maxSizeBytes) {
            errors.push(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds limit of ${maxSizeMB}MB`)
        }

        return errors
    }

    const previewFile = async (file) => {
        try {
            const text = await file.text()
            const lines = text.split('\n').slice(0, 5) // First 5 lines
            setPreview({
                lines,
                totalSize: file.size,
                totalLines: text.split('\n').length
            })
        } catch (error) {
            console.error('Error previewing file:', error)
            setPreview(null)
        }
    }

    const handleFileUpload = async (file) => {
        const validationErrors = validateFile(file)
        if (validationErrors.length > 0) {
            setUploadError(validationErrors[0])
            return
        }

        setUploadError(null)
        setUploadProgress(0)

        // Simulate upload progress
        const uploadInterval = setInterval(() => {
            setUploadProgress(prev => {
                if (prev >= 90) {
                    clearInterval(uploadInterval)
                    return prev
                }
                return prev + 10
            })
        }, 100)

        try {
            // Simulate upload delay
            await new Promise(resolve => setTimeout(resolve, 1000))

            setUploadProgress(100)

            // Store the actual File object so parent can upload the real Blob/File
            setUploadedFile(file)

            // Generate preview
            await previewFile(file)

            // Notify parent with the real File object (not a plain JS object)
            // Parent will perform the FormData upload and receive server response
            onFileUpload(file)

            setTimeout(() => setUploadProgress(0), 500)
        } catch (error) {
            console.error('Upload error:', error)
            setUploadError('Failed to upload file. Please try again.')
            setUploadProgress(0)
        }
    }

    const handleDrag = (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }

    const handleDrop = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0])
        }
    }

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0])
        }
    }

    const removeFile = () => {
        setUploadedFile(null)
        setPreview(null)
        setUploadError(null)
        setUploadProgress(0)
        onFileUpload(null)
        
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const openFileDialog = () => {
        fileInputRef.current?.click()
    }

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    return (
        <Box>
            <input
                ref={fileInputRef}
                type="file"
                accept={acceptedTypes.join(',')}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />

            {!uploadedFile ? (
                <Paper
                    sx={{
                        border: 2,
                        borderStyle: 'dashed',
                        borderColor: dragActive 
                            ? theme.palette.primary.main 
                            : error 
                                ? theme.palette.error.main 
                                : theme.palette.divider,
                        borderRadius: 2,
                        p: 4,
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out',
                        backgroundColor: dragActive 
                            ? alpha(theme.palette.primary.main, 0.05) 
                            : 'transparent',
                        '&:hover': {
                            borderColor: theme.palette.primary.main,
                            backgroundColor: alpha(theme.palette.primary.main, 0.02)
                        }
                    }}
                    onClick={openFileDialog}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <Stack spacing={2} alignItems="center">
                        <IconUpload size={48} color={theme.palette.text.secondary} />
                        
                        <Stack spacing={1} alignItems="center">
                            <Typography variant="h6">
                                Drop your file here or click to browse
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                Supported formats: {acceptedTypes.join(', ')}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                                Maximum file size: {maxSizeMB}MB
                            </Typography>
                        </Stack>

                        <Button variant="outlined" startIcon={<IconUpload />}>
                            Choose File
                        </Button>
                    </Stack>
                </Paper>
            ) : (
                <Paper sx={{ p: 2, border: 1, borderColor: theme.palette.divider }}>
                    <Stack spacing={2}>
                        {/* File Info */}
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <IconFile size={20} />
                                <Typography variant="subtitle2">
                                    {uploadedFile.name}
                                </Typography>
                                <Chip
                                    icon={<IconCheck />}
                                    label="Selected"
                                    color="primary"
                                    size="small"
                                    variant="outlined"
                                />
                            </Stack>
                            <IconButton size="small" onClick={removeFile}>
                                <IconX />
                            </IconButton>
                        </Stack>

                        <Typography variant="caption" color="textSecondary">
                            {formatFileSize(uploadedFile.size)}
                        </Typography>

                        {/* Upload Progress */}
                        {uploadProgress > 0 && uploadProgress < 100 && (
                            <LinearProgress
                                variant="determinate"
                                value={uploadProgress}
                                sx={{ height: 4, borderRadius: 2 }}
                            />
                        )}

                        {/* File Preview */}
                        {preview && (
                            <Box>
                                <Typography variant="subtitle2" gutterBottom>
                                    Preview ({preview.totalLines} total lines):
                                </Typography>
                                <Paper
                                    sx={{
                                        p: 1,
                                        backgroundColor: alpha(theme.palette.text.primary, 0.02),
                                        border: 1,
                                        borderColor: theme.palette.divider,
                                        maxHeight: 120,
                                        overflow: 'auto'
                                    }}
                                >
                                    <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace' }}>
                                        {preview.lines.join('\n')}
                                        {preview.lines.length < preview.totalLines && '\n...'}
                                    </Typography>
                                </Paper>
                            </Box>
                        )}
                    </Stack>
                </Paper>
            )}

            {/* Error Display */}
            {(uploadError || error) && (
                <Alert 
                    severity="error" 
                    sx={{ mt: 1 }}
                    icon={<IconAlertTriangle />}
                >
                    {uploadError || error}
                </Alert>
            )}
        </Box>
    )
}

FileUploadArea.propTypes = {
    onFileUpload: PropTypes.func.isRequired,
    acceptedTypes: PropTypes.arrayOf(PropTypes.string),
    maxSizeMB: PropTypes.number,
    error: PropTypes.string
}

export default FileUploadArea