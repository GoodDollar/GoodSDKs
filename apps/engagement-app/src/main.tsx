import React from "react"
import ReactDOM from "react-dom/client"
import { AppKitProvider } from "@/config"
import App from "./App"
import "./index.css"


ReactDOM.createRoot(document.getElementById("app") as HTMLElement).render(
  <React.StrictMode>
    <AppKitProvider><App/></AppKitProvider>
  </React.StrictMode>,
)

