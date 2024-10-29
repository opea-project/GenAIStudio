import { createPortal } from 'react-dom'
import { useDispatch } from 'react-redux'
import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

// material-ui
import { 
    Box, 
    Button, 
    Dialog, 
    DialogActions, 
    DialogContent, 
    DialogTitle, 
    FormControl,
    FormControlLabel,
    OutlinedInput, 
    Radio, 
    RadioGroup, 
    Typography,
    Checkbox
} from '@mui/material'

// store
import {
    closeSnackbar as closeSnackbarAction,
    enqueueSnackbar as enqueueSnackbarAction,
    HIDE_CANVAS_DIALOG,
    SHOW_CANVAS_DIALOG
} from '@/store/actions'
import useNotifier from '@/utils/useNotifier'
import { StyledButton } from '@/ui-component/button/StyledButton'
import Chip from '@mui/material/Chip'
import { IconX } from '@tabler/icons-react'

// API
import marketplacesApi from '@/api/marketplaces'
import useApi from '@/hooks/useApi'
import { FileDownloadSharp } from '@mui/icons-material'

// Project imports

const BuildDeploymentPackageDialog = ({ show, dialogProps, onCancel, onConfirm }) => {
    const portalElement = document.getElementById('portal')
    const dispatch = useDispatch()
    const [name, setName] = useState('')
    const [flowType, setFlowType] = useState('')
    const [description, setDescription] = useState('')
    const [badge, setBadge] = useState('')
    const [usecases, setUsecases] = useState([])
    const [usecaseInput, setUsecaseInput] = useState('')
    const [deploymentConfig, setDeploymentConfig] = useState([])




    const saveCustomTemplateApi = useApi(marketplacesApi.saveAsCustomTemplate)

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const defaultDeploymentConfig = [
        {
            "key": "infrastructure",
            "label": "Infrastructure",
            "type": "radio",
            "options": [
                {
                    "key": "onprem",
                    "label": "On-Prem"
                },
                {
                    "key": "cloud",
                    "label": "Cloud",
                    "disabled": true
                }
            ],
            "value": "onprem"
        },
        {
            "key": "os",
            "label": "Operating System",
            "type": "radio",
            "options": [
                {
                    "key": "linux",
                    "label": "Linux"
                }
            ],
            "value": "linux"
        },
        {
            "key": "deployment_method",
            "label": "Deployment Method",
            "type": "radio",
            "options": [
                {
                    "key": "docker_compose",
                    "label": "Docker Compose"
                },
                {
                    "key": "kubernetes",
                    "label": "Kubernetes",
                    "disabled": true
                },
                {
                    "key": "gmc",
                    "label": "GMC",
                    "disabled": true
                }
            ],
            "value": "docker_compose"
        },
        {
            "key": "features",
            "label": "Additional Features",
            "type": "checkboxes",
            "options": [
                {
                    "key": "hardware_accelerator",
                    "label": "Hardware Accelerator",
                    "disabled": true
                },
                {
                    "key": "monitoring_dashboard",
                    "label": "Monitoring Dashboard",
                    "disabled": true
                },
                {
                    "key": "api_serving",
                    "label": "API Access and Token Management",
                    "disabled": true
                },
                {
                    "key": "user_management",
                    "label": "User Management",
                    "disabled": true
                },
            ],
            "value": []
        }
    ]

    useNotifier()

    useEffect(() => {
        // if (dialogProps.chatflow) {
        //     setName(dialogProps.chatflow.name)
        //     setFlowType(dialogProps.chatflow.type)
        // }

        // if (dialogProps.tool) {
        //     setName(dialogProps.tool.name)
        //     setDescription(dialogProps.tool.description)
        //     setFlowType('Tool')
        // }

        return () => {
            setDeploymentConfig(defaultDeploymentConfig)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dialogProps])

    useEffect(() => {
        if (show) dispatch({ type: SHOW_CANVAS_DIALOG })
        else dispatch({ type: HIDE_CANVAS_DIALOG })
        return () => dispatch({ type: HIDE_CANVAS_DIALOG })
    }, [show, dispatch])

    const handleUsecaseInputChange = (event) => {
        setUsecaseInput(event.target.value)
    }

    const handleUsecaseInputKeyDown = (event) => {
        if (event.key === 'Enter' && usecaseInput.trim()) {
            event.preventDefault()
            if (!usecases.includes(usecaseInput)) {
                setUsecases([...usecases, usecaseInput])
                setUsecaseInput('')
            }
        }
    }

    const handleUsecaseDelete = (toDelete) => {
        setUsecases(usecases.filter((category) => category !== toDelete))
    }

    useEffect(() => {
        if (saveCustomTemplateApi.data) {
            enqueueSnackbar({
                message: 'Saved as template successfully!',
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'success',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
            onCancel()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saveCustomTemplateApi.data])

    useEffect(() => {
        if (saveCustomTemplateApi.error) {
            enqueueSnackbar({
                message: 'Failed to save as template!',
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
            onCancel()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saveCustomTemplateApi.error])

    const handleConfigChange = (path, value) => {
        console.log('handleConfigChange', path, value)
        setDeploymentConfig((prevConfig) => {
            const newConfig = [...prevConfig];
            const keys = path.split('.');
            let current = newConfig;

            keys.slice(0, -1).forEach(key => {
            current = current.find(item => item.key === key).options;
            });

            current.find(item => item.key === keys[keys.length - 1]).value = value;
            console.log('newConfig', newConfigs)

            return newConfig;
        });
    }

    const component = show ? (
        <Dialog
            onClose={onCancel}
            open={show}
            fullWidth
            maxWidth='sm'
            aria-labelledby='alert-dialog-title'
            aria-describedby='alert-dialog-description'
        >
            <DialogTitle sx={{ fontSize: '1rem' }} id='alert-dialog-title'>
                {dialogProps.title || 'Build Deployment Package'}
            </DialogTitle>
            <DialogContent>
                {deploymentConfig && deploymentConfig.map((field) => {
                    return (
                        <Box sx={{ pt: 2, pb: 2 }} key={field.key}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <Typography sx={{ mb: 1 }}>
                                    {field.label} <span style={{ color: 'red' }}>&nbsp;*</span>
                                </Typography>
                                {field.type === 'radio' && (
                                    <RadioGroup
                                        row
                                        aria-label={field.key}
                                        name={field.key}
                                        value={field.value}
                                        onChange={(e) => handleConfigChange(field.key, e.target.value)}
                                    >
                                        {field.options &&
                                            field.options.map((option) => (
                                                <FormControlLabel
                                                    key={option.key}
                                                    value={option.key}
                                                    control={<Radio />}
                                                    label={option.label}
                                                    disabled={option.disabled}
                                                />
                                            ))}
                                    </RadioGroup>
                                )}
                                {field.type === 'checkboxes' && (
                                    <FormControl component="fieldset">
                                        {field.options &&
                                            field.options.map((option) => (
                                                <FormControlLabel
                                                    key={option.key}
                                                    control={
                                                        <Checkbox
                                                            checked={field.value.includes(option.key)}
                                                            onChange={(e) => {
                                                                const newValue = e.target.checked
                                                                    ? [...field.value, option.key]
                                                                    : field.value.filter((key) => key !== option.key);
                                                                handleConfigChange(field.key, newValue);
                                                            }}
                                                            disabled={option.disabled}
                                                        />
                                                    }
                                                    label={option.label}
                                                />
                                            ))}
                                    </FormControl>
                                )}
                            </div>
                        </Box>
                    )
                })}
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>{dialogProps.cancelButtonName || 'Cancel'}</Button>
                <StyledButton disabled={dialogProps.disabled} variant='contained' onClick={()=>onConfirm(dialogProps.id, deploymentConfig)}>
                    {dialogProps.confirmButtonName || 'Export Package'}
                </StyledButton>
            </DialogActions>
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

BuildDeploymentPackageDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func
}

export default BuildDeploymentPackageDialog
