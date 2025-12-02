import PropTypes from 'prop-types'
import { useSelector, useDispatch } from 'react-redux'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// material-ui
import { useTheme } from '@mui/material/styles'
import { Avatar, Box, ButtonBase, Switch, Typography, IconButton, useMediaQuery } from '@mui/material'
import { styled } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'

// project imports
import LogoSection from '../LogoSection'
// import ProfileSection from './ProfileSection'

// assets
// import { IconMenu2 } from '@tabler/icons-react'

// store
// import { SET_DARKMODE } from '@/store/actions'

// keycloak context
import LogoutIcon from '@mui/icons-material/Logout';
import { useKeycloak } from '../../../KeycloakContext'

const LogoutButton = () => {
    const keycloak = useKeycloak(); // Access the Keycloak instance

    const handleLogout = () => {
        keycloak.logout({
            redirectUri: window.location.origin, // Redirect to the home page or desired URL after logout
        });
    };

    return (
        <ButtonBase onClick={handleLogout} sx={{ borderRadius: '12px', overflow: 'hidden' }}>
            <LogoutIcon />
        </ButtonBase>
    );
};

// ==============================|| MAIN NAVBAR / HEADER ||============================== //

const MaterialUISwitch = styled(Switch)(({ theme }) => ({
    width: 62,
    height: 34,
    padding: 7,
    '& .MuiSwitch-switchBase': {
        margin: 1,
        padding: 0,
        transform: 'translateX(6px)',
        '&.Mui-checked': {
            color: '#fff',
            transform: 'translateX(22px)',
            '& .MuiSwitch-thumb:before': {
                backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 20 20"><path fill="${encodeURIComponent(
                    '#fff'
                )}" d="M4.2 2.5l-.7 1.8-1.8.7 1.8.7.7 1.8.6-1.8L6.7 5l-1.9-.7-.6-1.8zm15 8.3a6.7 6.7 0 11-6.6-6.6 5.8 5.8 0 006.6 6.6z"/></svg>')`
            },
            '& + .MuiSwitch-track': {
                opacity: 1,
                backgroundColor: theme.palette.mode === 'dark' ? '#8796A5' : '#aab4be'
            }
        }
    },
    '& .MuiSwitch-thumb': {
        backgroundColor: theme.palette.mode === 'dark' ? '#003892' : '#001e3c',
        width: 32,
        height: 32,
        '&:before': {
            content: "''",
            position: 'absolute',
            width: '100%',
            height: '100%',
            left: 0,
            top: 0,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 20 20"><path fill="${encodeURIComponent(
                '#fff'
            )}" d="M9.305 1.667V3.75h1.389V1.667h-1.39zm-4.707 1.95l-.982.982L5.09 6.072l.982-.982-1.473-1.473zm10.802 0L13.927 5.09l.982.982 1.473-1.473-.982-.982zM10 5.139a4.872 4.872 0 00-4.862 4.86A4.872 4.872 0 0010 14.862 4.872 4.872 0 0014.86 10 4.872 4.872 0 0010 5.139zm0 1.389A3.462 3.462 0 0113.471 10a3.462 3.462 0 01-3.473 3.472A3.462 3.462 0 016.527 10 3.462 3.462 0 0110 6.528zM1.665 9.305v1.39h2.083v-1.39H1.666zm14.583 0v1.39h2.084v-1.39h-2.084zM5.09 13.928L3.616 15.4l.982.982 1.473-1.473-.982-.982zm9.82 0l-.982.982 1.473 1.473.982-.982-1.473-1.473zM9.305 16.25v2.083h1.389V16.25h-1.39z"/></svg>')`
        }
    },
    '& .MuiSwitch-track': {
        opacity: 1,
        backgroundColor: theme.palette.mode === 'dark' ? '#8796A5' : '#aab4be',
        borderRadius: 20 / 2
    }
}))

const Header = ({userId, handleLeftDrawerToggle}) => {
    // console.log ('Header', userId)
    const theme = useTheme()
    const matchDownMd = useMediaQuery(theme.breakpoints.down('md'))
    // const navigate = useNavigate()

    // const customization = useSelector((state) => state.customization)

    // const [isDark, setIsDark] = useState(customization.isDarkMode)
    // const [isDark, setIsDark] = useState(false)
    // const dispatch = useDispatch()

    // const changeDarkMode = () => {
    //     dispatch({ type: SET_DARKMODE, isDarkMode: !isDark })
    //     setIsDark((isDark) => !isDark)
    //     localStorage.setItem('isDarkMode', !isDark)
    // }

    // const signOutClicked = () => {
    //     localStorage.removeItem('username')
    //     localStorage.removeItem('password')
    //     navigate('/', { replace: true })
    //     navigate(0)
    // }

    return (
        <>
            {/* Container for logo and logout button */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between', // Space between left and right
                    width: '100%', // Full width of the parent container
                }}
            >
                {/* Left Section - Mobile menu + Logo */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        [theme.breakpoints.down('md')]: {
                            gap: 1,
                        },
                    }}
                >
                    {/* Mobile menu button */}
                    {matchDownMd && handleLeftDrawerToggle && (
                        <IconButton
                            onClick={handleLeftDrawerToggle}
                            sx={{
                                color: theme.palette.text.primary,
                                '&:hover': {
                                    backgroundColor: theme.palette.action.hover
                                }
                            }}
                        >
                            <MenuIcon />
                        </IconButton>
                    )}
                    
                    {/* Logo - always visible on mobile, hidden on desktop in header */}
                    <Box component="span" sx={{ display: { xs: 'block', md: 'none' } }}>
                        <LogoSection />
                    </Box>
                    
                    {/* Desktop logo - hidden on mobile */}
                    <Box component="span" sx={{ display: { xs: 'none', md: 'block' } }}>
                        <LogoSection />
                    </Box>
                </Box>

                
                {/* Logout Button */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                    }}
                >
                    <Avatar
                        variant='rounded'
                        sx={{
                            ...theme.typography.commonAvatar,
                            ...theme.typography.mediumAvatar,
                            transition: 'all .2s ease-in-out',
                            background: theme.palette.secondary.light,
                            color: theme.palette.secondary.dark,
                        }}
                        color='inherit'
                    >
                        {/* {...stringAvatar(userId)} */}
                        {userId[0].toUpperCase()}{userId[1].toUpperCase()}
                    </Avatar>

                    <LogoutButton />
                </Box>
            </Box>
        </>

    )
}

Header.propTypes = {
    handleLeftDrawerToggle: PropTypes.func
}

export default Header
