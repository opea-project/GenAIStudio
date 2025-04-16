// Copyright (C) 2024 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { KeyboardEventHandler, SyntheticEvent, useEffect, useRef, useState } from 'react';
import styleClasses from "./conversation.module.scss";
import { ActionIcon, Button, Collapse, Group, rem, Slider, Stack, Text, Textarea, Title, Tooltip } from '@mantine/core';
import { IconArrowRight, IconChevronDown, IconChevronUp, IconFilePlus, IconMessagePlus } from '@tabler/icons-react';

import { conversationSelector, doConversation, newConversation, isAgentSelector, getCurrentAgentSteps } from '../../redux/Conversation/ConversationSlice';
import { ConversationMessage } from '../Message/conversationMessage';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { Message, MessageRole } from '../../redux/Conversation/Conversation';
import { UiFeatures } from '../../common/Sandbox';
import { getCurrentTimeStamp } from '../../common/util';
import { useDisclosure } from '@mantine/hooks';
import DataSource from './DataSource';
import { ConversationSideBar } from './ConversationSideBar';

type ConversationProps = {
  title: string;
  enabledUiFeatures: UiFeatures;
};

const Conversation = ({ title, enabledUiFeatures }: ConversationProps) => {
  const [prompt, setPrompt] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState<string>("You are a helpful assistant.");
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const [fileUploadOpened, { open: openFileUpload, close: closeFileUpload }] = useDisclosure(false);

  const { conversations, onGoingResult, selectedConversationId } = useAppSelector(conversationSelector);
  const isAgent = useAppSelector(isAgentSelector);
  const dispatch = useAppDispatch();
  const selectedConversation = conversations.find(x => x.conversationId === selectedConversationId);
  const scrollViewport = useRef<HTMLDivElement>(null);

  const [tokenLimit, setTokenLimit] = useState<number>(200);
  const [temperature, setTemperature] = useState<number>(0.30);

  const [messageTokenData, setMessageTokenData] = useState<{ [key: string]: { tokens: number; rate: number; time: number } }>({});
  const [currentMessageIndex, setCurrentMessageIndex] = useState<number>(-1);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isAssistantTyping, setIsAssistantTyping] = useState<boolean>(false);
  const [showInferenceParams, setShowInferenceParams] = useState<boolean>(true);

  const toSend = "Enter";

  const handleSubmit = () => {
    const userPrompt: Message = {
      role: MessageRole.User,
      content: prompt,
      time: getCurrentTimeStamp(),
    };

    let messages: Partial<Message>[] = [];
    if (selectedConversation) {
      messages = selectedConversation.Messages.map((message) => {
        return { role: message.role, content: message.content };
      });
    }

    messages = [{ role: MessageRole.System, content: systemPrompt }, ...messages];

    setMessageTokenData((prev) => ({
      ...prev,
      [`${selectedConversationId}-${selectedConversation?.Messages.length}`]: { tokens: 0, rate: 0, time: 0 },
    }));

    setCurrentMessageIndex(selectedConversation?.Messages.length || 0);

    doConversation({
      conversationId: selectedConversationId,
      userPrompt,
      messages,
      maxTokens: tokenLimit,
      temperature: temperature,
      model: "Intel/neural-chat-7b-v3-3",
    });
    setPrompt("");
    setStartTime(Date.now());
    setIsAssistantTyping(true);
  };

  const scrollToBottom = () => {
    scrollViewport.current!.scrollTo({ top: scrollViewport.current!.scrollHeight });
  };

  useEffect(() => {
    if (onGoingResult && startTime && currentMessageIndex !== -1) {
      let tokenLength: number;
      if (isAgent) {
        const currentSteps = getCurrentAgentSteps();
        const allContent = currentSteps.flatMap(step => step.content).join(" ");
        tokenLength = allContent.split(" ").length;
      } else {
        tokenLength = onGoingResult.split(" ").length;
      }

      const currentTimestamp = Date.now();
      const elapsedTime = (currentTimestamp - startTime) / 1000;
      const tokenRate = elapsedTime > 0 ? tokenLength / elapsedTime : 0;

      setMessageTokenData((prev) => ({
        ...prev,
        [`${selectedConversationId}-${currentMessageIndex}`]: { tokens: tokenLength, rate: tokenRate, time: elapsedTime },
      }));

      setIsAssistantTyping(false);
    }

    scrollToBottom();
  }, [onGoingResult, startTime, selectedConversation?.Messages, currentMessageIndex, isAgent]);

  const handleKeyDown: KeyboardEventHandler = (event) => {
    if (!event.shiftKey && event.key === toSend) {
      handleSubmit();
      setTimeout(() => {
        setPrompt("");
      }, 1);
    }
  };

  const handleNewConversation = () => {
    dispatch(newConversation());
  };

  const handleChange = (event: SyntheticEvent) => {
    event.preventDefault();
    setPrompt((event.target as HTMLTextAreaElement).value);
  };

  return (
    <div className={styleClasses.conversationWrapper}>
      <ConversationSideBar title={title} />
      <div className={styleClasses.conversationContent}>
        <div className={styleClasses.conversationContentMessages}>
          <div className={styleClasses.conversationTitle}>
            <Title order={3}>{selectedConversation?.title || ""} </Title>
            <span className={styleClasses.spacer}></span>
            <Group>
              {selectedConversation && selectedConversation?.Messages.length > 0 && (
                <ActionIcon onClick={handleNewConversation} disabled={onGoingResult !== ""} size={32} variant="default">
                  <IconMessagePlus />
                </ActionIcon>
              )}
              <Tooltip
                label={enabledUiFeatures.dataprep ? "Upload File" : "Data Prep node is not found in the flow."}
                color={enabledUiFeatures.dataprep ? "blue" : "red"}
              >
                <ActionIcon onClick={openFileUpload} size={32} variant="default" disabled={!enabledUiFeatures.dataprep}>
                  <IconFilePlus />
                </ActionIcon>
              </Tooltip>
            </Group>
          </div>

          <div className={styleClasses.historyContainer} ref={scrollViewport}>
            {!selectedConversation && (
              <>
                <div className="infoMessage">Start by asking a question</div>
                <div className="infoMessage">
                  You can also upload your Document by clicking on the Document icon in the top right corner
                </div>
              </>
            )}

            {selectedConversation?.Messages.map((message, index) => {
              const messageKey = `${selectedConversationId}-${index - 1}`;
              const tokenData = messageTokenData[messageKey];
              const elapsedTime = tokenData?.time ?? 0;
              const tokens = tokenData?.tokens ?? 0;
              const rate = tokenData?.rate ?? 0;

              return (
                <ConversationMessage
                  key={`message_${index}`}
                  date={message.time * 1000}
                  human={message.role === MessageRole.User}
                  message={message.content}
                  elapsedTime={message.role === MessageRole.Assistant ? elapsedTime : undefined}
                  tokenCount={message.role === MessageRole.Assistant ? tokens : undefined}
                  tokenRate={message.role === MessageRole.Assistant ? rate : undefined}
                  agentSteps={message.agentSteps || []}
                />
              );
            })}

            {selectedConversation && isAssistantTyping && (
              <ConversationMessage
                key={`_ai_placeholder`}
                date={Date.now()}
                human={false}
                message={"..."}
                elapsedTime={0}
                tokenCount={0}
                tokenRate={0}
                agentSteps={getCurrentAgentSteps()}
              />
            )}

            {onGoingResult && (
              <ConversationMessage
                key={`_ai`}
                date={Date.now()}
                human={false}
                message={onGoingResult}
                elapsedTime={messageTokenData[`${selectedConversationId}-${currentMessageIndex}`]?.time}
                tokenCount={messageTokenData[`${selectedConversationId}-${currentMessageIndex}`]?.tokens}
                tokenRate={messageTokenData[`${selectedConversationId}-${currentMessageIndex}`]?.rate}
                agentSteps={getCurrentAgentSteps()}
              />
            )}
          </div>

          <div className={styleClasses.conversatioSliders}>
          <Button
            variant="light"
            size="xs"
            radius="xl"
            onClick={() => setShowInferenceParams(!showInferenceParams)}
            rightSection={showInferenceParams ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />}
            mb="xs"
          >
            {showInferenceParams ? "Hide Inference Settings" : "Show Inference Settings"}
          </Button>
          <Collapse in={showInferenceParams} mb="md">
            <Stack style={{ marginLeft: '10px' }}>
              <Title size="sm">Inference Settings</Title>
              <Text size="sm">Token Limit: {tokenLimit}</Text>
              <Slider value={tokenLimit} onChange={setTokenLimit} min={10} max={500} step={1} />
              <Text size="sm">Temperature: {temperature.toFixed(2)}</Text>
              <Slider value={temperature} onChange={setTemperature} min={0.10} max={1.00} step={0.01} />
              <Textarea
                label="System Prompt"
                placeholder="Set system prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                size="sm"
                mb="sm"
              />
            </Stack>
          </Collapse>
        </div>


          <div className={styleClasses.conversationActions}>
            <Tooltip
              label={enabledUiFeatures.chat ? "Enter message here" : "Chat Completion node is not found in the flow."}
              color={enabledUiFeatures.chat ? "blue" : "red"}
            >
              <Textarea
                radius="xl"
                size="md"
                placeholder="Ask a question"
                ref={promptInputRef}
                onKeyDown={handleKeyDown}
                onChange={handleChange}
                value={prompt}
                rightSectionWidth={42}
                rightSection={
                  <ActionIcon onClick={handleSubmit} size={32} radius="xl" variant="filled" disabled={!enabledUiFeatures.chat}>
                    <IconArrowRight style={{ width: rem(18), height: rem(18) }} stroke={1.5} />
                  </ActionIcon>
                }
                disabled={!enabledUiFeatures.chat || !!onGoingResult}
              />
            </Tooltip>
          </div>
        </div>
      </div>
      <DataSource opened={fileUploadOpened} onClose={closeFileUpload} />
    </div>
  );
};

export default Conversation;