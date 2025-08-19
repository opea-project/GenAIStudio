import { createPortal } from 'react-dom';
import { useDispatch } from 'react-redux';
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    OutlinedInput,
    Typography,
    IconButton,
    Tooltip,
    CircularProgress
} from '@mui/material';

import { StyledButton } from '@/ui-component/button/StyledButton';
import { IconCopy, IconCheck } from '@tabler/icons-react';
import {
    enqueueSnackbar as enqueueSnackbarAction,
    HIDE_CANVAS_DIALOG,
    SHOW_CANVAS_DIALOG
} from '@/store/actions';
import chatflowsApi from '@/api/chatflows';

const OneClickDeploymentDialog = ({ show, dialogProps, onCancel, onConfirm, deployStatus, setDeployStatus, deploymentConfig, setDeploymentConfig, deployWebSocket }) => {
    const portalElement = document.getElementById('portal');
    const dispatch = useDispatch();
    const [pubkey, setPubkey] = useState('');
    const [copied, setCopied] = useState(false);
    const [deploying, setDeploying] = useState(false);

    // Monitor deployment status and WebSocket state from parent
    useEffect(() => {
        if (deployWebSocket && deployWebSocket.readyState === WebSocket.OPEN) {
            setDeploying(true);
        } else {
            // Check if deployment has completed
            if (deployStatus && (deployStatus[0] === 'Success' || deployStatus[0] === 'Error')) {
                setDeploying(false);
            }
        }
    }, [deployWebSocket, deployStatus]);

    useEffect(() => {
        if (show) {
            dispatch({ type: SHOW_CANVAS_DIALOG });
            
            // Load public key
            chatflowsApi.getPublicKey().then(response => {
                if (response.error) {
                    dispatch(enqueueSnackbarAction({
                        message: 'Error loading public key',
                        options: { variant: 'error' }
                    }));
                } else {
                    setPubkey(response.data.pubkey || '');
                }
            });

            // Check if there's an ongoing deployment by fetching chatflow data
            if (dialogProps.id) {
                // Add a small delay before checking to avoid race conditions
                setTimeout(() => {
                    chatflowsApi.getSpecificChatflow(dialogProps.id).then(response => {
                        if (response.data && response.data.deploymentStatus) {
                            // Parse existing deployment config if available
                            if (response.data.deploymentConfig) {
                                try {
                                    const existingConfig = JSON.parse(response.data.deploymentConfig);
                                    setDeploymentConfig(existingConfig);
                                } catch (e) {
                                    console.warn('Failed to parse existing deployment config');
                                }
                            }

                            if (response.data.deploymentStatus === 'In Progress') {
                                setDeploying(true);
                                // Use existing deployment logs instead of generic reconnecting message
                                const logs = response.data.deploymentLogs ? 
                                    JSON.parse(response.data.deploymentLogs) : 
                                    ['Deployment in progress...'];
                                const logText = logs.length > 0 ? logs.join('\n') : 'Deployment in progress...';
                                setDeployStatus(['Info', logText]);
                            } else if (response.data.deploymentStatus === 'Success' || response.data.deploymentStatus === 'Error') {
                                // Deployment already completed, just show the final status
                                const finalStatus = response.data.deploymentStatus;
                                // For existing deployments, get message from logs (smart content selection)
                                const logs = response.data.deploymentLogs ? 
                                    JSON.parse(response.data.deploymentLogs) : 
                                    [finalStatus === 'Success' ? 'Deployment completed successfully' : 'Deployment failed'];
                                const message = logs[0] || (finalStatus === 'Success' ? 'Deployment completed successfully' : 'Deployment failed');
                                setDeployStatus([finalStatus, message]);
                                setDeploying(false);
                            }
                        }
                    }).catch(error => {
                        console.error('Failed to check deployment status:', error);
                    });
                }, 500); // 500ms delay to avoid race conditions
            }

            // When modal reopens, check if there's a WebSocket still running
            if (deployWebSocket && deployWebSocket.readyState === WebSocket.OPEN) {
                setDeploying(true); // Resume showing deploying state
            }
        } else {
            dispatch({ type: HIDE_CANVAS_DIALOG });
            // Don't clean up WebSocket when modal is just hidden
            // Let deployment continue in background
        }
        return () => {
            dispatch({ type: HIDE_CANVAS_DIALOG });
        };
    }, [show, dispatch, dialogProps.id]);

    const handleCancel = () => {
        onCancel();
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(pubkey);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };


    const handleOneClickDeploy = async () => {
        setDeploying(true);
        
        try {
            // Call the parent's deployment handler - it will handle WebSocket setup
            const result = await onConfirm(dialogProps.id, deploymentConfig);
            if (result && result.error) {
                setDeployStatus(['Error', result.error]);
                setDeploying(false);
                return;
            }
        } catch (err) {
            setDeployStatus(['Error', 'Failed to start deployment']);
            setDeploying(false);
        }
    };

    const renderStatus = () => {
        if (!deployStatus) return null;
        const [statusType, ...lines] = deployStatus;
        let color = statusType === 'Error' ? 'red' : statusType === 'Success' ? 'green' : 'primary.main';
        let displayLines = lines;
        let effectiveStatusType = statusType;
        if (statusType === 'Info') {
            let flatLines = Array.isArray(lines[0]) ? lines[0] : lines;
            // Check for error/fail in any line
            if (flatLines.some(line => typeof line === 'string' && (/error|fail/i).test(line))) {
                color = 'red';
                effectiveStatusType = 'Error';
            }
            displayLines = flatLines;
        }
        return (
            <Box sx={{ pt: 2, pb: 2, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                    <Box sx={{ fontWeight: 600, fontSize: '1rem', color, mb: 1 }}>{effectiveStatusType}</Box>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            fontFamily: 'monospace',
                            fontSize: '0.95rem',
                            background: '#f5f5f5',
                            borderRadius: 1,
                            p: 2,
                            whiteSpace: 'pre-wrap',
                            color,
                            width: '100%'
                        }}
                    >
                        {deploying && <CircularProgress size={18} sx={{ mr: 1, mt: 0.5 }} />}
                        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                            {displayLines.map((line, idx) => <div key={idx}>{line}</div>)}
                        </Box>
                    </Box>
                </Box>
            </Box>
        );
    };

    const component = show ? (
        <Dialog onClose={handleCancel} open={show} fullWidth maxWidth='sm' aria-labelledby='one-click-deployment-title'>
            <DialogTitle sx={{ fontSize: '1rem' }} id='one-click-deployment-title'>
                {dialogProps.title || 'One Click Deployment'}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ pt: 2, pb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Typography sx={{ mr: 1 }}>Public Key <span style={{ color: 'red' }}>*</span></Typography>
                        <Tooltip title={copied ? 'Copied!' : 'Copy'}>
                            <IconButton size='small' onClick={handleCopy} disabled={!pubkey}>
                                {copied ? <IconCheck size={18} color='green' /> : <IconCopy size={18} />}
                            </IconButton>
                        </Tooltip>
                    </Box>
                    <Box component='pre' sx={{ background: '#f5f5f5', borderRadius: 1, p: 2, fontFamily: 'monospace', fontSize: '0.95rem', overflowX: 'auto', mb: 2 }}>{pubkey}</Box>
                </Box>
                <Box sx={{ pt: 2, pb: 2 }}>
                    <Typography sx={{ mb: 1 }}>Hostname <span style={{ color: 'red' }}>*</span></Typography>
                    <OutlinedInput fullWidth value={deploymentConfig.hostname} onChange={e => setDeploymentConfig({ ...deploymentConfig, hostname: e.target.value })} placeholder='Enter hostname' />
                </Box>
                <Box sx={{ pt: 2, pb: 2 }}>
                    <Typography sx={{ mb: 1 }}>Username <span style={{ color: 'red' }}>*</span></Typography>
                    <OutlinedInput fullWidth value={deploymentConfig.username} onChange={e => setDeploymentConfig({ ...deploymentConfig, username: e.target.value })} placeholder='Enter username' />
                </Box>
                {renderStatus()}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleCancel} disabled={deploying}>{dialogProps.cancelButtonName || 'Cancel'}</Button>
                <StyledButton disabled={!deploymentConfig.hostname || !deploymentConfig.username || dialogProps.disabled || deploying} variant='contained' onClick={handleOneClickDeploy}>
                    {deploying ? 'Deploying...' : (dialogProps.confirmButtonName || 'Deploy')}
                </StyledButton>
            </DialogActions>
        </Dialog>
    ) : null;

    return createPortal(component, portalElement);
};

OneClickDeploymentDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func,
    deployStatus: PropTypes.array,
    setDeployStatus: PropTypes.func,
    deploymentConfig: PropTypes.object,
    setDeploymentConfig: PropTypes.func,
    deployWebSocket: PropTypes.object
};

export default OneClickDeploymentDialog;
