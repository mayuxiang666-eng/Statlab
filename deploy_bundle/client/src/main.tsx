import React from "react";
import ReactDOM from "react-dom/client";
import AppWrapper from "./AppWrapper";
import "antd/dist/reset.css";
import "./styles.css";
import axios from "axios";
import { initI18n } from "./i18n";

// 全局配置生产环境后的 API 基础路径
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || "";

initI18n();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>
);
