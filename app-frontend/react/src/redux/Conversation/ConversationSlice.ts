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

let source: string[] = [];
let content: any[] = [];
let currentTool: string = "";
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

  function isJsonParsable(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  }

  let result = "";
  currentAgentSteps = []; // Reset steps for this message

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
        if (msg?.data !== "[DONE]") {
          if (isJsonParsable(msg.data)) {
            isAgent = true;
            store.dispatch(setIsAgent(true));
            const currentMsg = JSON.parse(msg.data);
            if (currentMsg.tool || currentMsg.source || currentMsg.content) {
              currentAgentSteps.push({
                tool: currentMsg.tool || currentTool,
                content: currentMsg.content || [],
                source: currentMsg.source || [],
              });
            }
            currentTool = currentMsg.tool? currentMsg.tool: "";
            source = currentMsg.source? currentMsg.source: "";
            if (currentMsg.content) {
              content = [...content, ...currentMsg.content];
              result = currentMsg.content[0];
            }
            console.log(currentMsg);
            console.log("currentTool", currentTool);
            console.log("source", source);
            console.log("content", content);
          } else {
            try {
              const match = msg.data.match(/b'([^']*)'/);
              if (match && match[1] !== "</s>") {
                const extractedText = match[1];
                if (extractedText.includes("\\x")) {
                  const decodedText = decodeEscapedBytes(extractedText);
                  result += decodedText;
                } else {
                  result += extractedText;
                }
              } else if (!match) {
                result += msg?.data;
              }
              if (result) {
                store.dispatch(setOnGoingResult(result));
              }
            } catch (e) {
              console.log("something wrong in msg", e);
              throw e;
            }
          }
        } else {
          if (isAgent) {
            console.log("final answer:", result);
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
        store.dispatch(setOnGoingResult(""));
        console.log("onclose", result);
        store.dispatch(
          addMessageToMessages({
            role: MessageRole.Assistant,
            content: result,
            time: getCurrentTimeStamp(),
            agentSteps: [...currentAgentSteps], // Store steps with this message
          }),
        );
        currentAgentSteps = []; // Clear steps for the next message
        isAgent = false;
        store.dispatch(setIsAgent(false));
      },
    });
  } catch (err) {
    console.log(err);
  }
};

function decodeEscapedBytes(str: string): string {
  const byteArray: number[] = str
    .split("\\x")
    .slice(1)
    .map((byte: string) => parseInt(byte, 16));
  return new TextDecoder("utf-8").decode(new Uint8Array(byteArray));
}

export const getCurrentAgentSteps = () => currentAgentSteps; // Export for use in Conversation.tsx