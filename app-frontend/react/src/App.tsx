// Copyright (C) 2024 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./App.scss"
import { MantineProvider } from "@mantine/core"
import '@mantine/notifications/styles.css';
import { SideNavbar, SidebarNavList } from "./components/sidebar/sidebar"
import { IconMessages } from "@tabler/icons-react"
import UserInfoModal from "./components/UserInfoModal/UserInfoModal"
import Conversation from "./components/Conversation/Conversation"
import { Notifications } from '@mantine/notifications';
// import { UiFeatures } from "./common/Sandbox";
import { UI_FEATURES } from "./config";

// const dispatch = useAppDispatch();

const title = "OPEA Studio"
const navList: SidebarNavList = [
  { icon: IconMessages, label: title }
]

function App() {
  const enabledUiFeatures = UI_FEATURES;

  return (
    <MantineProvider>
      <Notifications position="top-right" />
      <UserInfoModal />
      <div className="layout-wrapper">
        <SideNavbar navList={navList} />
        <div className="content">
          <Conversation title={title} enabledUiFeatures={enabledUiFeatures} />
        </div>
      </div>
    </MantineProvider>
  )
}

export default App
