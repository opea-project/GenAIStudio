import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import step1Create from '../../../assets/step1-create.svg';
import step1Import from '../../../assets/step1-import.svg';
import node1 from '../../../assets/node-input.svg';
import node2 from '../../../assets/node-add.svg';
import node3 from '../../../assets/node-config.svg';
import node4 from '../../../assets/node-connect.svg';
import node5 from '../../../assets/node-save.svg';
import run1 from '../../../assets/node-run1.svg';
import run2 from '../../../assets/run2.svg';
import run3 from '../../../assets/run3.svg';
import nodeExtra1 from '../../../assets/node-extra1.svg';
import nodeExtra2 from '../../../assets/node-extra2.svg';
import runExtra from '../../../assets/run-extra.svg';

import {
  Box,
  Button,
  Typography,
  Dialog,
  DialogContent,
  Grid,
} from "@mui/material";

const icons = {
  create: step1Create,
  import: step1Import,
  node1: node1,
  node2: node2,
  node3: node3,
  node4: node4,
  node5: node5,
  run1: run1,
  run2: run2,
  run3: run3,
  nodeExtra1: nodeExtra1,
  nodeExtra2: nodeExtra2,
  runExtra: runExtra
};

function StepIcon({ icon, label }) {
  return (
    <Box textAlign="center" sx={{ minWidth: 120 }}>
      <img src={icon} alt="" style={{ width: 70, height: 70, marginBottom: 8 }} />
      <Typography fontSize={15}>{label}</Typography>
    </Box>
  );
}

function StepLargeIcon({ icon, label }) {
  return (
    <Box
      textAlign="center"
      borderRadius={3}
      sx={{
        background: "linear-gradient(180deg, #67c8ff 0%, #397eff 100%)",
        boxShadow: "0 4px 18px #ddefff77",
        p: 4,
        minWidth: 210,
        mb: 2,
      }}
    >
      <img src={icon} alt="" style={{ width: 78, height: 78, marginBottom: 12 }} />
      <Typography fontWeight={600} fontSize={18} sx={{ color: "#fff" }}>
        {label}
      </Typography>
    </Box>
  );
}

function StepNumIcon({ icon, num, label }) {
  return (
    <Box
      textAlign="center"
      borderRadius={3}
      sx={{
        background: "linear-gradient(180deg, #67c8ff 0%, #397eff 100%)",
        boxShadow: "0 4px 18px #ddefff77",
        p: 3,
        minWidth: 150,
        mb: 2,
      }}
    >
      <Box display="flex" flexDirection="column" alignItems="center">
        <img src={icon} alt="" style={{ width: 54, height: 54, marginBottom: 6 }} />
        <Typography color="#fff" fontWeight={500}>
          {num < 10 ? `0${num}` : num}
        </Typography>
      </Box>
      <Typography fontSize={15} sx={{ color: "#fff", mt: 1 }}>
        {label}
      </Typography>
    </Box>
  );
}

// StepNav 调整，全部按钮国际化
function StepNav({ prev, next, finish, backHome, isFirst, isLast, t }) {
  return (
    <Box mt={6} display="flex" flexDirection="column" alignItems="center" gap={2}>
      <Box display="flex" gap={2}>
        <Button
          variant="outlined"
          onClick={prev}
          disabled={isFirst}
          sx={{ minWidth: 120 }}
        >
          {t('quickstart.prev')}
        </Button>
        {isLast ? (
          <Button variant="contained" onClick={finish} sx={{ minWidth: 120 }}>
            {t('quickstart.finish')}
          </Button>
        ) : (
          <Button variant="contained" onClick={next} sx={{ minWidth: 120 }}>
            {t('quickstart.next')}
          </Button>
        )}
      </Box>
      <Button variant="text" onClick={backHome} sx={{ mt: 1 }}>
        {t('quickstart.backHome')}
      </Button>
    </Box>
  );
}

// 步骤定义（仅“跳过引导”这步改为直接关闭）
const steps = [
  {
    type: "home",
    render: (t, next, prev, backHome, onClose) => (
      <>
        <Typography variant="h6" align="center" sx={{ mt: 4, mb: 4, fontWeight:600, fontSize:24}}>
          {t("quickstart.homeTitle")}
        </Typography>
        <Box display="flex" justifyContent="center" alignItems="center" gap={8}>
          <StepIcon icon={icons.create} label={t("quickstart.step1Desc")} />
          <Box height={2} width={60} bgcolor="#ddd" borderRadius={1} mx={2} />
          <StepIcon icon={icons.import} label={t("quickstart.step2Desc")} />
          <Box height={2} width={60} bgcolor="#ddd" borderRadius={1} mx={2} />
          <StepIcon icon={icons.node1} label={t("quickstart.step3Desc")} />
        </Box>
        <Box mt={6}>
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={next}
            sx={{ mb: 2 }}
          >
            {t("quickstart.startGuide")}
          </Button>
          <Button fullWidth variant="text" onClick={onClose}>
            {t("quickstart.skipGuide")}
          </Button>
        </Box>
      </>
    ),
  },
  {
    type: "create",
    render: (t, next, prev, backHome, onClose) => (
      <>
        <Typography variant="h6" align="center" sx={{ mt: 4, mb: 4, fontWeight:600, fontSize:22 }}>
          {t("quickstart.step1Title")}
        </Typography>
        <Box display="flex" justifyContent="center" gap={8}>
          <StepLargeIcon icon={icons.create} label={t("quickstart.createNew")} />
          <StepLargeIcon icon={icons.import} label={t("quickstart.importSample")} />
        </Box>
        <StepNav prev={prev} next={next} backHome={backHome} isFirst t={t} />
      </>
    ),
  },
  {
    type: "configure",
    render: (t, next, prev, backHome, onClose) => (
      <>
        <Typography variant="h6" align="center" sx={{ mt: 4, mb: 4, fontWeight:600, fontSize:22 }}>
          {t("quickstart.step2Title")}
        </Typography>
        <Grid container spacing={3} justifyContent="center">
          {[1, 2, 3, 4, 5].map((idx) => (
            <Grid item key={idx}>
              <StepNumIcon
                icon={icons[`node${idx}`]}
                num={idx}
                label={t(`quickstart.chooseNodesDesc${idx}`)}
              />
            </Grid>
          ))}
        </Grid>
        <StepNav prev={prev} next={next} backHome={backHome} t={t} />
      </>
    ),
  },
  {
    type: "monitor",
    render: (t, next, prev, backHome, onClose) => (
      <>
        <Typography variant="h6" align="center" sx={{ mt: 4, mb: 4, fontWeight:600, fontSize:22 }}>
          {t("quickstart.step3Title")}
        </Typography>
        <Grid container spacing={4} justifyContent="center">
          {[1, 2, 3].map((idx) => (
            <Grid item key={idx}>
              <StepNumIcon
                icon={icons[`run${idx}`]}
                num={idx}
                label={t(`quickstart.runAndMonitorDesc${idx}`)}
              />
            </Grid>
          ))}
        </Grid>
        <StepNav prev={prev} finish={onClose} backHome={backHome} isLast t={t} />
      </>
    ),
  },
];

export default function QuickStartGuide({ open, onClose }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  // 每次打开都回到首页
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const next = () => setStep((s) => Math.min(steps.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));
  const backHome = () => setStep(0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md">
      <DialogContent sx={{ minHeight: 480, py: 4 }}>
        {steps[step].render(t, next, prev, backHome, onClose)}
      </DialogContent>
    </Dialog>
  );
}
