// Copyright (C) 2024 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { IconAi, IconUser } from "@tabler/icons-react";
import style from "./conversationMessage.module.scss";
import { Badge, Card, Loader, Text, Tooltip, Button, Collapse, Flex } from "@mantine/core";
import { DateTime } from "luxon";
import { useState } from 'react';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { AgentStep } from '../../redux/Conversation/ConversationSlice';

export interface ConversationMessageProps {
  message: string;
  human: boolean;
  date: number;
  tokenCount?: number;
  tokenRate?: number;
  elapsedTime?: number;
  agentSteps: AgentStep[];
}

export function ConversationMessage({ human, message, date, elapsedTime, tokenCount, tokenRate, agentSteps }: ConversationMessageProps) {
  const dateFormat = () => {
    return DateTime.fromJSDate(new Date(date)).toLocaleString(DateTime.DATETIME_MED);
  };

  const [showThoughts, setShowThoughts] = useState<boolean>(true);

  return (
    <div className={style.conversationMessage}>
      <Flex align="flex-start" gap="md" mb="sm">
        {human ? <IconUser size={20} /> : <IconAi size={20} />}
        
        <div>
          <Text size="sm" fw={500}>
            {human ? "You" : "Assistant"}
          </Text>
          <Text size="xs" c="gray.6">
            {dateFormat()}
          </Text>
        </div>
      </Flex>

      {!human && (
        <div style={{ marginLeft: 34 }}>
          <Button
            variant="light"
            size="xs"
            radius="xl"
            onClick={() => setShowThoughts(!showThoughts)}
            rightSection={showThoughts ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
            mb="xs"
          >
            {showThoughts ? "Hide Thinking" : "Show Thinking"}
          </Button>
          <Collapse in={showThoughts} mb="md">
            {agentSteps.length > 0 ? (
              agentSteps.map((step, index) => (
                <Card 
                  key={`step_${index}`}
                  shadow="sm" 
                  padding="md" 
                  radius="md" 
                  withBorder 
                  style={{ maxWidth: "80%", marginBottom: "10px" }}
                >
                  <Card.Section p="sm" bg="gray.1">
                    <Badge color="blue" style={{ marginRight: "10px" }}>
                      Step {index + 1}
                    </Badge>
                    {step.tool && (
                      <Badge variant="light">
                        Tool: {step.tool}
                      </Badge>
                    )}
                  </Card.Section>
                  {step.content.length > 0 && (
                    <Text size="sm" c="gray.6" mt="xs">
                      Content: {step.content.join(", ")}
                    </Text>
                  )}
                  {step.source.length > 0 && (
                    <Text size="sm" c="gray.6" mt="xs">
                      Source: {step.source.join(", ")}
                    </Text>
                  )}
                </Card>
              ))
            ) : (
              <Card 
                shadow="sm" 
                padding="md" 
                radius="md" 
                withBorder 
                style={{ maxWidth: "80%" }}
              >
                <Text size="sm" c="gray.6" mt="xs">
                  Thinking...
                </Text>
              </Card>
            )}
          </Collapse>
        </div>
      )}

      <Text 
        pl={34} 
        size="sm" 
        style={{ 
          whiteSpace: 'pre-wrap',
          maxWidth: "90%"
        }}
      >
        {human ? message : message === "..." ? <Loader size="xs" /> : message}
      </Text>

      {!human && elapsedTime !== undefined && tokenCount !== undefined && tokenRate !== undefined && (
        <Tooltip.Floating 
          label="Tokens/s is calculated by the frontend application with network latency taken into account."
          color="blue"
        >
          <Text pl={34} size="xs" c="gray.5" mt="xs">
            Time: {elapsedTime.toFixed(2)}s • Tokens: {tokenCount} • {tokenRate.toFixed(2)} tokens/s
          </Text>
        </Tooltip.Floating>
      )}
    </div>
  );
}