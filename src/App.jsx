/*
|--------------------------------------------------------------------------
| MWOPS APPLICATION ROUTER
|--------------------------------------------------------------------------
|
| Central frontend routing for the MWOPS platform.
|
| MWOPS contains two types of frontend experiences:
|
| 1. NORMAL APPLICATION
|    - Dashboard
|    - Tournaments
|    - Matches
|    - Control Room
|    - OBS
|    - Analytics
|
| 2. PUBLIC BROADCAST OVERLAYS
|    - Master
|    - Live Ranking
|    - Elimination
|    - Playing Squads Showcase
|    - Match Winner
|    - Match Results
|    - Overall Standings
|
|--------------------------------------------------------------------------
|
| IMPORTANT
|
| Independent overlays MUST NOT redirect to Dashboard.
|
| OBS Browser Sources can use:
|
| /overlay/master?matchId=UUID&theme=MWOPS+DARK
|
| /overlay/live-ranking?matchId=UUID&theme=MWOPS+DARK
|
| /overlay/elimination?matchId=UUID&theme=MWOPS+DARK
|
| /overlay/showcase?matchId=UUID&theme=MWOPS+DARK
|
| /overlay/winner?matchId=UUID&theme=MWOPS+DARK
|
| /overlay/results?matchId=UUID&theme=MWOPS+DARK
|
| /overlay/standings?matchId=UUID&theme=MWOPS+DARK
|
|--------------------------------------------------------------------------
|
| DEPLOYMENT-SAFE QUERY URLs
|
| If the hosting provider redirects direct /overlay/* requests,
| the same overlays can be opened using:
|
| /?overlay=master&matchId=UUID&theme=MWOPS+DARK
|
| /?overlay=live-ranking&matchId=UUID&theme=MWOPS+DARK
|
| /?overlay=elimination&matchId=UUID&theme=MWOPS+DARK
|
| /?overlay=showcase&matchId=UUID&theme=MWOPS+DARK
|
| /?overlay=winner&matchId=UUID&theme=MWOPS+DARK
|
| /?overlay=results&matchId=UUID&theme=MWOPS+DARK
|
| /?overlay=standings&matchId=UUID&theme=MWOPS+DARK
|
|--------------------------------------------------------------------------
|
| LIVE SYNC
|
| Overlay components are responsible for fetching the current Control Room
| state and keeping themselves synchronized.
|
| The router MUST NOT redirect or reload overlay URLs into the Dashboard.
|
|--------------------------------------------------------------------------
*/

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useSearchParams,
} from "react-router-dom";

/*
|--------------------------------------------------------------------------
| CORE PAGES
|--------------------------------------------------------------------------
*/

import Dashboard from "./pages/Dashboard/Dashboard";
import Tournaments from "./pages/Tournaments/Tournaments";
import Matches from "./pages/Matches/Matches";
import ControlRoom from "./pages/ControlRoom/ControlRoom";

/*
|--------------------------------------------------------------------------
| PRODUCTION / BROADCAST
|--------------------------------------------------------------------------
*/

import OBS from "./pages/OBS/OBS";

/*
|--------------------------------------------------------------------------
| ANALYTICS
|--------------------------------------------------------------------------
*/

import Analytics from "./pages/Analytics/Analytics";

/*
|--------------------------------------------------------------------------
| TOURNAMENT WORKSPACE
|--------------------------------------------------------------------------
*/

import TournamentDetail from "./pages/Tournaments/TournamentDetail";

/*
|--------------------------------------------------------------------------
| PUBLIC MASTER OVERLAY
|--------------------------------------------------------------------------
*/

import MasterOverlay from "./pages/Overlay/MasterOverlay";

/*
|--------------------------------------------------------------------------
| PUBLIC INDEPENDENT OVERLAY
|--------------------------------------------------------------------------
|
| We use one reusable independent overlay renderer.
|
| The "type" property tells it which independent graphic to display.
|
| This keeps the routing clean while allowing every OBS Browser Source
| to operate independently.
|
|--------------------------------------------------------------------------
*/

import IndependentOverlay from "./pages/Overlay/IndependentOverlay";

/*
|--------------------------------------------------------------------------
| SUPPORTED OVERLAY TYPES
|--------------------------------------------------------------------------
|
| These are the canonical overlay types used throughout MWOPS.
|
|--------------------------------------------------------------------------
*/

const PUBLIC_OVERLAY_TYPES = {
  master: "master",

  "live-ranking": "live-ranking",
  liveranking: "live-ranking",
  "live_ranking": "live-ranking",
  "live ranking": "live-ranking",

  elimination: "elimination",

  showcase: "showcase",

  winner: "winner",

  results: "results",

  standings: "standings",
};

/*
|--------------------------------------------------------------------------
| NORMALIZE OVERLAY TYPE
|--------------------------------------------------------------------------
|
| Keeps query-based overlay routing tolerant of small naming differences
| while always passing the canonical type to the overlay component.
|
|--------------------------------------------------------------------------
*/

function normalizeOverlayType(value) {
  if (!value) {
    return null;
  }

  const normalizedValue = value
    .trim()
    .toLowerCase();

  return (
    PUBLIC_OVERLAY_TYPES[normalizedValue] ||
    null
  );
}

/*
|--------------------------------------------------------------------------
| OVERLAY ERROR
|--------------------------------------------------------------------------
*/

function OverlayError({
  message = "UNKNOWN MWOPS OVERLAY",
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        color: "#ffffff",
        fontFamily:
          'Inter, "Segoe UI", Arial, sans-serif',
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "18px 26px",
          background:
            "rgba(5, 7, 9, 0.95)",
          border:
            "1px solid rgba(217, 185, 79, 0.45)",
          boxShadow:
            "0 18px 50px rgba(0, 0, 0, 0.45)",
          color: "#e5c75c",
          fontSize: "12px",
          fontWeight: 900,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {message}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| QUERY-BASED PUBLIC OVERLAY ENTRY
|--------------------------------------------------------------------------
|
| This handles:
|
| /?overlay=master
| /?overlay=live-ranking
| /?overlay=elimination
| /?overlay=showcase
| /?overlay=winner
| /?overlay=results
| /?overlay=standings
|
| This route is important because some production hosts do not correctly
| serve React for arbitrary /overlay/* URLs.
|
|--------------------------------------------------------------------------
*/

function PublicOverlayRouter() {
  const [searchParams] =
    useSearchParams();

  const overlay =
    searchParams.get("overlay");

  /*
  |--------------------------------------------------------------------------
  | No overlay
  |--------------------------------------------------------------------------
  */

  if (!overlay) {
    return null;
  }

  const overlayType =
    normalizeOverlayType(overlay);

  /*
  |--------------------------------------------------------------------------
  | UNKNOWN OVERLAY
  |--------------------------------------------------------------------------
  */

  if (!overlayType) {
    return (
      <OverlayError
        message={`Unknown MWOPS Overlay: ${overlay}`}
      />
    );
  }

  /*
  |--------------------------------------------------------------------------
  | MASTER
  |--------------------------------------------------------------------------
  */

  if (
    overlayType === "master"
  ) {
    return <MasterOverlay />;
  }

  /*
  |--------------------------------------------------------------------------
  | INDEPENDENT OVERLAYS
  |--------------------------------------------------------------------------
  */

  return (
    <IndependentOverlay
      type={overlayType}
    />
  );
}

/*
|--------------------------------------------------------------------------
| NORMAL APPLICATION ROUTES
|--------------------------------------------------------------------------
*/

function ApplicationRoutes() {
  const [searchParams] =
    useSearchParams();

  const overlay =
    searchParams.get("overlay");

  /*
  |--------------------------------------------------------------------------
  | QUERY-BASED OVERLAY MODE
  |--------------------------------------------------------------------------
  |
  | This check happens BEFORE the normal <Routes>.
  |
  | Therefore an OBS URL such as:
  |
  | /?overlay=live-ranking&matchId=UUID
  |
  | cannot fall through to:
  |
  | /
  | ↓
  | /dashboard
  |
  |--------------------------------------------------------------------------
  */

  if (overlay) {
    return (
      <PublicOverlayRouter />
    );
  }

  /*
  |--------------------------------------------------------------------------
  | NORMAL MWOPS APPLICATION
  |--------------------------------------------------------------------------
  */

  return (
    <Routes>

      {/* ================================================================
          DASHBOARD
          ================================================================ */}

      <Route
        path="/dashboard"
        element={<Dashboard />}
      />

      {/* ================================================================
          TOURNAMENTS
          ================================================================ */}

      <Route
        path="/tournaments"
        element={<Tournaments />}
      />

      {/* ================================================================
          TOURNAMENT WORKSPACE
          ================================================================ */}

      <Route
        path="/tournaments/:tournamentId"
        element={<TournamentDetail />}
      />

      {/* ================================================================
          MATCHES
          ================================================================ */}

      <Route
        path="/matches"
        element={<Matches />}
      />

      {/* ================================================================
          CONTROL ROOM
          ================================================================ */}

      <Route
        path="/control-room"
        element={<ControlRoom />}
      />

      {/* ================================================================
          OBS CONTROL
          ================================================================ */}

      <Route
        path="/obs"
        element={<OBS />}
      />

      {/* ================================================================
          ANALYTICS
          ================================================================ */}

      <Route
        path="/analytics"
        element={<Analytics />}
      />

      {/* ================================================================
          MASTER OVERLAY
          ================================================================ */}

      <Route
        path="/overlay/master"
        element={<MasterOverlay />}
      />

      {/* ================================================================
          LIVE RANKING
          ================================================================ */}

      <Route
        path="/overlay/live-ranking"
        element={
          <IndependentOverlay
            type="live-ranking"
          />
        }
      />

      {/* ================================================================
          ELIMINATION ALERT
          ================================================================ */}

      <Route
        path="/overlay/elimination"
        element={
          <IndependentOverlay
            type="elimination"
          />
        }
      />

      {/* ================================================================
          PLAYING SQUADS SHOWCASE
          ================================================================ */}

      <Route
        path="/overlay/showcase"
        element={
          <IndependentOverlay
            type="showcase"
          />
        }
      />

      {/* ================================================================
          MATCH WINNER
          ================================================================ */}

      <Route
        path="/overlay/winner"
        element={
          <IndependentOverlay
            type="winner"
          />
        }
      />

      {/* ================================================================
          MATCH RESULTS
          ================================================================ */}

      <Route
        path="/overlay/results"
        element={
          <IndependentOverlay
            type="results"
          />
        }
      />

      {/* ================================================================
          OVERALL STANDINGS
          ================================================================ */}

      <Route
        path="/overlay/standings"
        element={
          <IndependentOverlay
            type="standings"
          />
        }
      />

      {/* ================================================================
          LEGACY LIVE RANKING URL
          ================================================================ */}

      <Route
        path="/live-ranking"
        element={
          <IndependentOverlay
            type="live-ranking"
          />
        }
      />

      {/* ================================================================
          ROOT
          ================================================================ */}

      <Route
        path="/"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />

      {/* ================================================================
          UNKNOWN ROUTES
          ================================================================ */}

      <Route
        path="*"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />

    </Routes>
  );
}

/*
|--------------------------------------------------------------------------
| APPLICATION
|--------------------------------------------------------------------------
*/

function App() {
  return (
    <BrowserRouter>
      <ApplicationRoutes />
    </BrowserRouter>
  );
}

export default App;