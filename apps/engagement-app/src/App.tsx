import type React from "react"
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom"
import ApplyForm from "./components/ApplyForm"
import ApproveForm from "./components/ApproveForm"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/toaster"
import PendingAppsPage from "./components/PendingApps"
import ClaimForm from "./components/ClaimForm"
import RegisteredAppsPage from "./components/RegisteredApps"
import AppDetailsPage from "./components/AppDetails"

const App: React.FC = () => {
  return (
    <Router>      
      <div className="container mx-auto p-4">
        <nav className="flex justify-between items-center mb-4">
          <ul className="flex space-x-4">
            <li>
              <Link to="/" className="text-blue-500 hover:text-blue-700">
                Home
              </Link>
            </li>
            <li>
              <Link to="/apply" className="text-blue-500 hover:text-blue-700">
                Apply
              </Link>
            </li>
            <li>
              <Link to="/approve" className="text-blue-500 hover:text-blue-700">
                Approve
              </Link>
            </li>
            <li>
              <Link to="/claim" className="text-blue-500 hover:text-blue-700">
                Claim Reward
              </Link>
            </li>
            <li>
              <Link to="/pending" className="text-blue-500 hover:text-blue-700">
                Pending Apps
              </Link>
            </li>
            <li>
              <Link to="/registered" className="text-blue-500 hover:text-blue-700">
                Registered Apps
              </Link>
            </li>

          </ul>
          <div className="flex items-center gap-4">
            <appkit-button />
          </div>
        </nav>

        <Routes>
          <Route
            path="/"
            element={
              <div className="max-w-2xl mx-auto mt-8">
                <h1 className="text-3xl font-bold mb-4">Welcome to Engagement Rewards</h1>
                <p className="text-gray-600 mb-4">
                  Connect your wallet to start managing your app's engagement rewards.
                </p>
                <Button asChild>
                  <Link to="/apply">Apply for Rewards</Link>
                </Button>
              </div>
            }
          />
          <Route path="/apply" element={<ApplyForm />} />
          <Route path="/approve/:appAddress" element={<ApproveForm />} />
          <Route path="/pending" element={<PendingAppsPage />} />
          <Route path="/claim" element={<ClaimForm />} />
          <Route path="/registered" element={<RegisteredAppsPage />} />
          <Route path="/app/:appAddress" element={<AppDetailsPage />} />
        </Routes>
        <Toaster />
      </div>
    </Router>
  )
}

export default App

