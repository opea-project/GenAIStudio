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
    closeSnackbar as closeSnackbarAction,
    enqueueSnackbar as enqueueSnackbarAction,
    HIDE_CANVAS_DIALOG,
    SHOW_CANVAS_DIALOG
} from '@/store/actions';
import chatflowsApi from '@/api/chatflows';

const OneClickDeploymentDialog = ({ show, dialogProps, onCancel, onConfirm, deployStatus, setDeployStatus, deploymentConfig, setDeploymentConfig }) => {
    const portalElement = document.getElementById('portal');
    const dispatch = useDispatch();
    const [pubkey, setPubkey] = useState('');
    const [copied, setCopied] = useState(false);
    const [deploying, setDeploying] = useState(false);
    const [ws, setWs] = useState(null);

    useEffect(() => {
        if (show) {
            dispatch({ type: SHOW_CANVAS_DIALOG });
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
        } else {
            dispatch({ type: HIDE_CANVAS_DIALOG });
        }
        return () => dispatch({ type: HIDE_CANVAS_DIALOG });
    }, [show, dispatch]);

    const handleCopy = () => {
        navigator.clipboard.writeText(pubkey);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const handleOneClickDeploy = async () => {
        setDeploying(true);
        setDeployStatus(['Info', 'Connecting to machine...']);
        try {
            const result = await onConfirm(dialogProps.id, deploymentConfig);
            if (result && result.error) {
                setDeployStatus(['Error', result.error]);
                setDeploying(false);
                return;
            }
            const compose_dir = result?.compose_dir;
            const wsUrl = `${window.location.origin.replace(/^http/, 'ws')}/studio-backend/ws/clickdeploy-status`;
            const wsInstance = new window.WebSocket(wsUrl);
            setWs(wsInstance);
            wsInstance.onopen = () => {
                wsInstance.send(JSON.stringify({ hostname: deploymentConfig.hostname, username: deploymentConfig.username, compose_dir: compose_dir }));
            };
            wsInstance.onmessage = (event) => {
                let data;
                try { data = JSON.parse(event.data); } catch { return; }
                console.log('WebSocket message:', data);
                if (data.status === 'Done') {
                    setDeployStatus(['Success', ...(data.success || '').split(',').map(line => line.trim())]);
                    setDeploying(false);
                } else if (data.status === 'Error') {
                    let lines = [];
                    if (Array.isArray(data.error)) {
                        lines = data.error;
                    } else if (typeof data.error === 'string') {
                        lines = data.error.split(',').map(line => line.trim());
                    } else {
                        lines = ['Unknown error'];
                    }
                    setDeployStatus(['Error', ...lines]);
                    setDeploying(false);
                } else if (data.status === 'In Progress') {
                    setDeployStatus(['Info', data.nohup_out]);
                } else if (data.status === 'Preparing') {
                    setDeployStatus(['Info', data.message]);
                }
            };
            wsInstance.onerror = () => {
                setDeployStatus(['Error', 'WebSocket error']);
                setDeploying(false);
            };
            wsInstance.onclose = () => setWs(null);
        } catch (err) {
            setDeployStatus(['Error', 'Deployment failed']);
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
        <Dialog onClose={onCancel} open={show} fullWidth maxWidth='sm' aria-labelledby='one-click-deployment-title'>
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
                <Button onClick={onCancel} disabled={deploying}>{dialogProps.cancelButtonName || 'Cancel'}</Button>
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
    setDeploymentConfig: PropTypes.func
};

export default OneClickDeploymentDialog;
