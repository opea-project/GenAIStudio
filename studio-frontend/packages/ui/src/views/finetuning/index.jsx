import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// material-ui
import { Box, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ItemCard from '@/ui-component/cards/ItemCard'
import { gridSpacing } from '@/store/constant'
import WorkflowEmptySVG from '@/assets/images/workflow_empty.svg'
import LoginDialog from '@/ui-component/dialog/LoginDialog'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import { StyledButton } from '@/ui-component/button/StyledButton'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@/ErrorBoundary'
import FinetuningJobsTable from './FinetuningJobsTable'
import FinetuningJobModal from './FinetuningJobModal'

// API
import finetuningApi from '@/api/finetuning'

// Hooks
import useApi from '@/hooks/useApi'

// icons
import { IconPlus, IconLayoutGrid, IconList } from '@tabler/icons-react'

//keycloak
import { useKeycloak } from '../../KeycloakContext'

// ==============================|| Fine-tuning ||============================== //

const Finetuning = () => {
    const keycloak = useKeycloak()
    const navigate = useNavigate()
    const theme = useTheme()

    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [search, setSearch] = useState('')
    const [loginDialogOpen, setLoginDialogOpen] = useState(false)
    const [loginDialogProps, setLoginDialogProps] = useState({})
    const [jobs, setJobs] = useState([])
    const [jobModalOpen, setJobModalOpen] = useState(false)

    let userRole = keycloak?.tokenParsed?.resource_access?.genaistudio?.roles[0]
    let getAllJobsApi = null
    
    if (keycloak.authenticated) {
        getAllJobsApi = useApi(finetuningApi.getAllJobs)
    }

    useEffect(() => {
        // Load fine-tuning jobs
        loadJobs()
    }, [])

    const loadJobs = async () => {
        if (!getAllJobsApi) return
        
        try {
            setLoading(true)
            const response = await getAllJobsApi.request()
            // Normalize server objects (TypeORM entities or external API objects)
            const normalizeJob = (j) => {
                if (!j) return null
                const id = j.id || j.job_id || j.fine_tuning_job_id || String(Date.now())
                const name = j.name || id
                const status = j.status || j.state || 'pending'
                const model = j.model || 'N/A'
                const dataset = j.dataset || j.training_file || j.trainingFile || 'N/A'
                const progress = typeof j.progress === 'number' ? `${j.progress}%` : (j.progress || '0%')
                const createdDate = j.createdDate || j.created_at || j.createdAt || new Date().toISOString()
                return {
                    ...j,
                    id,
                    name,
                    status,
                    model,
                    dataset,
                    progress,
                    createdDate
                }
            }

            const jobsData = Array.isArray(response) ? response.map(normalizeJob).filter(Boolean) : []
            setJobs(jobsData)
            setLoading(false)
        } catch (error) {
            console.error('Error loading fine-tuning jobs:', error)
            setJobs([])
            setError(error)
            setLoading(false)
        }
    }

    const handleCreateJob = () => {
        try {
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur()
            }
        } catch (e) {
            // ignore in non-browser environments
        }
        setTimeout(() => setJobModalOpen(true), 0)
    }

    const handleJobCreated = (newJob) => {
        setJobs(prev => [...prev, newJob])
        setJobModalOpen(false)
    }

    const filterJobs = (jobs) => {
        if (!search || search.trim() === '') return jobs
        const q = search.toLowerCase()
        return jobs.filter((job) => {
            const name = (job?.name || job?.id || '').toString().toLowerCase()
            return name.includes(q)
        })
    }

    return (
        <>
            <MainCard sx={{ background: theme.palette.background.default }}>
                <Stack flexDirection='column' sx={{ gap: 3 }}>
                    <Box>
                        <Typography 
                            sx={{
                                fontSize: '1.5rem',
                                color: '#1162cc',
                                fontWeight: 600,
                                mb: 2,
                                mt: 1.5
                            }}
                            variant='h1'
                        >
                            Fine-tuning Jobs
                        </Typography>
                        <Stack flexDirection='row' sx={{ mb: 1, gap: 1, flexWrap: 'wrap' }}>
                            <StyledButton
                                variant='contained'
                                onClick={handleCreateJob}
                                startIcon={<IconPlus />}
                                sx={{ borderRadius: 2, height: 40 }}
                            >
                                Create New Job
                            </StyledButton>
                        </Stack>
                    </Box>

                    {isLoading ? (
                        <Box display='grid' gridTemplateColumns='repeat(auto-fill, minmax(300px, 1fr))' gap={gridSpacing}>
                            <Skeleton variant='rounded' height={160} />
                            <Skeleton variant='rounded' height={160} />
                            <Skeleton variant='rounded' height={160} />
                        </Box>
                    ) : (
                        <Stack sx={{ position: 'relative' }}>
                            {jobs.length === 0 ? (
                                <Stack flexDirection='column' alignItems='center' spacing={2}>
                                    <Box
                                        sx={{
                                            p: 2,
                                            height: 'auto',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <img
                                            style={{ objectFit: 'cover', height: '30vh', width: 'auto' }}
                                            src={WorkflowEmptySVG}
                                            alt='WorkflowEmptySVG'
                                        />
                                        <Stack sx={{ p: 2, textAlign: 'center' }}>
                                            <h3>No Fine-tuning Jobs Yet</h3>
                                            <span>Create your first fine-tuning job to get started!</span>
                                        </Stack>
                                    </Box>
                                </Stack>
                            ) : (
                                <FinetuningJobsTable 
                                    data={filterJobs(jobs)} 
                                    isLoading={isLoading}
                                    onRefresh={loadJobs}
                                />
                            )}
                        </Stack>
                    )}
                </Stack>
            </MainCard>

            <FinetuningJobModal
                open={jobModalOpen}
                onClose={() => setJobModalOpen(false)}
                onJobCreated={handleJobCreated}
            />

            <LoginDialog
                show={loginDialogOpen}
                dialogProps={loginDialogProps}
                onCancel={() => setLoginDialogOpen(false)}
                onConfirm={() => setLoginDialogOpen(false)}
            />
        </>
    )
}

export default Finetuning