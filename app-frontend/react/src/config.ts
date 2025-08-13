// Copyright (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

const config = {
  companyName: "OPEA Studio",
  logo: "/logo512.png",
  tagline: "what can I help you today?",
  disclaimer:
    "<p>Generative AI provides significant benefits for enhancing the productivity of quality engineers, production support teams, software developers, and DevOps professionals. With a secure and scalable toolbox, it offers a flexible architecture capable of connecting to various data sources and models, enabling it to address a wide range of Generative AI use cases.</p><p>This platform saves your user ID to retain chat history, which you can choose to delete from the app at any time.</p>",
  defaultChatPrompt: `You are a helpful assistant`,
};

export default config;

console.log ("BACKEND_SERVICE_URL", import.meta.env.VITE_BACKEND_SERVICE_URL);
console.log ("DATA_PREP_SERVICE_URL", import.meta.env.VITE_DATAPREP_SERVICE_URL);
console.log ("CHAT_HISTORY_SERVICE_URL", import.meta.env.VITE_CHAT_HISTORY_SERVICE_URL);
console.log ("UI_SELECTION", import.meta.env.VITE_UI_SELECTION);
console.log ("DEFAULT_UI_TYPE", import.meta.env.VITE_DEFAULT_UI_TYPE);

// export const CHAT_QNA_URL = import.meta.env.VITE_BACKEND_SERVICE_ENDPOINT_CHATQNA;
export const CHAT_QNA_URL = import.meta.env.VITE_BACKEND_SERVICE_URL
// export const CODE_GEN_URL = import.meta.env.VITE_BACKEND_SERVICE_ENDPOINT_CODEGEN;
export const CODE_GEN_URL = import.meta.env.VITE_BACKEND_SERVICE_URL
// export const DOC_SUM_URL = import.meta.env.VITE_BACKEND_SERVICE_ENDPOINT_DOCSUM;
export const DOC_SUM_URL = import.meta.env.VITE_BACKEND_SERVICE_URL
export const UI_SELECTION = import.meta.env.VITE_UI_SELECTION;
export const DEFAULT_UI_TYPE = import.meta.env.VITE_DEFAULT_UI_TYPE;

// export const FAQ_GEN_URL = import.meta.env.VITE_BACKEND_SERVICE_ENDPOINT_FAQGEN;
export const DATA_PREP_URL = import.meta.env.VITE_DATAPREP_SERVICE_URL;
// export const DATA_PREP_URL = "http://localhost:6007/v1/dataprep/";
export const DATA_PREP_INGEST_URL = DATA_PREP_URL + "/ingest";
export const DATA_PREP_GET_URL = DATA_PREP_URL + "/get";
export const DATA_PREP_DELETE_URL = DATA_PREP_URL + "/delete";

export const CHAT_HISTORY_URL = import.meta.env.VITE_CHAT_HISTORY_SERVICE_URL;
// export const CHAT_HISTORY_URL = "http://localhost:6012/v1/chathistory/";
export const CHAT_HISTORY_CREATE = CHAT_HISTORY_URL + "/create";
export const CHAT_HISTORY_GET = CHAT_HISTORY_URL + "/get";
export const CHAT_HISTORY_DELETE = CHAT_HISTORY_URL + "/delete";


