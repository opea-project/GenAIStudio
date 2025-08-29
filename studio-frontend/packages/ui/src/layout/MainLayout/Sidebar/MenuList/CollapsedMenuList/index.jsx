import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'

// material-ui
import { useTheme } from '@mui/material/styles'
import { Box, IconButton, Tooltip, useMediaQuery } from '@mui/material'

// project imports
import { MENU_OPEN, SET_MENU } from '@/store/actions'
import config from '@/config'
import menuItem from '@/menu-items'

// ==============================|| COLLAPSED SIDEBAR MENU LIST ||============================== //

const CollapsedMenuList = () => {
    const theme = useTheme()
    const dispatch = useDispatch()
    const customization = useSelector((state) => state.customization)
    const matchesSM = useMediaQuery(theme.breakpoints.down('lg'))

    // Get all menu items
    const getAllMenuItems = (items) => {
        let allItems = []
        items.forEach(item => {
            if (item.type === 'group' && item.children) {
                item.children.forEach(child => {
                    if (child.type === 'item') {
                        allItems.push(child)
                    }
                })
            }
        })
        return allItems
    }

    const menuItems = getAllMenuItems(menuItem.items)

    const itemHandler = (item) => {
        dispatch({ type: MENU_OPEN, id: item.id })
        if (matchesSM) dispatch({ type: SET_MENU, opened: false })
    }

    const CollapsedNavItem = ({ item }) => {
        const Icon = item.icon
        const isSelected = customization.isOpen.findIndex((id) => id === item.id) > -1

        let itemTarget = '_self'
        if (item.target) {
            itemTarget = '_blank'
        }

        let linkProps = {
            component: forwardRef(function CollapsedNavItemComponent(props, ref) {
                return <Link ref={ref} {...props} to={`${config.basename}${item.url}`} target={itemTarget} />
            })
        }
        if (item?.external) {
            linkProps = { component: 'a', href: item.url, target: itemTarget }
        }

        return (
            <Tooltip title={item.title} placement="right" arrow>
                <IconButton
                    {...linkProps}
                    onClick={() => itemHandler(item)}
                    sx={{
                        width: '40px',
                        height: '40px',
                        margin: '4px 0',
                        backgroundColor: isSelected ? theme.palette.action.selected : 'transparent',
                        color: isSelected ? theme.palette.primary.main : theme.palette.text.secondary,
                        '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                            color: theme.palette.primary.main
                        },
                        borderRadius: '8px'
                    }}
                    disabled={item.disabled}
                >
                    {item.icon ? <Icon stroke={1.5} size="1.3rem" /> : null}
                </IconButton>
            </Tooltip>
        )
    }

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
                py: 1
            }}
        >
            {menuItems.map((item) => (
                <CollapsedNavItem key={item.id} item={item} />
            ))}
        </Box>
    )
}

export default CollapsedMenuList