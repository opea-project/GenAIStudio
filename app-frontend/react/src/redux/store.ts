import { combineReducers, configureStore } from "@reduxjs/toolkit";
import userReducer from "./User/userSlice";
import conversationReducer from "./Conversation/ConversationSlice";
// import sandboxReducer from "./Sandbox/SandboxSlice";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import { APP_UUID } from "../config";

function getBucketKey() {
  const url = new URL(window.location.href);
  const query = url.search;
  return `${query}_${APP_UUID}`;
}

function saveToLocalStorage(state: ReturnType<typeof store.getState>) {
  try {
    const bucketKey = getBucketKey();
    const serialState = JSON.stringify(state);
    localStorage.setItem(`reduxStore_${bucketKey}`, serialState);
  } catch (e) {
    console.warn("Could not save state to localStorage:", e);
  }
}

function loadFromLocalStorage() {
  try {
    const bucketKey = getBucketKey();
    const serialisedState = localStorage.getItem(`reduxStore_${bucketKey}`);
    if (serialisedState === null) return undefined;
    return JSON.parse(serialisedState);
  } catch (e) {
    console.warn("Could not load state from localStorage:", e);
    return undefined;
  }
}

export const store = configureStore({
  reducer: combineReducers({
    userReducer,
    conversationReducer,
    // sandboxReducer,
  }),
  devTools: import.meta.env.PROD || true,
  preloadedState: loadFromLocalStorage(),
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

// Remove Redux state for the specific bucket key
export function clearLocalStorageBucket() {
  try {
    const bucketKey = getBucketKey();
    localStorage.removeItem(`reduxStore_${bucketKey}`);
  } catch (e) {
    console.warn("Could not clear localStorage bucket:", e);
  }
}

store.subscribe(() => saveToLocalStorage(store.getState()));

export default store;
export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
