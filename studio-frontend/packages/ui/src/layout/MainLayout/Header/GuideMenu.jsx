import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import QuickStartGuide from './QuickStartGuide'

export default function GuideMenu() {
  const { t, i18n } = useTranslation()
  const [anchorEl, setAnchorEl] = useState(null)
  const [openGuide, setOpenGuide] = useState(false)

  // 帮助文档链接
  const docUrl =
    i18n.language === 'zh' || i18n.language === 'zh-CN'
      ? 'https://jcnrbltnfs8d.feishu.cn/wiki/RTufw8Q44iNHKtkNRBFcOC5Bnxe'
      : 'https://opea-project.github.io/'

  const handleMenuOpen = (event) => setAnchorEl(event.currentTarget)
  const handleMenuClose = () => setAnchorEl(null)

  return (
    <>
      <Button
        variant="contained"
        onClick={handleMenuOpen}
        // sx={{ ml: 2, minWidth: 40, fontWeight: 600 }}
        sx={{
            minWidth: 90,      // 宽度保持一致
            height: 35,
            fontWeight: 500,   // 字体加粗
            borderRadius: 2,   // 圆角风格
            boxShadow: '0 2px 8px 0 #1d5de780', // 可选阴影
            px: 0,             // 内边距
            ml: 1
          }}
      >
        {t('topbar.guide')}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            setOpenGuide(true)
            handleMenuClose()
          }}
        >
          {t('topbar.guide')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            window.open(docUrl, '_blank')
            handleMenuClose()
          }}
        >
          {t('topbar.doc')}
        </MenuItem>
      </Menu>
      {/* 入门教学弹窗 */}
      <QuickStartGuide open={openGuide} onClose={() => setOpenGuide(false)} />
    </>
  )
}
