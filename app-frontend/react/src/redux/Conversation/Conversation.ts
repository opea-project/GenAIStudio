// Copyright (C) 2024 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

export type ConversationRequest = {
  conversationId: string;
  userPrompt: Message;
  messages: Partial<Message>[];
  model: string;
  maxTokens: number;
  temperature: number;
  // setIsInThinkMode: (isInThinkMode: boolean) => void;
};

export enum MessageRole {
  Assistant = "assistant",
  User = "user",
  System = "system",
}

export interface Message {
  role: MessageRole;
  content: string;
  time: number;
  agentSteps?: AgentStep[]; // Optional, only for assistant messages
}

export interface Conversation {
  conversationId: string;
  title?: string;
  Messages: Message[];
}

export interface AgentStep {
  tool: string;
  content: any[];
  source: string[];
}

export interface ConversationReducer {
  selectedConversationId: string;
  conversations: Conversation[];
  onGoingResult: string;
  fileDataSources: any;
  isAgent: boolean;
}