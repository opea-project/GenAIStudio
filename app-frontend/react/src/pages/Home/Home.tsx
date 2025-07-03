import { Button, Typography, Grid2, styled } from "@mui/material";
// import { AtomIcon, AtomAnimation } from "@icons/Atom";
import PrimaryInput from "@components/PrimaryInput/PrimaryInput";
import config from "@root/config";
import PromptSettings from "@components/PromptSettings/PromptSettings";
import { UI_SELECTION } from "@root/config";
import styles from "./Home.module.scss";

import { useNavigateWithQuery } from "@utils/navigationAndAxiosWithQuery";
import { useAppDispatch, useAppSelector } from "@redux/store";
// import { userSelector } from "@redux/User/userSlice";
import {
  conversationSelector,
  setType,
  newConversation,
} from "@redux/Conversation/ConversationSlice";
import { useEffect } from "react";

interface InitialStateProps {
  initialMessage: string;
}

const HomeButton = styled(Button)(({ theme }) => ({
  ...theme.customStyles.homeButtons,
}));

const HomeTitle = styled(Typography)(({ theme }) => ({
  ...theme.customStyles.homeTitle,
}));

const Home = () => {
  // const { disclaimer } = config;
  const enabledUI = UI_SELECTION
    ? UI_SELECTION.split(",").map((item) => item.trim())
    : ["chat", "summary", "code"];
    
  console.log("Enabled UI:", enabledUI);

  const { type, types, token, model, temperature } =
    useAppSelector(conversationSelector);
  const dispatch = useAppDispatch();

  // const { name } = useAppSelector(userSelector);

  const navigateWithQuery = useNavigateWithQuery();

  const handleSendMessage = async (messageContent: string) => {
    const initialState: InitialStateProps = {
      initialMessage: messageContent,
    };
    navigateWithQuery(`/${type}/new`, { state: initialState });
  };

  const handleTypeChange = (updateType: string) => {
    dispatch(setType(updateType));
  };

  useEffect(() => {
    // clean up and reset. Can happen on going home from history/upload convo
    // if convo is missing one of these
    if (!model || !token || !temperature) {
      dispatch(newConversation(true));
    }
  }, []);

  return (
    <div className={styles.homeView}>
      {/* <AtomAnimation/> */}
      {/* <AtomIcon /> */}

      <HomeTitle className={styles.title} variant="h1">
        Hi, {config.tagline}
      </HomeTitle>

      <Grid2 className={styles.buttonRow} container spacing={2}>
        {types.map((interactionType, index) => (
          enabledUI.includes(interactionType.key) &&
          (
            <HomeButton
              key={index}
              onClick={() => handleTypeChange(interactionType.key)}
              aria-selected={type === interactionType.key}
              startIcon={
                <interactionType.icon sx={{ fill: interactionType.color }} />
              }
              variant="contained"
            >
              {interactionType.name}
            </HomeButton>
          )
        ))}
      </Grid2>

      <div className={styles.inputContainer}>
        <PrimaryInput onSend={handleSendMessage} home={true} />
      </div>

      <div className={styles.promptWrapper}>
        <PromptSettings />
      </div>

      {/* <div
        className={styles.disclaimer}
        dangerouslySetInnerHTML={{ __html: disclaimer }}
      /> */}
    </div>
  );
};

export default Home;
