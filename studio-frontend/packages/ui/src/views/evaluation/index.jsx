import { useState } from 'react'

// material-ui
import { Box, Tab, Tabs, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import MainCard from '@/ui-component/cards/MainCard'

// views
import ExecutionTab from './ExecutionTab'
import DatasetTab from './DatasetTab'

// ==============================|| Evaluation ||============================== //

const Evaluation = () => {
    const theme = useTheme()
    const [activeTab, setActiveTab] = useState(0)

    const handleTabChange = (_event, newValue) => {
        setActiveTab(newValue)
    }

    return (
        <MainCard sx={{ background: theme.palette.background.default }}>
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
                    Evaluation
                </Typography>

                <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
                >
                    <Tab label='Executions' id='eval-tab-0' aria-controls='eval-tabpanel-0' />
                    <Tab label='Datasets' id='eval-tab-1' aria-controls='eval-tabpanel-1' />
                </Tabs>

                <Box
                    role='tabpanel'
                    hidden={activeTab !== 0}
                    id='eval-tabpanel-0'
                    aria-labelledby='eval-tab-0'
                >
                    <ExecutionTab isVisible={activeTab === 0} />
                </Box>

                <Box
                    role='tabpanel'
                    hidden={activeTab !== 1}
                    id='eval-tabpanel-1'
                    aria-labelledby='eval-tab-1'
                >
                    <DatasetTab isVisible={activeTab === 1} />
                </Box>
            </Box>
        </MainCard>
    )
}

export default Evaluation
