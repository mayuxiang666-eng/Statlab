import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "antd/dist/reset.css";
import "./styles.css";
import { initI18n } from "./i18n";

initI18n();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
