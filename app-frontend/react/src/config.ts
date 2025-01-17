// Copyright (C) 2024 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

// console.log("Environment variables:", import.meta.env);

export const APP_UUID = import.meta.env.VITE_APP_UUID;
export const CHAT_QNA_URL = "VITE_APP_BACKEND_SERVICE_URL";
export const DATA_PREP_URL = "VITE_APP_DATA_PREP_SERVICE_URL";

type UiFeatures = {
  dataprep: boolean;
  chat: boolean;
};

export const UI_FEATURES: UiFeatures = {
  chat: CHAT_QNA_URL.startsWith('VITE_') ? false : true,
  dataprep: DATA_PREP_URL.startsWith('VITE_') ? false : true
};

console.log("chat qna", CHAT_QNA_URL, UI_FEATURES.chat);
console.log("data prep", DATA_PREP_URL, UI_FEATURES.dataprep);