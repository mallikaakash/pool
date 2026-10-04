import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { lazy, Suspense } from "react";
const TestnetApp = lazy(() => import("./TestnetApp"));
const isPublic =
  import.meta.env.PROD || import.meta.env.VITE_APP_MODE === "testnet";
import "./styles.css";
if (isPublic) document.documentElement.dataset.theme = "pool";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isPublic ? (
      <Suspense fallback={<p>Loading Pool…</p>}>
        <TestnetApp />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
