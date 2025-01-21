import type React from "react"
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom"
import ApplyForm from "./components/ApplyForm"
import ApproveForm from "./components/ApproveForm"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/toaster"

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
          <Route path="/approve" element={<ApproveForm />} />
        </Routes>
        <Toaster />
      </div>
    </Router>
  )
}

export default App

