// Copyright (C) 2024 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { RootState, store } from "../store";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { Message, MessageRole, ConversationReducer, ConversationRequest } from "./Conversation";
import { getCurrentTimeStamp, uuidv4 } from "../../common/util";
import { createAsyncThunkWrapper } from "../thunkUtil";
import client from "../../common/client";
import { notifications } from "@mantine/notifications";
import { CHAT_QNA_URL, DATA_PREP_URL } from "../../config";
// import { useState } from 'react';

export interface FileDataSource {
  id: string;
  sources: string[];
  type: 'Files' | 'URLs';
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  startTime: number;
}

export interface AgentStep {
  tool: string;
  content: any[];
  source: string[];
}

const initialState: ConversationReducer = {
  conversations: [],
  selectedConversationId: "",
  onGoingResult: "",
  fileDataSources: [] as FileDataSource[],
  isAgent: false,
};

export const ConversationSlice = createSlice({
  name: "Conversation",
  initialState,
  reducers: {
    logout: (state) => {
      state.conversations = [];
      state.selectedConversationId = "";
      state.onGoingResult = "";
      state.isAgent = false;
    },
    setOnGoingResult: (state, action: PayloadAction<string>) => {
      state.onGoingResult = action.payload;
    },
    addMessageToMessages: (state, action: PayloadAction<Message>) => {
      const selectedConversation = state.conversations.find((x) => x.conversationId === state.selectedConversationId);
      selectedConversation?.Messages?.push(action.payload);
    },
    newConversation: (state) => {
      state.selectedConversationId = "";
      state.onGoingResult = "";
      state.isAgent = false;
    },
    createNewConversation: (state, action: PayloadAction<{ title: string; id: string; message: Message }>) => {
      state.conversations.push({
        title: action.payload.title,
        conversationId: action.payload.id,
        Messages: [action.payload.message],
      });
    },
    setSelectedConversationId: (state, action: PayloadAction<string>) => {
      state.selectedConversationId = action.payload;
    },
    addFileDataSource: (state, action: PayloadAction<{ id: string; source: string[]; type: 'Files' | 'URLs'; startTime: number }>) => {
      state.fileDataSources.push({
        id: action.payload.id,
        source: action.payload.source,
        type: action.payload.type,
        startTime: action.payload.startTime,
        status: 'pending',
      });
    },
    clearFileDataSources: (state) => {  
      state.fileDataSources = [];
    },
    updateFileDataSourceStatus: (state, action: PayloadAction<{ id: string; status: 'pending' | 'uploading' | 'uploaded' | 'failed' }>) => {
      const fileDataSource = state.fileDataSources.find((item: FileDataSource) => item.id === action.payload.id);
      if (fileDataSource) {
        fileDataSource.status = action.payload.status;
      }
    },
    setIsAgent: (state, action: PayloadAction<boolean>) => {
      state.isAgent = action.payload;
    },
  },
  extraReducers(builder) {
    builder.addCase(uploadFile.fulfilled, () => {
      notifications.update({
        id: "upload-file",
        message: "File Uploaded Successfully",
        loading: false,
        autoClose: 3000,
      });
    });
    builder.addCase(uploadFile.rejected, () => {
      notifications.update({
        color: "red",
        id: "upload-file",
        message: "Failed to Upload file",
        loading: false,
      });
    });
    builder.addCase(submitDataSourceURL.fulfilled, () => {
      notifications.show({
        message: "Submitted Successfully",
      });
    });
    builder.addCase(submitDataSourceURL.rejected, () => {
      notifications.show({
        color: "red",
        message: "Submit Failed",
      });
    });
  },
});

export const submitDataSourceURL = createAsyncThunkWrapper(
  "conversation/submitDataSourceURL",
  async ({ link_list }: { link_list: string[] }, { dispatch }) => {
    const id = uuidv4();
    dispatch(updateFileDataSourceStatus({ id, status: 'uploading' }));

    try {
      const body = new FormData();
      body.append("link_list", JSON.stringify(link_list));
      const response = await client.post(`${DATA_PREP_URL}/ingest`, body);
      return response.data;
    } catch (error) {
      console.log("error", error);
      throw error;
    }
  },
);

export const uploadFile = createAsyncThunkWrapper("conversation/uploadFile", async ({ file }: { file: File }) => { 
  try {
    const body = new FormData();
    body.append("files", file);

    notifications.show({
      id: "upload-file",
      message: "uploading File",
      loading: true,
    });
    const response = await client.post(`${DATA_PREP_URL}/ingest`, body);
    return response.data;
  } catch (error) {
    throw error;
  }
});

export const {
  logout,
  setOnGoingResult,
  newConversation,
  addMessageToMessages,
  setSelectedConversationId,
  createNewConversation,
  addFileDataSource,
  updateFileDataSourceStatus,
  clearFileDataSources,
  setIsAgent,
} = ConversationSlice.actions;

export const conversationSelector = (state: RootState) => state.conversationReducer;
export const fileDataSourcesSelector = (state: RootState) => state.conversationReducer.fileDataSources;
export const isAgentSelector = (state: RootState) => state.conversationReducer.isAgent;

export default ConversationSlice.reducer;

// let source: string[] = [];
// let content: any[] = [];
// let currentTool: string = "";
let isAgent: boolean = false;
let currentAgentSteps: AgentStep[] = []; // Temporary storage for steps during streaming

export const doConversation = (conversationRequest: ConversationRequest) => {
  const { conversationId, userPrompt, messages, model, maxTokens, temperature } = conversationRequest;
  if (!conversationId) {
    const id = uuidv4();
    store.dispatch(
      createNewConversation({
        title: userPrompt.content,
        id,
        message: userPrompt,
      }),
    );
    store.dispatch(setSelectedConversationId(id));
  } else {
    store.dispatch(addMessageToMessages(userPrompt));
  }

  const userPromptWithoutTime = {
    role: userPrompt.role,
    content: userPrompt.content,
  };
  const body = {
    messages: [...messages, userPromptWithoutTime],
    model: model,
    max_tokens: maxTokens,
    temperature: temperature,
    stream: true,
  };

  let result = ""; // Accumulates the final answer
  let thinkBuffer = ""; // Accumulates data for think blocks
  let postThinkBuffer = ""; // Accumulates plain text after last </think>
  let isInThink = false; // Tracks if we're inside a <think> block
  currentAgentSteps = []; // Reset steps for this message
  isAgent = false; // Tracks if this is an agent message (set once, never reset)
  let isMessageDispatched = false; // Tracks if the final message has been dispatched

  try {
    console.log("CHAT_QNA_URL", CHAT_QNA_URL);
    fetchEventSource(CHAT_QNA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      openWhenHidden: true,
      async onopen(response) {
        if (response.ok) {
          return;
        } else if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          const e = await response.json();
          console.log(e);
          throw Error(e.error.message);
        } else {
          console.log("error", response);
        }
      },
      onmessage(msg) {
        if (msg?.data === "[DONE]") {
          // Stream is done, finalize the message
          if (isAgent && thinkBuffer) {
            processThinkContent(thinkBuffer);
          }
          if (!isMessageDispatched) {
            // Use postThinkBuffer as the final answer if present
            if (postThinkBuffer.trim()) {
              result = postThinkBuffer.trim();
            }
            store.dispatch(setOnGoingResult(result));
            store.dispatch(
              addMessageToMessages({
                role: MessageRole.Assistant,
                content: result,
                time: getCurrentTimeStamp(),
                agentSteps: isAgent ? [...currentAgentSteps] : [],
              }),
            );
            isMessageDispatched = true;
          }
          currentAgentSteps = []; // Clear steps for next message
          postThinkBuffer = "";
          return;
        }

        const data = msg?.data || "";

        // Handle think blocks and non-think content
        if (data.includes("<think>")) {
          if (!isAgent) {
            isAgent = true;
            store.dispatch(setIsAgent(true));
          }
          // Split on <think> to handle content before it
          const parts = data.split("<think>");
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === 0 && !isInThink && part) {
              // Content before <think> (non-think)
              postThinkBuffer += part;
              if (isAgent) {
                store.dispatch(setOnGoingResult(postThinkBuffer));
              } else {
                result += part;
                store.dispatch(setOnGoingResult(result));
              }
            } else {
              // Start or continue think block
              isInThink = true;
              thinkBuffer += part;
              // Check if part contains </think>
              if (part.includes("</think>")) {
                const [thinkContent, afterThink] = part.split("</think>", 2);
                thinkBuffer = thinkBuffer.substring(0, thinkBuffer.indexOf(part)) + thinkContent;
                processThinkContent(thinkBuffer);
                thinkBuffer = "";
                isInThink = false;
                if (afterThink) {
                  // Handle content after </think> as non-think
                  if (!afterThink.includes("<think>")) {
                    postThinkBuffer += afterThink;
                    store.dispatch(setOnGoingResult(postThinkBuffer));
                  } else {
                    thinkBuffer = afterThink;
                    isInThink = true;
                  }
                }
              }
            }
          }
        } else if (isInThink) {
          // Accumulate within think block
          thinkBuffer += data;
          if (data.includes("</think>")) {
            const [thinkContent, afterThink] = data.split("</think>", 2);
            thinkBuffer = thinkBuffer.substring(0, thinkBuffer.lastIndexOf(data)) + thinkContent;
            processThinkContent(thinkBuffer);
            thinkBuffer = "";
            isInThink = false;
            if (afterThink) {
              // Handle content after </think>
              if (!afterThink.includes("<think>")) {
                postThinkBuffer += afterThink;
                store.dispatch(setOnGoingResult(postThinkBuffer));
              } else {
                thinkBuffer = afterThink;
                isInThink = true;
              }
            }
          }
        } else {
          // Non-agent or post-think plain text
          if (isAgent) {
            postThinkBuffer += data;
            store.dispatch(setOnGoingResult(postThinkBuffer));
          } else {
            result += data;
            store.dispatch(setOnGoingResult(result));
          }
        }
      },
      onerror(err) {
        console.log("error", err);
        store.dispatch(setOnGoingResult(""));
        throw err;
      },
      onclose() {
        if (!isMessageDispatched && (result || postThinkBuffer || (isAgent && currentAgentSteps.length > 0))) {
          // Use postThinkBuffer as the final answer if present
          if (postThinkBuffer.trim()) {
            result = postThinkBuffer.trim();
          }
          store.dispatch(setOnGoingResult(result));
          store.dispatch(
            addMessageToMessages({
              role: MessageRole.Assistant,
              content: result,
              time: getCurrentTimeStamp(),
              agentSteps: isAgent ? [...currentAgentSteps] : [],
            }),
          );
          isMessageDispatched = true;
        }
        store.dispatch(setOnGoingResult(""));
        currentAgentSteps = [];
        postThinkBuffer = "";
      },
    });
  } catch (err) {
    console.log(err);
  }

  // Helper function to process content within <think> tags
  function processThinkContent(content: string) {
    content = content.trim();
    if (!content) return;

    const toolCallRegex = /TOOL CALL: (\{.*?\})/g;
    const finalAnswerRegex = /FINAL ANSWER: (\{.*?\})/;
    let stepContent: string[] = []; // Collect all reasoning for this think block
    let tool: string = "reasoning"; // Default tool
    let source: string[] = []; // Tool output

    // Split content by final answer (if present)
    let remainingContent = content;
    const finalAnswerMatch = content.match(finalAnswerRegex);
    if (finalAnswerMatch) {
      try {
        const finalAnswer = JSON.parse(finalAnswerMatch[1].replace("FINAL ANSWER: ", ""));
        if (finalAnswer.answer) {
          result = finalAnswer.answer;
        }
        remainingContent = content.split(finalAnswerMatch[0])[0].trim(); // Content before FINAL ANSWER
        tool = "final_answer";
      } catch (e) {
        console.error("Error parsing final answer:", finalAnswerMatch[1], e);
      }
    }

    // Process tool calls within the remaining content
    const toolMatches = remainingContent.match(toolCallRegex) || [];
    let currentContent = remainingContent;

    if (toolMatches.length > 0) {
      // Handle content before and after tool calls
      toolMatches.forEach((toolCallStr) => {
        const [beforeTool, afterTool] = currentContent.split(toolCallStr, 2);
        if (beforeTool.trim()) {
          stepContent.push(beforeTool.trim());
        }

        try {
          // Attempt to parse the tool call JSON
          let toolCall;
          try {
            toolCall = JSON.parse(toolCallStr.replace("TOOL CALL: ", ""));
          } catch (e) {
            console.error("Error parsing tool call JSON, attempting recovery:", toolCallStr, e);
            // Attempt to extract tool and content manually
            const toolMatch = toolCallStr.match(/"tool":\s*"([^"]+)"/);
            const contentMatch = toolCallStr.match(/"tool_content":\s*\["([^"]+)"\]/);
            toolCall = {
              tool: toolMatch ? toolMatch[1] : "unknown",
              args: {
                tool_content: contentMatch ? [contentMatch[1]] : [],
              },
            };
          }

          tool = toolCall.tool || tool;
          source = toolCall.args?.tool_content || source;

          // Clean up afterTool to remove invalid JSON fragments
          if (afterTool.trim()) {
            // Remove any trailing malformed JSON (e.g., "Chinook?"}})
            const cleanAfterTool = afterTool.replace(/[\s\S]*?(\}\s*)$/, "").trim();
            if (cleanAfterTool) {
              stepContent.push(cleanAfterTool);
            }
          }

        } catch (e) {
          console.error("Failed to process tool call:", toolCallStr, e);
          stepContent.push(`[Error parsing tool call: ${toolCallStr}]`);
        }

        currentContent = afterTool;
      });
    } else {
      // No tool calls, treat as reasoning
      if (remainingContent.trim()) {
        stepContent.push(remainingContent.trim());
      }
    }

    // Add the step for this think block
    if (stepContent.length > 0 || source.length > 0) {
      currentAgentSteps.push({
        tool,
        content: stepContent,
        source,
      });
    }

    // Update onGoingResult to trigger UI update with latest steps
    if (isAgent) {
      const latestContent = currentAgentSteps.flatMap(step => step.content).join(" ");
      const latestSource = source.length > 0 ? source.join(" ") : "";
      store.dispatch(setOnGoingResult(latestContent + (latestSource ? " " + latestSource : "") + (postThinkBuffer ? " " + postThinkBuffer : "")));
    }
  }
};

export const getCurrentAgentSteps = () => currentAgentSteps; // Export for use in Conversation.tsx