import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// material-ui
import { Box, Skeleton, Stack, Input, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ItemCard from '@/ui-component/cards/ItemCard'
import { gridSpacing } from '@/store/constant'
import WorkflowEmptySVG from '@/assets/images/workflow_empty.svg'
import LoginDialog from '@/ui-component/dialog/LoginDialog'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import { FlowListTable } from '@/ui-component/table/FlowListTable'
import { StyledButton } from '@/ui-component/button/StyledButton'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@/ErrorBoundary'

// API
import chatflowsApi from '@/api/chatflows'

// Hooks
import useApi from '@/hooks/useApi'

// const
import { baseURL } from '@/store/constant'

// icons
import { IconPlus, IconLayoutGrid, IconList, IconSearch } from '@tabler/icons-react'

//keycloak
import { useKeycloak } from '../../KeycloakContext'

// ==============================|| OPEAFlows ||============================== //

const Opeaflows = () => {
    const keycloak = useKeycloak()
    const navigate = useNavigate()
    const theme = useTheme()

    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [images, setImages] = useState({})
    const [search, setSearch] = useState('')
    const [loginDialogOpen, setLoginDialogOpen] = useState(false)
    const [loginDialogProps, setLoginDialogProps] = useState({})

    console.log ("roles", keycloak?.tokenParsed?.resource_access?.genaistudio?.roles[0])
    let userRole = keycloak?.tokenParsed?.resource_access?.genaistudio?.roles[0]
    let getAllOpeaflowsApi = null
    if (keycloak.authenticated) {
        getAllOpeaflowsApi = useApi(chatflowsApi.getAllOpeaflows)

        if (userRole === 'admin') {
            getAllOpeaflowsApi = useApi(chatflowsApi.getAllOpeaflows)
            }
        else if (userRole === 'user') {
            getAllOpeaflowsApi = useApi(() => chatflowsApi.getUserOpeaflows(keycloak.tokenParsed.email));
            console.log("email", keycloak.tokenParsed.email)
            console.log ("get user opeaflows", getAllOpeaflowsApi)
        }
    }
     
    const stopSandboxApi = chatflowsApi.stopSandbox
    const updateFlowToServerApi = chatflowsApi.updateChatflow
    const [view, setView] = useState(localStorage.getItem('flowDisplayStyle') || 'list')

    const handleChange = (event, nextView) => {
        if (nextView === null) return
        localStorage.setItem('flowDisplayStyle', nextView)
        setView(nextView)
    }

    const onSearchChange = (event) => {
        setSearch(event.target.value)
    }

    function filterFlows(data) {
        return (
            data.name.toLowerCase().indexOf(search.toLowerCase()) > -1 ||
            (data.category && data.category.toLowerCase().indexOf(search.toLowerCase()) > -1)
        )
    }

    const onLoginClick = (username, password) => {
        localStorage.setItem('username', username)
        localStorage.setItem('password', password)
        navigate(0)
    }

    const addNew = () => {
        navigate('/opeacanvas')
    }

    const importSamples = () => {
        setLoading(true);
        chatflowsApi.importSampleChatflowsbyUserId(keycloak.tokenParsed.email).then(() => {
            getAllOpeaflowsApi.request();
        }).catch(() => {
            setLoading(false);
        });
    }
    
    const goToCanvas = (selectedChatflow) => {
        navigate(`/opeacanvas/${selectedChatflow.id}`)
    }

    useEffect(() => {
        getAllOpeaflowsApi.request()

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (getAllOpeaflowsApi.error) {
            console.log ("error", getAllOpeaflowsApi.error)
            // if (getAllOpeaflowsApi.error?.response?.status === 401) {
            //     setLoginDialogProps({
            //         title: 'Login',
            //         confirmButtonName: 'Login'
            //     })
            //     setLoginDialogOpen(true)
            // } else {
            //     setError(getAllOpeaflowsApi.error)
            // }
        }
    }, [getAllOpeaflowsApi.error])

    useEffect(() => {
        setLoading(getAllOpeaflowsApi.loading)
    }, [getAllOpeaflowsApi.loading])

    useEffect(() => {
        if (getAllOpeaflowsApi.data) {
            try {
                const chatflows = getAllOpeaflowsApi.data
                const images = {}
                for (let i = 0; i < chatflows.length; i += 1) {
                    const flowDataStr = chatflows[i].flowData
                    const flowData = JSON.parse(flowDataStr)
                    const nodes = flowData.nodes || []
                    images[chatflows[i].id] = []
                    for (let j = 0; j < nodes.length; j += 1) {
                        const imageSrc = `${baseURL}/api/v1/node-icon/${nodes[j].data.name}`
                        if (!images[chatflows[i].id].includes(imageSrc)) {
                            images[chatflows[i].id].push(imageSrc)
                        }
                    }
                }
                setImages(images)
            } catch (e) {
                console.error(e)
            }
        }
    }, [getAllOpeaflowsApi.data])

    return (
        <MainCard>
            {error ? (
                <ErrorBoundary error={error} />
            ) : (
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
                            Workflows
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <StyledButton variant='contained' onClick={addNew} startIcon={<IconPlus />} sx={{ borderRadius: 2, height: 40, width: 250 }}>
                                Create New Workflow
                            </StyledButton>
                            <StyledButton variant='contained' onClick={importSamples} startIcon={<IconPlus />} sx={{ borderRadius: 2, height: 40, width: 250 }}>
                                Import Sample Workflows
                            </StyledButton>
                        </Box>
                        
                        <Input
                            size='small'
                            sx={{
                                width: '280px',
                                height: '40px',
                                borderRadius: 2,
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderRadius: 2
                                }
                            }}
                            placeholder='Search Name or Category'
                            onChange={onSearchChange}
                            value={search}
                            endAdornment={
                                <Box
                                    sx={{
                                        color: theme.palette.grey[400],
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        mr: 1
                                    }}
                                >
                                    <IconSearch style={{ color: 'inherit', width: 16, height: 16 }} />
                                </Box>
                            }
                            type='search'
                        />
                        </Box>
                    </Box>
                    {!view || view === 'card' ? (
                        <>
                            {isLoading && !getAllOpeaflowsApi.data ? (
                                <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                    <Skeleton variant='rounded' height={160} />
                                    <Skeleton variant='rounded' height={160} />
                                    <Skeleton variant='rounded' height={160} />
                                </Box>
                            ) : (
                                <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                    {getAllOpeaflowsApi.data?.filter(filterFlows).map((data, index) => (
                                        <ItemCard key={index} onClick={() => goToCanvas(data)} data={data} images={images[data.id]} />
                                    ))}
                                </Box>
                            )}
                        </>
                    ) : (
                        <FlowListTable
                            data={getAllOpeaflowsApi.data}
                            images={images}
                            isLoading={isLoading}
                            filterFunction={filterFlows}
                            updateFlowsApi={getAllOpeaflowsApi}
                            updateFlowToServerApi = {updateFlowToServerApi}
                            setError={setError}
                            stopSandboxApi={stopSandboxApi}
                            isOpeaCanvas={true}
                            userRole={userRole}
                        />
                    )}
                    {!isLoading && (!getAllOpeaflowsApi.data || getAllOpeaflowsApi.data.length === 0) && (
                        <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                            <Box sx={{ p: 2, height: 'auto' }}>
                                <img
                                    style={{ objectFit: 'cover', height: '25vh', width: 'auto' }}
                                    src={WorkflowEmptySVG}
                                    alt='WorkflowEmptySVG'
                                />
                            </Box>
                            <div>No Workflows Yet</div>
                        </Stack>
                    )}
                </Stack>
            )}

            <LoginDialog show={loginDialogOpen} dialogProps={loginDialogProps} onConfirm={onLoginClick} />
            <ConfirmDialog />
        </MainCard>
    )
}

export default Opeaflows
