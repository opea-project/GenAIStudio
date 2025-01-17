// Copyright (C) 2024 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

// console.log("Environment variables:", import.meta.env);

export const DATA_PREP_URL = import.meta.env.VITE_DATA_PREP_SERVICE_URL;
export const CHAT_QNA_URL = import.meta.env.VITE_CHAT_SERVICE_URL;
export const APP_UUID = import.meta.env.VITE_APP_UUID;

console.log("data prep", DATA_PREP_URL);
console.log("chat qna", CHAT_QNA_URL);

type UiFeatures = {
  dataprep: boolean;
  chat: boolean;
};

export const UI_FEATURES: UiFeatures = {
  dataprep: !!DATA_PREP_URL,
  chat: !!CHAT_QNA_URL
};
