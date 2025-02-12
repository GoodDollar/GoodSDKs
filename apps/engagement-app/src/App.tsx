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
            <NavItem to="/pending">Pending</NavItem>
            <NavItem to="/registered">Registered</NavItem>
            <NavItem to="/claim">Claim Demo</NavItem>
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

const LandingPage = () => {
  return (
    <div className="max-w-4xl mx-auto mt-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Boost User Engagement with Web3 Rewards
        </h1>
        <p className="text-xl text-muted-foreground">
          Transform your dApp's growth through blockchain-powered incentives
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 mt-12">
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Why Choose Engagement Rewards?</h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="mt-1 bg-primary/10 p-1 rounded">💎</div>
              <div>
                <span className="font-medium">Token Rewards</span>
                <p className="text-muted-foreground">Incentivize users with G$ tokens for meaningful interactions</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="mt-1 bg-primary/10 p-1 rounded">🤝</div>
              <div>
                <span className="font-medium">Referral System</span>
                <p className="text-muted-foreground">Built-in referral tracking to amplify your organic growth</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="mt-1 bg-primary/10 p-1 rounded">⚡</div>
              <div>
                <span className="font-medium">Easy Integration</span>
                <p className="text-muted-foreground">Simple SDK and documentation to get started in minutes</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="mt-1 bg-primary/10 p-1 rounded">🔐</div>
              <div>
                <span className="font-medium">Secure & Transparent</span>
                <p className="text-muted-foreground">Open source smart contracts with verifiable reward distribution</p>
              </div>
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">How It Works</h2>
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <h3 className="font-medium">1. Apply</h3>
              <p className="text-sm text-muted-foreground">Register your dApp and customize reward distribution between your app, users, and referrers</p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-medium">2. Integrate</h3>
              <p className="text-sm text-muted-foreground">Add our SDK to your application with just a few lines of code</p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-medium">3. Grow</h3>
              <p className="text-sm text-muted-foreground">Watch your user base expand as engagement increases through incentivized actions</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 mt-8">
        <div className="flex gap-4">
          <Button asChild size="lg">
            <Link to="/apply">Apply Now</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/guide">View Documentation</Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Already registered? <Link to="/registered" className="underline">View your apps</Link>
        </p>
      </div>

      <div className="mt-16 border-t pt-8">
        <h2 className="text-2xl font-semibold text-center mb-6">Reward Distribution Example</h2>
        <div className="max-w-md mx-auto bg-card rounded-lg border p-6">
          <p className="text-sm text-muted-foreground mb-4">For each successful engagement:</p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Your dApp receives</span>
              <span className="font-medium">20%</span>
            </div>
            <div className="flex justify-between">
              <span>Engaging user receives</span>
              <span className="font-medium">60%</span>
            </div>
            <div className="flex justify-between">
              <span>Referrer receives</span>
              <span className="font-medium">20%</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            * Percentages can be customized during registration
          </p>
        </div>
      </div>
    </div>
  )
}

const App: React.FC = () => {
  return (
    <Router>      
      <div className="min-h-screen flex flex-col items-center">
        <Navigation />
        <div className="container mx-auto p-4 pt-20 flex-grow flex flex-col items-center">
          <Routes>
            <Route path="/" element={<LandingPage />} />
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

