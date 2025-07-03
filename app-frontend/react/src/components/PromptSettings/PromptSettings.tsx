import { useEffect, useState } from "react";

// import DropDown from "@components/DropDown/DropDown";
import CustomSlider from "@components/PromptSettings_Slider/Slider";
import { Box, Collapse, FormGroup, FormControlLabel, FormLabel, IconButton, TextareaAutosize } from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import styles from "./PromptSettings.module.scss";
import TokensInput from "@components/PromptSettings_Tokens/TokensInput";
import FileInput from "@components/File_Input/FileInput";
// import WebInput from "@components/Summary_WebInput/WebInput";

import { useAppDispatch, useAppSelector } from "@redux/store";
import { Model } from "@redux/Conversation/Conversation";
import {
  conversationSelector,
  setModel,
  setSourceType,
  setTemperature,
  setToken,
  setSystemPrompt,
} from "@redux/Conversation/ConversationSlice";

interface AvailableModel {
  name: string;
  value: string;
}

interface PromptSettingsProps {
  readOnly?: boolean;
}

const PromptSettings: React.FC<PromptSettingsProps> = ({
  readOnly = false,
}) => {
  const dispatch = useAppDispatch();

  const { models, type, sourceType, model, token, maxToken, temperature, systemPrompt } =
    useAppSelector(conversationSelector);

  const [tokenError, setTokenError] = useState(false);
  const [isSystemPromptOpen, setIsSystemPromptOpen] = useState(false);

  const filterAvailableModels = (): AvailableModel[] => {
    if (!models || !type) return [];

    let typeModels: AvailableModel[] = [];

    models.map((model: Model) => {
      if (model.types.includes(type)) {
        typeModels.push({
          name: model.displayName,
          value: model.model_name,
        });
      }
    });

    return typeModels;
  };

  const [formattedModels, setFormattedModels] = useState<AvailableModel[]>(
    filterAvailableModels(),
  );

  useEffect(() => {
    setFormattedModels(filterAvailableModels());
  }, [type, models]);

  useEffect(() => {
    if (!model) return;
    setTokenError(token > maxToken);
  }, [model, token]);

  useEffect(() => {
    // console.log("System Prompt Opened: ", isSystemPromptOpen);
  }, [isSystemPromptOpen]);

  const updateTemperature = (value: number) => {
    dispatch(setTemperature(Number(value)));
  };

  const updateTokens = (value: number) => {
    dispatch(setToken(Number(value)));
  };

  const updateSystemPrompt = (value: string) => {
    dispatch(setSystemPrompt(value));
  };

  // const updateModel = (value: string) => {
  //   const selectedModel = models.find(
  //     (model: Model) => model.model_name === value,
  //   );
  //   if (selectedModel) {
  //     dispatch(setModel(selectedModel));
  //   }
  // };

  const updateSource = (value: string) => {
    dispatch(setSourceType(value));
  };

  const cursorDisable = () => {
    return readOnly ? { pointerEvents: "none" } : {};
  };

  const displaySummarySource = () => {
    if ((type !== "summary" && type !== "faq") || readOnly) return;

    let input = null;
    // if (sourceType === "documents") input = <FileInput maxFileCount={1} />;
    // if (sourceType === "web") input = <WebInput />;
    // if (sourceType === "images" && type === "summary")
    //   input = <FileInput imageInput={true} />;
    input = <FileInput maxFileCount={1} summaryInput />;

    return <div className={styles.summarySource}>
      {input}
      </div>;
  };

  // in the off chance specific types do not use these,
  // they have been pulled into their own function
  const tokenAndTemp = () => {
    return (
      <>
      <Box sx={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
        <IconButton
          onClick={() => setIsSystemPromptOpen(!isSystemPromptOpen)}
          sx={{ padding: '0.5rem' }}
          disabled={readOnly}
        >
          {isSystemPromptOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
        <FormLabel sx={{ alignSelf: 'center', fontSize: '13px', fontWeight: 400 }}>
          Inference Settings
        </FormLabel>
      </Box>
      <Collapse in={isSystemPromptOpen} sx={{ width: '90%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '0.5rem', backgroundColor: '#f2f3ff'}}>
          <FormGroup sx={{ marginRight: "1.5rem" }}>
            <FormControlLabel
              sx={cursorDisable()}
              control={
                <Box sx={{ marginLeft: "0.5rem" }}>
                  <TokensInput
                    value={token}
                    handleChange={updateTokens}
                    error={tokenError}
                    readOnly={readOnly}
                  />
                </Box>
              }
              label={`Tokens${readOnly ? ": " : ""}`}
              labelPlacement="start"
            />
          </FormGroup>

          <FormGroup>
            <FormControlLabel
              sx={cursorDisable()}
              control={
                <CustomSlider
                  value={temperature}
                  handleChange={updateTemperature}
                  readOnly={readOnly}
                />
              }
              label={`Temperature${readOnly ? ": " : ""}`}
              labelPlacement="start"
            />
          </FormGroup>
        </Box>
        {
          type === "chat" && 
            <FormGroup sx={{ width: '100%', marginTop: '0.5rem',  backgroundColor: '#f2f3ff' }}>
              <FormControlLabel
                sx={cursorDisable()}
                control={
                  <TextareaAutosize
                    minRows={3}
                    maxRows={30}
                    value={systemPrompt}
                    onChange={(e) => updateSystemPrompt(e.target.value)}
                    disabled={readOnly}
                    className={styles.systemPromptTextarea}
                    placeholder="Enter system prompt here..."
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                }
                label="System Prompt"
                labelPlacement="start"
              />
            </FormGroup>
        }
      </Collapse>
      </>
    );
  };

  // const displaySettings = () => {
  //   if (type === "summary" || type === "faq") {
  //     //TODO: Supporting only documents to start
  //     return (
  //       <>
  //         <FormGroup sx={{ marginRight: "1.5rem", marginTop: "2rem" }}>
  //           <FormControlLabel
  //             sx={cursorDisable()}
  //             control={
  //               <DropDown
  //                 options={[
  //                   { name: "Web", value: "web" },
  //                   { name: "Documents", value: "documents" },
  //                   { name: "Images", value: "images" },
  //                 ]}
  //                 border={true}
  //                 value={sourceType}
  //                 handleChange={updateSource}
  //               />
  //             }
  //             label="Summary Source"
  //             labelPlacement="start"
  //           />
  //         </FormGroup>
  //       </>
  //     );
  //   } else {
  //     return <></>; // tokenAndTemp() // see line 113, conditional option
  //   }
  // };

  return (
    <Box className={styles.promptSettingsWrapper}>
      <Box
        className={`${styles.promptSettings} ${readOnly ? styles.readOnly : ""}`}
      >
        {/* {formattedModels && formattedModels.length > 0 && (
          <FormGroup key={formattedModels[0].name}>
            <FormControlLabel
              sx={cursorDisable()}
              control={
                <DropDown
                  options={formattedModels}
                  value={model}
                  handleChange={updateModel}
                  readOnly={readOnly}
                  border={true}
                  ellipsis={true}
                />
              }
              label={`Model${readOnly ? ": " : ""}`}
              labelPlacement="start"
            />
          </FormGroup>
        )} */}

        {tokenAndTemp()}
      </Box>

      {/* TODO: Expand source options and show label with dropdown after expansion */}
      {/* {displaySettings()} */}

      {displaySummarySource()}
    </Box>
  );
};

export default PromptSettings;
