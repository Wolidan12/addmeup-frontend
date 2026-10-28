import { lazy, Suspense } from "react";
import { SiteProvider } from "./context/SiteContext";
import { MemberProvider } from "./member/MemberContext";
import MemberLayout from "./member/MemberLayout";
import MemberDashboard from "./pages/MemberDashboard";
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
      "/discover",
      "/rewards",
      "/referrals",
      "/boosts",
      "/settings",
      "/promotions",
      "/subscriptions",
      "/payments",
    ].includes(pathname) ||
      pathname.startsWith("/profile/") ||
      pathname.startsWith("/listing/"));
  return member ? (
    <MemberProvider>
      <MemberLayout>{children}</MemberLayout>
    </MemberProvider>
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
                      <Boosters />
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
                      <Rewards />
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
