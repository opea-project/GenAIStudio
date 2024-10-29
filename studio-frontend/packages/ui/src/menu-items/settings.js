// assets
import {
    IconTrash,
    IconFileUpload,
    IconFileExport,
    IconCopy,
    IconMessage,
    IconDatabaseExport,
    IconAdjustmentsHorizontal,
    IconUsers,
    IconTemplate
} from '@tabler/icons-react'

import FileCopyIcon from '@mui/icons-material/FileCopy'
import IosShareIcon from '@mui/icons-material/IosShare';
import FileDeleteIcon from '@mui/icons-material/Delete'
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';

// constant
const icons = {
    IconTrash,
    IconFileUpload,
    IconFileExport,
    IconCopy,
    IconMessage,
    IconDatabaseExport,
    IconAdjustmentsHorizontal,
    IconUsers,
    IconTemplate,
    FileCopyIcon,
    IosShareIcon,
    FileDeleteIcon,
    VerticalAlignBottomIcon
}

// ==============================|| SETTINGS MENU ITEMS ||============================== //

const settings = {
    id: 'settings',
    title: '',
    type: 'group',
    children: [
        // {
        //     id: 'viewMessages',
        //     title: 'View Messages',
        //     type: 'item',
        //     url: '',
        //     icon: icons.IconMessage
        // },
        // {
        //     id: 'viewLeads',
        //     title: 'View Leads',
        //     type: 'item',
        //     url: '',
        //     icon: icons.IconUsers
        // },
        // {
        //     id: 'viewUpsertHistory',
        //     title: 'Upsert History',
        //     type: 'item',
        //     url: '',
        //     icon: icons.IconDatabaseExport
        // },
        // {
        //     id: 'chatflowConfiguration',
        //     title: 'Configuration',
        //     type: 'item',
        //     url: '',
        //     icon: icons.IconAdjustmentsHorizontal
        // },
        // {
        //     id: 'saveAsTemplate',
        //     title: 'Save As Template',
        //     type: 'item',
        //     url: '',
        //     icon: icons.IconTemplate
        // },
        {
            id: 'duplicateChatflow',
            title: 'Duplicate Workflow',
            type: 'item',
            url: '',
            icon: icons.FileCopyIcon
        },
        {
            id: 'loadChatflow',
            title: 'Import Workflow',
            type: 'item',
            url: '',
            icon: icons.VerticalAlignBottomIcon
        },
        {
            id: 'exportChatflow',
            title: 'Export Workflow',
            type: 'item',
            url: '',
            icon: icons.IosShareIcon
        },
        {
            id: 'deleteChatflow',
            title: 'Delete Workflow',
            type: 'item',
            url: '',
            icon: icons.FileDeleteIcon
        }
    ]
}

export default settings
