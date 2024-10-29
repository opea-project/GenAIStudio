// Copyright (C) 2024 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { IconAi, IconUser } from "@tabler/icons-react"
import style from "./conversationMessage.module.scss"
import { Group, Loader, Text, Tooltip } from "@mantine/core"
import { DateTime } from "luxon"

export interface ConversationMessageProps {
  message: string
  human: boolean
  date: number
  tokenCount?: number // Added tokenCount prop
  tokenRate?: number  // Added tokenRate prop
  elapsedTime?: number // Added elapsedTime prop
}

export function ConversationMessage({ human, message, date, elapsedTime, tokenCount, tokenRate }: ConversationMessageProps) {
  const dateFormat = () => {
    return DateTime.fromJSDate(new Date(date)).toLocaleString(DateTime.DATETIME_MED)
  }

  return (
    <div className={style.conversationMessage}>
      <Group>
        {human && <IconUser />}
        {!human && <IconAi />}

        <div>
          <Text size="sm">
            {human ? "You" : "Assistant"}
          </Text>
          <Text size="xs" c="dimmed">
            {dateFormat()}
          </Text>
        </div>
      </Group>

      
      {
        human? (
          <Text pl={54} size="sm">
            {message}
          </Text>
        ) : message === "..." ? (
          <Loader size="xs" />
        ) : (
          <Text pl={54} size="sm">
            {message}
          </Text>
        )
      }

      {!human && elapsedTime !== undefined && tokenCount !== undefined && tokenRate !== undefined && (
        <Tooltip.Floating 
          label="Tokens/s is calculated by the frontend application with network latency taken into account."
          color="blue"
          >
          <Text pl={54} size="xs" c="dimmed">
            End-to-End Time: {elapsedTime.toFixed(2)}s, Tokens: {tokenCount}, Tokens/s: {tokenRate.toFixed(2)}
          </Text>
        </Tooltip.Floating>
      )}
    </div>
  )
}
