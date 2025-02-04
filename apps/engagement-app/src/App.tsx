import { useEffect, useState } from "react"
import { BrowserRouter as Router, Route, Routes, Link, useLocation } from "react-router-dom"
import { Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import ApplyForm from "./components/ApplyForm"
import ApproveForm from "./components/ApproveForm"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/toaster"
import PendingAppsPage from "./components/PendingApps"
import ClaimForm from "./components/ClaimForm"
import RegisteredAppsPage from "./components/RegisteredApps"
import AppDetailsPage from "./components/AppDetails"
import { UpdateAppSettingsForm } from "./components/UpdateAppSettingsForm"
import IntegrationGuide from "./components/IntegrationGuide"

interface NavItemProps {
  to: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const NavItem = ({ to, children, onClick }: NavItemProps) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <li>
      <Link
        to={to}
        onClick={onClick}
        className={cn(
          "block px-4 py-2 rounded-md transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          isActive && "bg-primary text-primary-foreground"
        )}
      >
        {children}
      </Link>
    </li>
  );
};

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const closeMenu = () => setIsOpen(false);

  // Close menu on location change
  const location = useLocation();
  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="font-semibold text-lg">
            Engagement Rewards
          </Link>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-md hover:bg-accent"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          {/* Desktop menu */}
          <ul className="hidden md:flex md:space-x-1">
            <NavItem to="/apply">Apply</NavItem>
            <NavItem to="/approve">Approve</NavItem>
            <NavItem to="/claim">Claim</NavItem>
            <NavItem to="/pending">Pending</NavItem>
            <NavItem to="/registered">Registered</NavItem>
            <NavItem to="/guide">Integration Guide</NavItem>
          </ul>

          {/* Wallet connect button */}
          <div className="hidden md:block">
            <appkit-button />
          </div>
        </div>

        {/* Mobile menu */}
        <div
          className={cn(
            "md:hidden",
            "absolute left-0 right-0 bg-background border-b",
            "transition-all duration-200 ease-in-out",
            isOpen ? "top-16 opacity-100" : "-top-96 opacity-0"
          )}
        >
          <ul className="container py-4 space-y-1">
            <NavItem to="/apply" onClick={closeMenu}>Apply</NavItem>
            <NavItem to="/approve" onClick={closeMenu}>Approve</NavItem>
            <NavItem to="/claim" onClick={closeMenu}>Claim</NavItem>
            <NavItem to="/pending" onClick={closeMenu}>Pending Apps</NavItem>
            <NavItem to="/registered" onClick={closeMenu}>Registered Apps</NavItem>
            <NavItem to="/guide" onClick={closeMenu}>Integration Guide</NavItem>
            <li className="p-2">
              <appkit-button />
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

const App: React.FC = () => {
  return (
    <Router>      
      <div className="min-h-screen">
        <Navigation />
        <div className="container mx-auto p-4 pt-20">
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
            <Route path="/apply/:appAddress" element={<ApplyForm />} />
            <Route path="/approve/:appAddress" element={<ApproveForm />} />
            <Route path="/pending" element={<PendingAppsPage />} />
            <Route path="/claim" element={<ClaimForm />} />
            <Route path="/registered" element={<RegisteredAppsPage />} />
            <Route path="/app/:appAddress" element={<AppDetailsPage />} />
            <Route path="/app/:appAddress/settings" element={<UpdateAppSettingsForm />} />
            <Route path="/guide" element={<IntegrationGuide />} />
          </Routes>
          <Toaster />
        </div>
      </div>
    </Router>
  )
}

export default App

