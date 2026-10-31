import { lazy, Suspense } from "react";
import { SiteProvider } from "./context/SiteContext";
const MemberDashboard=lazy(()=>import("./pages/MemberDashboard"));
const MemberShell=lazy(()=>import("./member/MemberShell"));
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar, Footer } from "./components/chrome";
import Home from "./pages/Home";
import { Login, Register, Forgot, Reset, Verify } from "./pages/AuthPages";
import {
  Privacy,
  Terms,
  Cookies,
  Support,
  DeleteAccount,
  NotFound,
} from "./pages/Legal";
const Install = lazy(() => import('./pages/Install'));
const Connections = lazy(() => import('./pages/Connections'));
const ActivityCenter = lazy(() => import('./pages/ActivityCenter'));
const ReleaseNotes = lazy(() => import("./pages/ReleaseNotes"));
const BoostCenter = lazy(() => import("./pages/BoostCenter"));
const MissionHub = lazy(() => import("./pages/MissionHub"));
const GrowthWallet = lazy(() => import("./pages/GrowthWallet"));
const SpendCredits = lazy(() => import("./pages/SpendCredits"));
const Commerce = lazy(() => import("./pages/Commerce"));
const Referrals = lazy(() => import("./pages/Referrals"));
const Boosters = lazy(() => import("./pages/Boosters"));
const Discover = lazy(() => import("./pages/Discover")),
  ProfileDetail = lazy(() => import("./pages/ProfileDetail")),
  Settings = lazy(() => import("./pages/Settings")),
  Rewards = lazy(() => import("./pages/Rewards"));
const Admin = lazy(() => import("./pages/Admin"));
function Guard({ children }) {
  const { user, loading, sessionError, retrySession } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <main className="route-state" role="status">
        <span className="design-loader" />
        Restoring your session…
      </main>
    );
  if (sessionError)
    return (
      <main className="route-state">
        <h1>We could not open your account</h1>
        <p>{sessionError}</p>
        <button className="btn" onClick={retrySession}>
          Try again
        </button>
      </main>
    );
  return user ? (
    children
  ) : (
    <Navigate
      to={location.pathname.startsWith("/admin") ? "/admin/login" : "/login"}
      state={{ from: location.pathname + location.search }}
      replace
    />
  );
}
function SiteFrame({ children }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/verify",
    ].includes(pathname)
  )
    return children;
  const member =
    user &&
    ([
      "/dashboard",
      "/connections", "/wallet", "/spend-credits", "/missions", "/credits", "/notifications", "/leaderboard",
      "/discover",
      "/rewards",
      "/referrals",
      "/boosts", "/reward-boosts",
      "/settings",
      "/promotions",
      "/subscriptions",
      "/payments",
    ].includes(pathname) ||
      pathname.startsWith("/profile/") ||
      pathname.startsWith("/listing/"));
  return member ? (
    <Suspense fallback={<main className="route-state" role="status">Opening your workspace…</main>}><MemberShell key={user.id}>{children}</MemberShell></Suspense>
  ) : (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}
export default function App() {
  return (
    <AuthProvider>
      <SiteProvider>
        <BrowserRouter>
          <SiteFrame>
            <Suspense
              fallback={
                <p className="p-10 text-center" role="status">
                  Loading workspace…
                </p>
              }
            >
              <Routes>
                <Route path="/connections" element={<Guard><Connections/></Guard>}/>
                <Route path="/wallet" element={<Guard><GrowthWallet/></Guard>}/>
                <Route path="/reward-boosts" element={<Guard><Boosters/></Guard>}/>
                <Route path="/spend-credits" element={<Guard><BoostCenter/></Guard>}/>
                <Route path="/missions" element={<Guard><MissionHub/></Guard>}/>
                <Route path="/credits" element={<Guard><Rewards mode="credits"/></Guard>}/>
                <Route path="/release-notes" element={<ReleaseNotes/>}/>
                <Route path="/notifications" element={<Guard><ActivityCenter/></Guard>}/>
                <Route path="/leaderboard" element={<Guard><ActivityCenter rankings/></Guard>}/>
                <Route
                  path="/promotions"
                  element={
                    <Guard>
                      <Commerce />
                    </Guard>
                  }
                />
                <Route
                  path="/subscriptions"
                  element={
                    <Guard>
                      <Commerce />
                    </Guard>
                  }
                />
                <Route
                  path="/payments"
                  element={
                    <Guard>
                      <Commerce />
                    </Guard>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <Guard>
                      <MemberDashboard />
                    </Guard>
                  }
                />
                <Route
                  path="/referrals"
                  element={
                    <Guard>
                      <Referrals />
                    </Guard>
                  }
                />
                <Route
                  path="/boosts"
                  element={
                    <Guard>
                      <BoostCenter />
                    </Guard>
                  }
                />
                <Route path="/" element={<Home />} />
                <Route path="/discover" element={<Discover />} />
                <Route
                  path="/listing/:username"
                  element={<ProfileDetail managed />}
                />
                <Route path="/profile/:username" element={<ProfileDetail />} />
                <Route path="/admin/login" element={<Login staff />} />
                <Route path="/verify" element={<Verify />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<Forgot />} />
                <Route path="/reset-password" element={<Reset />} />
                <Route
                  path="/settings"
                  element={
                    <Guard>
                      <Settings />
                    </Guard>
                  }
                />
                <Route
                  path="/rewards"
                  element={
                    <Guard>
                      <MissionHub />
                    </Guard>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <Guard>
                      <Admin />
                    </Guard>
                  }
                />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/cookies" element={<Cookies />} />
                <Route path="/install" element={<Install />} />
                <Route path="/support" element={<Support />} />
                <Route path="/delete-account" element={<DeleteAccount />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </SiteFrame>
        </BrowserRouter>
      </SiteProvider>
    </AuthProvider>
  );
}
