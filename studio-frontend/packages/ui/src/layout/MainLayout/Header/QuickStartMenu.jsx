import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Dialog, DialogContent, DialogActions, Box } from "@mui/material";
import QuickStartGuide from "./QuickStartGuide"; // 下方实现
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';

export default function QuickStartMenu() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const openHelpDoc = () => {
    const url = i18n.language === "zh" || i18n.language === "zh-CN"
      ? "https://jcnrbltnfs8d.feishu.cn/wiki/RTufw8Q44iNHKtkNRBFcOC5Bnxe"
      : "https://opea-project.github.io/";
    window.open(url, "_blank");
  };

  return (
    <Box display="flex" alignItems="center" gap={2}>
      <Button
        variant="contained"
        color="primary"
        size="large"
        onClick={() => setOpen(true)}
        startIcon={<PlayCircleOutlineIcon />}
        sx={{ minWidth: 160, fontWeight: 700 }}
      >
        {t("quickstart.quickStart")}
      </Button>
      <Button
        variant="outlined"
        color="primary"
        size="large"
        onClick={openHelpDoc}
        startIcon={<HelpOutlineIcon />}
        sx={{ minWidth: 160, fontWeight: 700 }}
      >
        {t("quickstart.helpDoc")}
      </Button>
      <Dialog open={open} maxWidth="md" fullWidth>
        <QuickStartGuide onClose={() => setOpen(false)} />
      </Dialog>
    </Box>
  );
}
