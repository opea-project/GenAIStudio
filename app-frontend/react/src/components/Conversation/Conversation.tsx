import { KeyboardEventHandler, SyntheticEvent, useEffect, useRef, useState } from 'react'
import styleClasses from "./conversation.module.scss"
import { ActionIcon, Group, rem, Slider, Stack, Text, Textarea, Title, Tooltip } from '@mantine/core'
import { IconArrowRight, IconFilePlus, IconMessagePlus } from '@tabler/icons-react'
import { conversationSelector, doConversation, newConversation } from '../../redux/Conversation/ConversationSlice'
import { ConversationMessage } from '../Message/conversationMessage'
import { useAppDispatch, useAppSelector } from '../../redux/store'
import { Message, MessageRole } from '../../redux/Conversation/Conversation'
import { UiFeatures } from '../../common/Sandbox'
import { getCurrentTimeStamp } from '../../common/util'
import { useDisclosure } from '@mantine/hooks'
import DataSource from './DataSource'
import { ConversationSideBar } from './ConversationSideBar'

type ConversationProps = {
  title: string
  enabledUiFeatures: UiFeatures
}

const Conversation = ({ title, enabledUiFeatures }: ConversationProps) => {
  const [prompt, setPrompt] = useState<string>("")
  const [systemPrompt, setSystemPrompt] = useState<string>("You are a helpful assistant.")
  const promptInputRef = useRef<HTMLTextAreaElement>(null)
  const [fileUploadOpened, { open: openFileUpload, close: closeFileUpload }] = useDisclosure(false)

  const { conversations, onGoingResult, selectedConversationId } = useAppSelector(conversationSelector)
  const dispatch = useAppDispatch()
  const selectedConversation = conversations.find(x => x.conversationId === selectedConversationId)
  const scrollViewport = useRef<HTMLDivElement>(null)

  const [tokenLimit, setTokenLimit] = useState<number>(50)
  const [temperature, setTemperature] = useState<number>(0.30)

  // State for tracking tokens and message processing time
  const [messageTokenData, setMessageTokenData] = useState<{ [key: string]: { tokens: number; rate: number, time: number } }>({})

  const [currentMessageIndex, setCurrentMessageIndex] = useState<number>(-1)
  
  // New state to track the start time for calculating tokens per second
  const [startTime, setStartTime] = useState<number | null>(null)

  // New state to manage the assistant's message placeholder
  const [isAssistantTyping, setIsAssistantTyping] = useState<boolean>(false)

  const toSend = "Enter"

  // const systemPrompt: Partial<Message> = {
  //   role: MessageRole.System,
  //   content: "You are a helpful assistant",
  // }

  const handleSubmit = () => {
    const userPrompt: Message = {
      role: MessageRole.User,
      content: prompt,
      time: getCurrentTimeStamp(),
    }
  
    let messages: Partial<Message>[] = []
    if (selectedConversation) {
      messages = selectedConversation.Messages.map((message) => {
        return { role: message.role, content: message.content }
      })
    }
  
    messages = [{ role: MessageRole.System, content: systemPrompt }, ...messages]
  
    // Initialize token data for the new message
    setMessageTokenData((prev) => ({
      ...prev,
      [`${selectedConversationId}-${selectedConversation?.Messages.length}`]: { tokens: 0, rate: 0, time: 0 },
    }))
  
    // Set the current message index for tracking
    setCurrentMessageIndex(selectedConversation?.Messages.length || 0)
  
    doConversation({
        conversationId: selectedConversationId,
        userPrompt,
        messages,
        maxTokens: tokenLimit,
        temperature: temperature,
        model: "Intel/neural-chat-7b-v3-3",
      })
    setPrompt("")
    setStartTime(Date.now()) // Set start time when the user submits the message
    setIsAssistantTyping(true) // Show the assistant's typing placeholder immediately
  }

  const scrollToBottom = () => {
    scrollViewport.current!.scrollTo({ top: scrollViewport.current!.scrollHeight })
  }

  useEffect(() => {
    // Update token data for the current message
    if (onGoingResult && startTime && currentMessageIndex !== -1) {
      const tokenLength = onGoingResult.split(" ").length // Estimate tokens based on words
      const currentTimestamp = Date.now()
  
      const elapsedTime = (currentTimestamp - startTime) / 1000 // seconds
      const tokenRate = elapsedTime > 0 ? tokenLength / elapsedTime : 0
  
      // Update token data for the current message
      setMessageTokenData((prev) => ({
        ...prev,
        [`${selectedConversationId}-${currentMessageIndex}`]: { tokens: tokenLength, rate: tokenRate, time: elapsedTime },
      }))
  
      setIsAssistantTyping(false)
    }
  
    scrollToBottom()
  }, [onGoingResult, startTime, selectedConversation?.Messages, currentMessageIndex])

  const handleKeyDown: KeyboardEventHandler = (event) => {
    if (!event.shiftKey && event.key === toSend) {
      handleSubmit()
      setTimeout(() => {
        setPrompt("")
      }, 1)
    }
  }

  const handleNewConversation = () => {
    dispatch(newConversation())
  }

  const handleChange = (event: SyntheticEvent) => {
    event.preventDefault()
    setPrompt((event.target as HTMLTextAreaElement).value)
  }

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
                <ActionIcon onClick={handleNewConversation} disabled={onGoingResult != ""} size={32} variant="default">
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
              const messageKey = `${selectedConversationId}-${index-1}`
              const tokenData = messageTokenData[messageKey]
              const elapsedTime = tokenData?.time ?? 0
              const tokens = tokenData?.tokens ?? 0
              const rate = tokenData?.rate ?? 0

              console.log("Message: ", message, "Message Key: ", messageKey, "Token Data: ", tokenData)

              return (
                <ConversationMessage
                  key={`message_${index}`}
                  date={message.time * 1000}
                  human={message.role === MessageRole.User}
                  message={message.content}
                  elapsedTime={message.role === MessageRole.Assistant ? elapsedTime : undefined}
                  tokenCount={message.role === MessageRole.Assistant ? tokens : undefined}
                  tokenRate={message.role === MessageRole.Assistant ? rate : undefined}
                />
              )
            })}

            {selectedConversation && isAssistantTyping && (
              <ConversationMessage
                key={`_ai_placeholder`}
                date={Date.now()}
                human={false}
                message={"..."} // Placeholder text while the response is being generated
                elapsedTime={0} // Start with 0 seconds
                tokenCount={0} // Start with 0 tokens
                tokenRate={0} // Start with 0 tokens per second
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
              />
            )}           
          </div>

          <div className={styleClasses.conversatioSliders}>
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
  )
}

export default Conversation
