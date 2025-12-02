import PropTypes from 'prop-types'

// material-ui
import { useTheme } from '@mui/material/styles'
import { Box, Drawer, useMediaQuery, IconButton, Tooltip, Typography } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import MenuIcon from '@mui/icons-material/Menu'

// third-party
import PerfectScrollbar from 'react-perfect-scrollbar'
import { BrowserView, MobileView } from 'react-device-detect'

// project imports
import MenuList from './MenuList'
import CollapsedMenuList from './MenuList/CollapsedMenuList'
import LogoSection from '../LogoSection'
import { drawerWidth, drawerWidthCollapsed, headerHeight } from '@/store/constant'

// ==============================|| SIDEBAR DRAWER ||============================== //

const Sidebar = ({ drawerOpen, drawerToggle, window }) => {
    const theme = useTheme()
    const matchUpMd = useMediaQuery(theme.breakpoints.up('md'))

    // Desktop collapsed drawer content
    const collapsedDrawer = (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Sidebar icon when collapsed with tooltip */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    p: 2,
                    minHeight: '80px'
                }}
            >
                <Tooltip title="Expand Menu" placement="right" arrow>
                    <IconButton
                        onClick={drawerToggle}
                        sx={{
                            color: theme.palette.text.primary,
                            '&:hover': {
                                backgroundColor: theme.palette.action.hover
                            }
                        }}
                    >
                        <MenuIcon />
                    </IconButton>
                </Tooltip>
            </Box>
            
            {/* Collapsed Menu Items */}
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
                <CollapsedMenuList />
            </Box>
        </Box>
    )

    // Desktop expanded drawer content
    const expandedDrawer = (
        <>
            {/* Header with GenAI Studio text and collapse button */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 2,
                    minHeight: '80px'
                }}
            >
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 600,
                        color: theme.palette.primary.main,
                        fontSize: '1.3rem'
                    }}
                >
                    GenAI Studio
                </Typography>
                
                <Tooltip title="Collapse Menu" placement="left" arrow>
                    <IconButton
                        onClick={drawerToggle}
                        sx={{
                            color: theme.palette.text.secondary,
                            '&:hover': {
                                backgroundColor: theme.palette.action.hover
                            }
                        }}
                    >
                        <ChevronLeftIcon />
                    </IconButton>
                </Tooltip>
            </Box>
            
            {/* Menu content */}
            <BrowserView>
                <PerfectScrollbar
                    component='div'
                    style={{
                        height: `calc(100vh - ${headerHeight}px - 80px)`,
                        paddingLeft: '16px',
                        paddingRight: '16px'
                    }}
                >
                    <MenuList />
                </PerfectScrollbar>
            </BrowserView>
        </>
    )

    // Mobile drawer content
    const mobileDrawer = (
        <>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 2,
                    minHeight: '80px'
                }}
            >
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 600,
                        color: theme.palette.primary.main,
                        fontSize: '1.3rem'
                    }}
                >
                    GenAI Studio
                </Typography>
                <IconButton
                    onClick={drawerToggle}
                    sx={{
                        color: theme.palette.text.secondary
                    }}
                >
                    <ChevronLeftIcon />
                </IconButton>
            </Box>
            
            {/* Mobile Menu content */}
            <Box sx={{ px: 2, flex: 1, overflowY: 'auto' }}>
                <MenuList />
            </Box>
        </>
    )

    const container = window !== undefined ? () => window.document.body : undefined

    return (
        <>
            {/* Desktop Sidebar - Always present, changes width */}
            {matchUpMd && (
                <Drawer
                    variant="permanent"
                    sx={{
                        width: drawerOpen ? drawerWidth : drawerWidthCollapsed,
                        flexShrink: 0,
                        '& .MuiDrawer-paper': {
                            width: drawerOpen ? drawerWidth : drawerWidthCollapsed,
                            boxSizing: 'border-box',
                            background: theme.palette.background.default,
                            color: theme.palette.text.primary,
                            top: `${headerHeight}px`,
                            borderRight: `1px solid ${theme.palette.divider}`,
                            transition: theme.transitions.create('width', {
                                easing: theme.transitions.easing.sharp,
                                duration: theme.transitions.duration.enteringScreen,
                            }),
                            overflowX: 'hidden'
                        }
                    }}
                >
                    {drawerOpen ? expandedDrawer : collapsedDrawer}
                </Drawer>
            )}

            {/* Mobile Sidebar - Overlay */}
            {!matchUpMd && (
                <Drawer
                    container={container}
                    variant="temporary"
                    anchor="left"
                    open={drawerOpen}
                    onClose={drawerToggle}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        '& .MuiDrawer-paper': {
                            width: drawerWidth,
                            background: theme.palette.background.default,
                            color: theme.palette.text.primary,
                            borderRight: `1px solid ${theme.palette.divider}`
                        }
                    }}
                >
                    {mobileDrawer}
                </Drawer>
            )}
        </>
    )
}

Sidebar.propTypes = {
    drawerOpen: PropTypes.bool,
    drawerToggle: PropTypes.func,
    window: PropTypes.object
}

export default Sidebar
