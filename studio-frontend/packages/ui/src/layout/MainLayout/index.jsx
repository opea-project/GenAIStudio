import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Outlet } from 'react-router-dom'

// material-ui
import { styled, useTheme } from '@mui/material/styles'
import { AppBar, Box, Chip, CssBaseline, Toolbar, useMediaQuery } from '@mui/material'

// project imports
import Header from './Header'
import Sidebar from './Sidebar'
import { drawerWidth, headerHeight } from '@/store/constant'
import { SET_MENU } from '@/store/actions'

import {useKeycloak } from '../../KeycloakContext.jsx'

// styles
const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })(({ theme, open }) => ({
    ...theme.typography.mainContent,
    ...(!open && {
        backgroundColor: 'transparent',
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        transition: theme.transitions.create('all', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen
        }),
        marginRight: 0,
        [theme.breakpoints.up('md')]: {
            marginLeft: -drawerWidth,
            width: `calc(100% - ${drawerWidth}px)`
        },
        [theme.breakpoints.down('md')]: {
            marginLeft: '20px',
            width: `calc(100% - ${drawerWidth}px)`,
            padding: '16px'
        },
        [theme.breakpoints.down('sm')]: {
            marginLeft: '10px',
            width: `calc(100% - ${drawerWidth}px)`,
            padding: '16px',
            marginRight: '10px'
        }
    }),
    ...(open && {
        backgroundColor: 'transparent',
        transition: theme.transitions.create('all', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen
        }),
        marginLeft: 0,
        marginRight: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        width: `calc(100% - ${drawerWidth}px)`
    })
}))

// ==============================|| MAIN LAYOUT ||============================== //

const MainLayout = () => {
    const keycloak = useKeycloak()
    console.log ("login roles", keycloak?.tokenParsed?.resource_access?.genaistudio?.roles[0])
    let userRole = keycloak?.tokenParsed?.resource_access?.genaistudio?.roles[0]
    let userId = keycloak?.tokenParsed?.email ? keycloak.tokenParsed.email : ''

    const handleLogout = () => {
        keycloak.logout({
            redirectUri: window.location.origin, // Redirect to the home page or desired URL after logout
        });
    };

    const theme = useTheme()
    const matchDownMd = useMediaQuery(theme.breakpoints.down('lg'))

    // Handle left drawer
    const leftDrawerOpened = useSelector((state) => state.customization.opened)
    const dispatch = useDispatch()
    const handleLeftDrawerToggle = () => {
        dispatch({ type: SET_MENU, opened: !leftDrawerOpened })
    }

    useEffect(() => {
        setTimeout(() => dispatch({ type: SET_MENU, opened: !matchDownMd }), 0)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matchDownMd])

    return (
        (userRole==='admin' || userRole==='user')? 
            (<Box sx={{ display: 'flex' }}>
                <CssBaseline />
                {/* header */}
                <AppBar
                    enableColorOnDark
                    position='fixed'
                    color='inherit'
                    elevation={0}
                    sx={{
                        bgcolor: theme.palette.background.default,
                        transition: leftDrawerOpened ? theme.transitions.create('width') : 'none'
                    }}
                >
                    <Toolbar sx={{ height: `${headerHeight}px`, borderBottom: '1px solid', borderColor: theme.palette.primary[200] + 75 }}>
                        <Header userId={userId} />
                    </Toolbar>
                </AppBar>

                {/* drawer */}
                {/* <Sidebar drawerOpen={leftDrawerOpened} drawerToggle={handleLeftDrawerToggle} /> */}

                {/* main content */}
                (<Main theme={theme} open={leftDrawerOpened}>
                    <Outlet />
                    <Box
                        sx={{
                            position: 'fixed',
                            bottom: 16, // distance from the bottom of the page
                            right: 16, // distance from the right side of the page
                            zIndex: 1000 // make sure it appears above other elements if needed
                        }}
                    >
                        <a href="https://flowiseai.com" target="_blank" style={{ textDecoration: 'none', color:"#bfbfbf", fontSize:"10px"}}>
                            FlowiseAI
                        </a>
                    </Box>
                </Main>)
            </Box>):
            (
                <Box>
                    <h1>You are unauthorised. Please contact your admin for approval.</h1>
                    <Chip label="Back to login page" onClick={handleLogout} />
                </Box>
            )
    )
}

export default MainLayout
