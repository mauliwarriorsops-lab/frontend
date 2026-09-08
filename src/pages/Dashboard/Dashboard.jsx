import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronRight,
  Gamepad2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trophy,
  Users,
  Radio,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

/*
|--------------------------------------------------------------------------
| MWOPS DASHBOARD
|--------------------------------------------------------------------------
|
| Premium MWOPS dashboard.
|
| Design direction:
|
| - Deep graphite / black
| - Refined MWOPS gold
| - Warm white typography
| - Red reserved for LIVE / danger
| - Spacious premium esports layout
| - Minimal unnecessary information
|
|--------------------------------------------------------------------------
|
| API:
|
| GET /api/dashboard
|
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| API CONFIGURATION
|--------------------------------------------------------------------------
|
| LOCAL DEVELOPMENT
|
| Create frontend/.env:
|
| VITE_API_URL=http://localhost:5000/api
|
|
| PRODUCTION
|
| Vercel environment variable:
|
| VITE_API_URL=https://backend-no95.onrender.com/api
|
|
| IMPORTANT:
|
| The production fallback below prevents a deployed Vercel
| build from ever falling back to localhost.
|
|--------------------------------------------------------------------------
*/

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  "https://backend-no95.onrender.com/api"
).replace(/\/+$/, "");

/*
|--------------------------------------------------------------------------
| EMPTY DASHBOARD
|--------------------------------------------------------------------------
*/

const EMPTY_DASHBOARD = {
  stats: {
    tournaments: 0,
    matches: 0,
    teams: 0,
    players: 0,
    activeTournaments: 0,
    liveMatches: 0,
  },

  tournaments: [],

  matches: [],

  system: {
    database: {
      status: "Unknown",
      responseTime: null,
    },

    api: {
      status: "Unknown",
    },
  },
};

/*
|--------------------------------------------------------------------------
| QUICK ACTIONS
|--------------------------------------------------------------------------
|
| Keep this intentionally limited.
|
| These are the most important organizer actions.
|
|--------------------------------------------------------------------------
*/

const DASHBOARD_VISUALS = {
  hero:
    "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1800&q=85",

  tournaments: [
    "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1560253023-3ec5d502959f?auto=format&fit=crop&w=900&q=80",
  ],

  actions: {
    tournament:
      "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=80",

    matches:
      "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=900&q=80",

    teams:
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=80",

    broadcast:
      "https://images.unsplash.com/photo-1598550476439-6847785fcea6?auto=format&fit=crop&w=900&q=80",
  },

  matches: [
    "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=300&q=75",
    "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=300&q=75",
    "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=300&q=75",
    "https://images.unsplash.com/photo-1560253023-3ec5d502959f?auto=format&fit=crop&w=300&q=75",
    "https://images.unsplash.com/photo-1598550476439-6847785fcea6?auto=format&fit=crop&w=300&q=75",
    "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=300&q=75",
  ],

  system: {
    api:
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=700&q=80",

    database:
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=700&q=80",

    broadcast:
      "https://images.unsplash.com/photo-1598550476439-6847785fcea6?auto=format&fit=crop&w=700&q=80",
  },
};

const quickActions = [
  {
    title: "New Tournament",
    description: "Create and configure an event",
    route: "/tournaments",
    icon: Trophy,
    visual: DASHBOARD_VISUALS.actions.tournament,
  },

  {
    title: "Manage Matches",
    description: "Set up and control matches",
    route: "/matches",
    icon: Gamepad2,
    visual: DASHBOARD_VISUALS.actions.matches,
  },

  {
    title: "Manage Teams",
    description: "Manage tournament rosters",
    route: "/teams",
    icon: Users,
    visual: DASHBOARD_VISUALS.actions.teams,
  },

  {
    title: "Broadcast",
    description: "Open production controls",
    route: "/control-room",
    icon: Radio,
    visual: DASHBOARD_VISUALS.actions.broadcast,
  },
];

/*
|--------------------------------------------------------------------------
| SAFE NUMBER
|--------------------------------------------------------------------------
*/

function safeNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return number;
}

/*
|--------------------------------------------------------------------------
| FORMAT NUMBER
|--------------------------------------------------------------------------
*/

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(
    safeNumber(value)
  );
}

/*
|--------------------------------------------------------------------------
| FORMAT DATE
|--------------------------------------------------------------------------
*/

function formatDate(dateValue) {
  if (!dateValue) {
    return "Date not set";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return String(dateValue);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/*
|--------------------------------------------------------------------------
| FORMAT DATE RANGE
|--------------------------------------------------------------------------
*/

function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) {
    return "Dates not set";
  }

  if (startDate && endDate) {
    return `${formatDate(startDate)} — ${formatDate(
      endDate
    )}`;
  }

  if (startDate) {
    return `Starts ${formatDate(startDate)}`;
  }

  return `Ends ${formatDate(endDate)}`;
}

/*
|--------------------------------------------------------------------------
| NORMALIZE TOURNAMENT STATUS
|--------------------------------------------------------------------------
*/

function normalizeTournamentStatus(status) {
  const value = String(status || "")
    .trim()
    .toLowerCase();

  if (
    value === "live" ||
    value === "ongoing" ||
    value === "in_progress" ||
    value === "in-progress"
  ) {
    return "ONGOING";
  }

  if (
    value === "upcoming" ||
    value === "scheduled"
  ) {
    return "UPCOMING";
  }

  if (
    value === "completed" ||
    value === "finished" ||
    value === "ended"
  ) {
    return "COMPLETED";
  }

  if (value) {
    return value.toUpperCase();
  }

  return "UNKNOWN";
}

/*
|--------------------------------------------------------------------------
| NORMALIZE MATCH STATUS
|--------------------------------------------------------------------------
*/

function normalizeMatchStatus(status) {
  const value = String(status || "")
    .trim()
    .toLowerCase();

  if (
    value === "live" ||
    value === "in_progress" ||
    value === "in-progress"
  ) {
    return "LIVE";
  }

  if (
    value === "upcoming" ||
    value === "scheduled"
  ) {
    return "UPCOMING";
  }

  if (
    value === "completed" ||
    value === "finished" ||
    value === "ended"
  ) {
    return "COMPLETED";
  }

  if (value === "paused") {
    return "PAUSED";
  }

  if (value) {
    return value.toUpperCase();
  }

  return "UNKNOWN";
}

/*
|--------------------------------------------------------------------------
| API RESPONSE UNWRAPPER
|--------------------------------------------------------------------------
*/

function unwrapApiResponse(response) {
  if (!response) {
    return EMPTY_DASHBOARD;
  }

  if (
    response.data &&
    typeof response.data === "object" &&
    !Array.isArray(response.data)
  ) {
    return response.data;
  }

  if (
    response.result &&
    typeof response.result === "object" &&
    !Array.isArray(response.result)
  ) {
    return response.result;
  }

  return response;
}

/*
|--------------------------------------------------------------------------
| FETCH DASHBOARD
|--------------------------------------------------------------------------
*/

async function fetchDashboard() {
  /*
  |--------------------------------------------------------------------------
  | Production API URL
  |--------------------------------------------------------------------------
  */

  const url = `${API_BASE_URL}/dashboard`;

  console.log(
    "MWOPS - DASHBOARD API:",
    url
  );

  const response = await fetch(
    url,
    {
      method: "GET",

      headers: {
        Accept: "application/json",

        "Cache-Control":
          "no-cache, no-store, must-revalidate",

        Pragma: "no-cache",

        Expires: "0",
      },

      cache: "no-store",
    }
  );

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      `Dashboard request failed with status ${response.status}`;

    throw new Error(message);
  }

  return unwrapApiResponse(payload);
}

/*
|--------------------------------------------------------------------------
| NORMALIZE DASHBOARD DATA
|--------------------------------------------------------------------------
*/

function normalizeDashboardData(payload) {
  const source =
    payload &&
    typeof payload === "object"
      ? payload
      : {};

  const stats =
    source.stats &&
    typeof source.stats === "object"
      ? source.stats
      : {};

  const system =
    source.system &&
    typeof source.system === "object"
      ? source.system
      : {};

  return {
    stats: {
      tournaments: safeNumber(
        stats.tournaments
      ),

      matches: safeNumber(
        stats.matches
      ),

      teams: safeNumber(
        stats.teams
      ),

      players: safeNumber(
        stats.players
      ),

      activeTournaments: safeNumber(
        stats.activeTournaments
      ),

      liveMatches: safeNumber(
        stats.liveMatches
      ),
    },

    tournaments: Array.isArray(
      source.tournaments
    )
      ? source.tournaments
      : [],

    matches: Array.isArray(
      source.matches
    )
      ? source.matches
      : [],

    system: {
      database:
        system.database || {
          status: "Unknown",
          responseTime: null,
        },

      api:
        system.api || {
          status: "Unknown",
        },
    },
  };
}

/*
|--------------------------------------------------------------------------
| DASHBOARD
|--------------------------------------------------------------------------
*/

function Dashboard() {
  const navigate = useNavigate();

  const [
    dashboard,
    setDashboard,
  ] = useState(EMPTY_DASHBOARD);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | NAVIGATION
  |--------------------------------------------------------------------------
  */

  const goTo = useCallback(
    (route) => {
      if (!route) {
        return;
      }

      navigate(route);
    },
    [navigate]
  );

  /*
  |--------------------------------------------------------------------------
  | LOAD DASHBOARD
  |--------------------------------------------------------------------------
  */

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const payload =
          await fetchDashboard();

        const normalized =
          normalizeDashboardData(
            payload
          );

        setDashboard(normalized);
      } catch (requestError) {
        console.error(
          "MWOPS dashboard request failed:",
          requestError
        );

        setError(
          requestError?.message ||
            "Unable to load dashboard data."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  /*
  |--------------------------------------------------------------------------
  | INITIAL LOAD
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  /*
  |--------------------------------------------------------------------------
  | STATISTICS
  |--------------------------------------------------------------------------
  */

  const stats = useMemo(() => {
    return [
      {
        value: formatNumber(
          dashboard.stats.activeTournaments
        ),

        label: "Active Tournaments",

        helper:
          "Currently running or scheduled",

        icon: Trophy,

        visual:
          DASHBOARD_VISUALS.tournaments[0],
      },

      {
        value: formatNumber(
          dashboard.stats.matches
        ),

        label: "Total Matches",

        helper:
          "Across all tournaments",

        icon: Gamepad2,

        visual:
          DASHBOARD_VISUALS.tournaments[1],
      },

      {
        value: formatNumber(
          dashboard.stats.teams
        ),

        label: "Teams",

        helper:
          "Registered in MWOPS",

        icon: Users,

        visual:
          DASHBOARD_VISUALS.tournaments[2],
      },

      {
        value: formatNumber(
          dashboard.stats.liveMatches
        ),

        label: "Live Now",

        helper:
          dashboard.stats.liveMatches > 0
            ? "Production active"
            : "No live matches",

        icon: Radio,

        visual:
          DASHBOARD_VISUALS.actions.broadcast,

        live:
          dashboard.stats.liveMatches > 0,
      },
    ];
  }, [dashboard.stats]);

  /*
  |--------------------------------------------------------------------------
  | TOURNAMENT DISPLAY DATA
  |--------------------------------------------------------------------------
  */

  const tournaments = useMemo(() => {
    return dashboard.tournaments.map(
      (tournament, index) => {
        const status =
          normalizeTournamentStatus(
            tournament.status
          );

        return {
          id:
            tournament.id ||
            `tournament-${index}`,

          status,

          title:
            tournament.name ||
            "Untitled Tournament",

          subtitle:
            tournament.game ||
            "",

          teams:
            tournament.team_count != null
              ? tournament.team_count
              : null,

          matches:
            tournament.match_count != null
              ? tournament.match_count
              : null,

          date: formatDateRange(
            tournament.start_date,
            tournament.end_date
          ),

          image:
            tournament.image_url ||
            tournament.banner_url ||
            DASHBOARD_VISUALS.tournaments[
              index %
                DASHBOARD_VISUALS.tournaments.length
            ],

          route: "/tournaments",
        };
      }
    );
  }, [dashboard.tournaments]);

  /*
  |--------------------------------------------------------------------------
  | RECENT MATCHES
  |--------------------------------------------------------------------------
  */

  const recentMatches = useMemo(() => {
    return dashboard.matches
      .slice(0, 6)
      .map((match, index) => {
        const status =
          normalizeMatchStatus(
            match.status
          );

        const matchName =
          match.name ||
          match.match_name ||
          match.round ||
          `Match ${index + 1}`;

        const tournamentName =
          match.tournament?.name ||
          match.tournament_name ||
          "Tournament";

        return {
          id:
            match.id ||
            `match-${index}`,

          number: String(
            index + 1
          ).padStart(2, "0"),

          match:
            matchName,

          tournament:
            tournamentName,

          map:
            match.map ||
            match.map_name ||
            "Map not set",

          status,

          image:
            match.image_url ||
            match.thumbnail_url ||
            match.banner_url ||
            DASHBOARD_VISUALS.matches[
              index %
                DASHBOARD_VISUALS.matches.length
            ],

          route: "/matches",
        };
      });
  }, [dashboard.matches]);

  /*
  |--------------------------------------------------------------------------
  | SYSTEM STATUS
  |--------------------------------------------------------------------------
  */

  const systemStatus = useMemo(() => {
    return [
      {
        name: "API",

        status:
          dashboard.system?.api?.status ||
          "Unknown",

        image:
          DASHBOARD_VISUALS.system.api,
      },

      {
        name: "Database",

        status:
          dashboard.system?.database?.status ||
          "Unknown",

        image:
          DASHBOARD_VISUALS.system.database,
      },

      {
        name: "Broadcast",

        status: "Not reported",

        image:
          DASHBOARD_VISUALS.system.broadcast,
      },
    ];
  }, [dashboard.system]);

  /*
  |--------------------------------------------------------------------------
  | SYSTEM STATUS CLASS
  |--------------------------------------------------------------------------
  */

  const getSystemStatusClass = (
    status
  ) => {
    const value =
      String(status || "")
        .trim()
        .toLowerCase();

    if (
      value === "online" ||
      value === "healthy" ||
      value === "connected" ||
      value === "running"
    ) {
      return "online";
    }

    if (
      value === "offline" ||
      value === "error" ||
      value === "failed"
    ) {
      return "offline";
    }

    return "unknown";
  };

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <>
      <style>{`
        :root {
          color-scheme: dark;
        }

        * {
          box-sizing: border-box;
        }

        html,
        body,
        #root {
          margin: 0;
          min-height: 100%;
          background: #080b0e;
        }

        body {
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;

          color: #f5f1e8;
        }

        button {
          font: inherit;
          border: 0;
        }

        .mwops-shell {
          --bg: #080b0e;
          --panel: #0d1217;
          --panel2: #11171d;
          --line: rgba(255,255,255,.09);
          --line-soft: rgba(255,255,255,.055);
          --gold: #e9ad2e;
          --gold2: #ffc84b;
          --gold-soft: rgba(233,173,46,.14);
          --text: #f4f1e9;
          --muted: #8c939a;
          --dim: #596169;
          --red: #ff4655;
          --green: #3ed38a;

          min-height: 100vh;

          background:
            radial-gradient(
              circle at 70% 15%,
              rgba(233,173,46,.055),
              transparent 26%
            ),
            radial-gradient(
              circle at 12% 70%,
              rgba(35,74,100,.05),
              transparent 24%
            ),
            #080b0e;

          color: var(--text);
          overflow-x: hidden;
        }

        .mwops-shell::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;

          background-image:
            linear-gradient(
              rgba(255,255,255,.012) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(255,255,255,.012) 1px,
              transparent 1px
            );

          background-size: 56px 56px;

          mask-image:
            linear-gradient(
              to bottom,
              rgba(0,0,0,.65),
              transparent 80%
            );
        }

        .mwops-main {
          min-height: 100vh;
          position: relative;
          z-index: 1;
        }

        .mwops-topbar {
          height: 58px;
          position: sticky;
          top: 0;
          z-index: 60;

          display: flex;
          align-items: center;
          gap: 18px;

          padding: 0 24px;

          background: rgba(8,12,16,.9);

          border-bottom:
            1px solid var(--line);

          backdrop-filter: blur(18px);
        }

        .top-search {
          width: min(520px, 52vw);
          height: 34px;

          display: flex;
          align-items: center;
          gap: 10px;

          padding: 0 12px;

          border:
            1px solid rgba(255,255,255,.1);

          border-radius: 5px;

          background:
            rgba(255,255,255,.035);

          color: #747c83;
        }

        .top-search svg {
          width: 15px;
          height: 15px;
        }

        .top-search span {
          font-size: 8px;
          color: #727a81;

          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .shortcut {
          margin-left: auto;

          padding: 4px 7px;

          border:
            1px solid rgba(255,255,255,.08);

          border-radius: 4px;

          font-size: 6px;
          color: #687178;
        }

        .top-actions {
          margin-left: auto;

          display: flex;
          align-items: center;
          gap: 12px;
        }

        .top-icon {
          position: relative;

          width: 33px;
          height: 33px;

          display: grid;
          place-items: center;

          color: #8b939a;

          background: transparent;

          cursor: pointer;
        }

        .top-icon:hover {
          color: var(--gold2);
        }

        .top-icon svg {
          width: 17px;
          height: 17px;
        }

        .notification-badge {
          position: absolute;

          top: 3px;
          right: 2px;

          min-width: 14px;
          height: 14px;

          padding: 0 4px;

          border-radius: 10px;

          background: var(--red);
          color: white;

          display: grid;
          place-items: center;

          font-size: 6px;
          font-weight: 950;

          border:
            2px solid #0b1015;
        }

        .top-divider {
          width: 1px;
          height: 25px;
          background: var(--line);
        }

        .profile {
          display: flex;
          align-items: center;
          gap: 9px;
          cursor: pointer;
        }

        .profile-avatar {
          width: 31px;
          height: 31px;

          border-radius: 50%;

          display: grid;
          place-items: center;

          background:
            linear-gradient(
              145deg,
              #715f2d,
              #29251a
            );

          border:
            1px solid rgba(233,173,46,.45);

          color: #f8e9c5;

          font-size: 8px;
          font-weight: 950;
        }

        .profile-name {
          font-size: 9px;
          font-weight: 850;
          color: #e9e5dc;
        }

        .profile-role {
          margin-top: 2px;

          color: #5f666c;

          font-size: 6px;

          text-transform: uppercase;
          letter-spacing: .7px;
        }

        .profile-chevron {
          width: 13px;
          color: #697178;
        }

        .dashboard-content {
          width: 100%;
          max-width: 1540px;

          margin: 0 auto;

          padding: 20px 26px 42px;
        }

        .error-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;

          gap: 12px;

          padding: 10px 13px;
          margin-bottom: 14px;

          border:
            1px solid rgba(255,70,85,.25);

          background:
            rgba(255,70,85,.05);

          color: #ff7781;

          border-radius: 5px;

          font-size: 9px;
        }

        .retry-button {
          padding: 6px 10px;

          border:
            1px solid rgba(255,70,85,.3);

          background:
            rgba(255,70,85,.08);

          color: #ff8a91;

          border-radius: 4px;

          cursor: pointer;

          font-size: 7px;
          font-weight: 850;
        }

        .hero {
          position: relative;

          min-height: 272px;

          overflow: hidden;

          border:
            1px solid rgba(255,255,255,.105);

          border-radius: 6px;

          background: #11171c;

          box-shadow:
            0 18px 60px rgba(0,0,0,.26);
        }

        .hero-image {
          position: absolute;
          inset: 0;
          z-index: 0;

          background-position: center right;
          background-size: cover;
          background-repeat: no-repeat;

          opacity: .52;

          filter:
            saturate(.82)
            contrast(1.08);

          transform: scale(1.015);
        }

        .hero-image::after {
          content: "";

          position: absolute;
          inset: 0;

          background:
            linear-gradient(
              90deg,
              rgba(8,12,16,.98) 0%,
              rgba(8,12,16,.9) 29%,
              rgba(8,12,16,.55) 55%,
              rgba(8,12,16,.28) 78%,
              rgba(8,12,16,.55) 100%
            ),
            linear-gradient(
              180deg,
              rgba(8,12,16,.1),
              rgba(8,12,16,.72)
            );
        }

        .hero-glow {
          position: absolute;

          inset: auto -5% -65% 42%;

          height: 180%;

          background:
            radial-gradient(
              ellipse,
              rgba(233,173,46,.17),
              transparent 55%
            );

          pointer-events: none;
        }

        .hero-grid {
          position: absolute;

          right: -4%;
          top: -24%;

          width: 46%;
          height: 150%;

          border:
            1px solid rgba(233,173,46,.11);

          transform: rotate(22deg);

          box-shadow:
            0 0 0 34px rgba(233,173,46,.018),
            0 0 0 68px rgba(233,173,46,.012);
        }

        .hero-content {
          position: relative;
          z-index: 4;

          width: 64%;

          padding: 40px 42px;
        }

        .hero-eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;

          color: #d5a22e;

          font-size: 8px;
          font-weight: 900;

          letter-spacing: 2.2px;

          text-transform: uppercase;
        }

        .hero-eyebrow::before {
          content: "";

          width: 18px;
          height: 2px;

          background: var(--gold);
        }

        .hero-title {
          margin: 13px 0 0;

          max-width: 700px;

          color: #f7f3eb;

          font-size:
            clamp(42px, 4.4vw, 68px);

          line-height: .9;

          font-weight: 1000;

          letter-spacing: -3.7px;

          text-transform: uppercase;
        }

        .hero-title span {
          display: block;
          color: #efb532;
        }

        .hero-tagline {
          margin-top: 15px;

          color: #b0b3b5;

          font-size: 9px;
          font-weight: 850;

          letter-spacing: 2px;

          text-transform: uppercase;
        }

        .hero-description {
          max-width: 550px;

          margin: 12px 0 0;

          color: #8c9398;

          font-size: 9px;
          line-height: 1.6;
        }

        .hero-actions {
          display: flex;
          gap: 8px;
          margin-top: 18px;
        }

        .primary-button,
        .secondary-button {
          min-height: 36px;

          padding: 0 14px;

          display: inline-flex;
          align-items: center;
          justify-content: center;

          gap: 8px;

          border-radius: 4px;

          cursor: pointer;

          font-size: 7px;
          font-weight: 950;

          letter-spacing: .4px;

          text-transform: uppercase;

          transition: .2s ease;
        }

        .primary-button {
          background: var(--gold);
          color: #171208;

          border:
            1px solid var(--gold);

          box-shadow:
            0 8px 28px rgba(233,173,46,.12);
        }

        .primary-button:hover {
          background: var(--gold2);

          transform: translateY(-1px);

          box-shadow:
            0 12px 32px rgba(233,173,46,.2);
        }

        .secondary-button {
          background:
            rgba(255,255,255,.035);

          color: #c8c6c0;

          border:
            1px solid rgba(255,255,255,.13);
        }

        .secondary-button:hover {
          color: var(--gold2);

          border-color:
            rgba(233,173,46,.4);

          background:
            rgba(233,173,46,.05);
        }

        .primary-button svg,
        .secondary-button svg {
          width: 13px;
          height: 13px;
        }

        .hero-side {
          position: absolute;

          z-index: 4;

          right: 31px;
          bottom: 27px;

          text-align: right;
        }

        .hero-side-label {
          color: #8d9193;

          font-size: 6px;
          font-weight: 850;

          letter-spacing: 2px;

          text-transform: uppercase;
        }

        .hero-side-title {
          margin-top: 6px;

          color: #ddd9cf;

          font-size: 12px;
          font-weight: 950;

          letter-spacing: 1.5px;

          text-transform: uppercase;
        }

        .hero-side-line {
          margin: 9px 0 0 auto;

          width: 34px;
          height: 2px;

          background: var(--gold);

          box-shadow:
            0 0 12px rgba(233,173,46,.3);
        }

        .stats-grid {
          display: grid;

          grid-template-columns:
            repeat(4, minmax(0,1fr));

          gap: 11px;

          margin-top: 13px;
        }

        .stat-card {
          position: relative;

          min-height: 116px;

          overflow: hidden;

          padding: 15px 17px;

          border:
            1px solid rgba(255,255,255,.095);

          border-radius: 5px;

          background: #10161b;

          box-shadow:
            0 10px 30px rgba(0,0,0,.13);

          transition: .2s ease;
        }

        .stat-card:hover {
          transform: translateY(-2px);

          border-color:
            rgba(233,173,46,.45);

          box-shadow:
            0 15px 35px rgba(0,0,0,.2);
        }

        .stat-card.live {
          border-color:
            rgba(255,70,85,.42);

          box-shadow:
            0 0 0 1px rgba(255,70,85,.03),
            0 12px 35px rgba(0,0,0,.18);
        }

        .stat-visual {
          position: absolute;
          inset: 0;
          z-index: 0;

          background-size: cover;
          background-position: center;

          opacity: .38;

          filter:
            saturate(.7)
            contrast(1.05);

          transition: .35s ease;
        }

        .stat-visual::after {
          content: "";

          position: absolute;
          inset: 0;

          background:
            linear-gradient(
              90deg,
              rgba(13,18,23,.92),
              rgba(13,18,23,.54) 48%,
              rgba(13,18,23,.25)
            ),
            linear-gradient(
              180deg,
              rgba(13,18,23,.04),
              rgba(13,18,23,.78)
            );
        }

        .stat-card:hover .stat-visual {
          opacity: .48;
          transform: scale(1.04);
        }

        .stat-card.live .stat-visual {
          opacity: .45;
        }

        .stat-top {
          position: relative;
          z-index: 2;

          display: flex;
          justify-content: space-between;
        }

        .stat-icon {
          width: 31px;
          height: 31px;

          display: grid;
          place-items: center;

          border:
            1px solid rgba(233,173,46,.28);

          background:
            rgba(233,173,46,.075);

          border-radius: 4px;

          color: var(--gold2);

          box-shadow:
            0 0 18px rgba(233,173,46,.06);
        }

        .stat-icon svg {
          width: 15px;
          height: 15px;
        }

        .stat-live {
          display: flex;
          align-items: center;
          gap: 5px;

          color: #ff5967;

          font-size: 6px;
          font-weight: 950;

          letter-spacing: 1px;
        }

        .stat-live-dot {
          width: 5px;
          height: 5px;

          border-radius: 50%;

          background: #ff4655;

          box-shadow:
            0 0 9px rgba(255,70,85,.8);
        }

        .stat-value {
          position: relative;
          z-index: 2;

          margin-top: 11px;

          font-size: 30px;
          line-height: 1;

          font-weight: 1000;

          letter-spacing: -1.8px;

          color: #f7f4ec;
        }

        .stat-label {
          position: relative;
          z-index: 2;

          margin-top: 6px;

          color: #ddd9d0;

          font-size: 8px;
          font-weight: 950;

          letter-spacing: .7px;

          text-transform: uppercase;
        }

        .stat-helper {
          position: relative;
          z-index: 2;

          margin-top: 3px;

          color: #747c82;

          font-size: 7px;
        }

        .section {
          margin-top: 25px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;

          gap: 15px;

          margin-bottom: 10px;
        }

        .section-title-wrap {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .section-marker {
          width: 3px;
          height: 20px;

          background: var(--gold);

          box-shadow:
            0 0 12px rgba(233,173,46,.22);
        }

        .section-title {
          margin: 0;

          color: #eeeae2;

          font-size: 15px;
          font-weight: 1000;

          letter-spacing: -.3px;

          text-transform: uppercase;
        }

        .section-caption {
          color: #687078;

          font-size: 8px;
          font-weight: 650;
        }

        .section-link {
          display: inline-flex;
          align-items: center;

          gap: 5px;

          background: transparent;

          color: var(--gold2);

          font-size: 7px;
          font-weight: 900;

          cursor: pointer;

          text-transform: uppercase;
        }

        .section-link:hover {
          color: #ffe08a;
        }

        .section-link svg {
          width: 11px;
          height: 11px;
        }

        .section-link:disabled {
          opacity: .65;
          cursor: wait;
        }

        .quick-actions {
          display: grid;

          grid-template-columns:
            repeat(4,minmax(0,1fr));

          gap: 11px;
        }

        .action-card {
          position: relative;

          min-height: 91px;

          overflow: hidden;

          padding: 13px 14px;

          border:
            1px solid rgba(255,255,255,.095);

          border-radius: 5px;

          background: #0f151a;

          cursor: pointer;

          transition: .2s ease;

          box-shadow:
            0 8px 24px rgba(0,0,0,.12);
        }

        .action-card:hover {
          transform: translateY(-2px);

          border-color:
            rgba(233,173,46,.55);

          box-shadow:
            0 14px 34px rgba(0,0,0,.2);
        }

        .action-visual {
          position: absolute;
          inset: 0;
          z-index: 0;

          background-size: cover;
          background-position: center;

          opacity: .42;

          filter:
            saturate(.78)
            contrast(1.05);

          transition: .35s ease;
        }

        .action-visual::after {
          content: "";

          position: absolute;
          inset: 0;

          background:
            linear-gradient(
              90deg,
              rgba(10,15,19,.9),
              rgba(10,15,19,.5) 48%,
              rgba(10,15,19,.2)
            ),
            linear-gradient(
              180deg,
              rgba(10,15,19,.06),
              rgba(10,15,19,.8)
            );
        }

        .action-card:hover .action-visual {
          opacity: .56;
          transform: scale(1.04);
        }

        .action-accent {
          position: absolute;

          left: 0;
          top: 0;
          bottom: 0;

          width: 3px;

          z-index: 4;

          background: var(--gold);

          box-shadow:
            0 0 16px rgba(233,173,46,.35);
        }

        .action-icon {
          position: relative;
          z-index: 5;

          width: 31px;
          height: 31px;

          display: grid;
          place-items: center;

          border:
            1px solid rgba(233,173,46,.3);

          background:
            rgba(9,13,17,.52);

          border-radius: 4px;

          color: var(--gold2);
        }

        .action-icon svg {
          width: 15px;
          height: 15px;
        }

        .action-bottom {
          position: absolute;
          z-index: 5;

          left: 14px;
          right: 12px;
          bottom: 12px;

          display: flex;
          align-items: flex-end;
          justify-content: space-between;

          gap: 10px;
        }

        .action-title {
          color: #f0ece4;

          font-size: 8px;
          font-weight: 950;

          text-transform: uppercase;
        }

        .action-description {
          margin-top: 3px;

          color: #92999e;

          font-size: 7px;
        }

        .action-arrow {
          width: 30px;
          height: 30px;

          display: grid;
          place-items: center;

          border:
            1px solid rgba(233,173,46,.45);

          border-radius: 50%;

          color: var(--gold2);

          background:
            rgba(8,12,16,.55);
        }

        .action-arrow svg {
          width: 13px;
          height: 13px;
        }

        .content-grid {
          display: grid;

          grid-template-columns:
            minmax(0,1.25fr)
            minmax(340px,.75fr);

          gap: 18px;

          align-items: start;
        }

        .tournament-grid {
          display: grid;

          grid-template-columns:
            repeat(2,minmax(0,1fr));

          gap: 10px;
        }

        .tournament-card {
          position: relative;

          min-height: 157px;

          overflow: hidden;

          border:
            1px solid rgba(255,255,255,.09);

          border-radius: 5px;

          background: #0f151a;

          cursor: pointer;

          transition: .2s ease;
        }

        .tournament-card:hover {
          transform: translateY(-2px);

          border-color:
            rgba(233,173,46,.45);
        }

        .tournament-image {
          position: absolute;
          inset: 0;

          background:
            center / cover no-repeat;

          opacity: .58;

          filter:
            saturate(.76)
            contrast(1.04);

          transition: .35s ease;
        }

        .tournament-card:hover
        .tournament-image {
          opacity: .67;
          transform: scale(1.035);
        }

        .tournament-image-placeholder {
          position: absolute;
          inset: 0;

          background:
            radial-gradient(
              circle at 75% 20%,
              rgba(233,173,46,.14),
              transparent 30%
            ),
            linear-gradient(
              135deg,
              #151c22,
              #0a0e12
            );
        }

        .tournament-overlay {
          position: absolute;
          inset: 0;

          background:
            linear-gradient(
              90deg,
              rgba(7,11,14,.92),
              rgba(7,11,14,.48)
            ),
            linear-gradient(
              180deg,
              rgba(7,11,14,.05),
              rgba(7,11,14,.94)
            );
        }

        .tournament-visual-label {
          position: absolute;

          top: 11px;
          left: 13px;
          z-index: 3;

          padding: 4px 6px;

          border:
            1px solid rgba(233,173,46,.24);

          border-radius: 3px;

          background:
            rgba(8,12,16,.42);

          color: #d9a92f;

          font-size: 5px;
          font-weight: 900;

          letter-spacing: 1.2px;
        }

        .tournament-accent {
          position: absolute;

          left: 0;
          top: 0;
          bottom: 0;

          width: 3px;

          background: var(--gold);

          z-index: 4;
        }

        .tournament-content {
          position: relative;
          z-index: 5;

          height: 100%;

          display: flex;
          flex-direction: column;

          padding: 14px 15px;
        }

        .tournament-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;

          gap: 10px;
        }

        .tournament-title {
          margin: 0;

          max-width: 72%;

          color: #f2eee5;

          font-size: 12px;
          line-height: 1.1;

          font-weight: 1000;

          text-transform: uppercase;
        }

        .tournament-game {
          margin-top: 5px;

          color: #e0aa32;

          font-size: 6px;
          font-weight: 850;

          letter-spacing: 1px;

          text-transform: uppercase;
        }

        .tournament-status {
          padding: 5px 7px;

          border:
            1px solid rgba(233,173,46,.25);

          background:
            rgba(233,173,46,.09);

          color: var(--gold2);

          border-radius: 3px;

          font-size: 5px;
          font-weight: 950;

          text-transform: uppercase;
        }

        .tournament-status.ongoing {
          border-color:
            rgba(255,70,85,.35);

          background:
            rgba(255,70,85,.1);

          color: #ff6572;
        }

        .tournament-status.completed {
          color: #7b8287;

          background:
            rgba(255,255,255,.04);

          border-color:
            rgba(255,255,255,.1);
        }

        .tournament-status.unknown {
          color: #7b8287;
        }

        .tournament-spacer {
          flex: 1;
        }

        .tournament-meta {
          display: flex;
          gap: 13px;

          color: #b7b8b5;

          font-size: 7px;
          font-weight: 800;
        }

        .tournament-meta-item {
          display: flex;
          align-items: center;

          gap: 4px;
        }

        .tournament-meta-item svg {
          width: 10px;
          height: 10px;

          color: #8b9196;
        }

        .tournament-date {
          margin-top: 6px;

          color: #858c92;

          font-size: 7px;
        }

        .tournament-bottom {
          display: flex;
          justify-content: flex-end;

          margin-top: 9px;
        }

        .manage-button {
          display: inline-flex;
          align-items: center;

          gap: 5px;

          padding: 6px 8px;

          border:
            1px solid rgba(233,173,46,.3);

          border-radius: 3px;

          background:
            rgba(233,173,46,.055);

          color: var(--gold2);

          font-size: 6px;
          font-weight: 950;

          text-transform: uppercase;

          cursor: pointer;
        }

        .manage-button:hover {
          background:
            rgba(233,173,46,.12);

          border-color:
            rgba(233,173,46,.55);
        }

        .manage-button svg {
          width: 10px;
          height: 10px;
        }

        .panel {
          overflow: hidden;

          border:
            1px solid rgba(255,255,255,.09);

          border-radius: 5px;

          background: #0d1318;

          box-shadow:
            0 8px 28px rgba(0,0,0,.12);
        }

        .match-row {
          display: grid;

          grid-template-columns:
            26px
            42px
            minmax(0,1fr)
            auto;

          gap: 9px;

          align-items: center;

          min-height: 66px;

          padding: 9px 11px;

          border-bottom:
            1px solid rgba(255,255,255,.055);

          cursor: pointer;

          transition: .2s ease;
        }

        .match-row:last-child {
          border-bottom: 0;
        }

        .match-row:hover {
          background:
            rgba(233,173,46,.035);
        }

        .match-number {
          color: #596168;

          font-size: 7px;
          font-weight: 950;
        }

        .match-visual {
          width: 42px;
          height: 42px;

          overflow: hidden;

          border:
            1px solid rgba(255,255,255,.11);

          border-radius: 4px;

          background: #172027;
        }

        .match-visual img {
          width: 100%;
          height: 100%;

          object-fit: cover;

          display: block;

          filter:
            saturate(.75)
            contrast(1.05);
        }

        .match-title {
          color: #e9e6df;

          font-size: 8px;
          font-weight: 900;

          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .match-tournament {
          margin-top: 3px;

          color: #697178;

          font-size: 6px;

          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .match-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;

          gap: 5px;
        }

        .match-map {
          color: #7c848a;

          font-size: 6px;

          white-space: nowrap;
        }

        .match-status {
          min-width: 57px;

          padding: 4px 6px;

          border-radius: 3px;

          text-align: center;

          font-size: 5px;
          font-weight: 950;

          text-transform: uppercase;
        }

        .match-status.live {
          color: #ff5e6b;
          background: rgba(255,70,85,.1);
        }

        .match-status.upcoming {
          color: var(--gold2);
          background: rgba(233,173,46,.09);
        }

        .match-status.completed {
          color: #747b81;
          background: rgba(255,255,255,.045);
        }

        .match-status.paused {
          color: #ffad61;
          background: rgba(255,159,67,.09);
        }

        .match-status.unknown {
          color: #747b81;
          background: rgba(255,255,255,.04);
        }

        .system-panel {
          margin-top: 16px;
        }

        .system-list {
          display: grid;

          grid-template-columns:
            repeat(3,minmax(0,1fr));
        }

        .system-row {
          position: relative;

          min-height: 67px;

          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 10px;

          padding: 0 11px;

          border-right:
            1px solid rgba(255,255,255,.055);

          overflow: hidden;
        }

        .system-row:last-child {
          border-right: 0;
        }

        .system-visual {
          position: absolute;
          inset: 0;

          background:
            center / cover no-repeat;

          opacity: .24;

          filter:
            saturate(.58);
        }

        .system-visual::after {
          content: "";

          position: absolute;
          inset: 0;

          background:
            linear-gradient(
              90deg,
              rgba(13,19,24,.95),
              rgba(13,19,24,.55),
              rgba(13,19,24,.22)
            );
        }

        .system-name,
        .system-state {
          position: relative;
          z-index: 2;
        }

        .system-name {
          display: flex;
          align-items: center;

          gap: 7px;

          color: #b6b9b8;

          font-size: 7px;
          font-weight: 900;

          text-transform: uppercase;
        }

        .system-name::before {
          content: "";

          width: 5px;
          height: 5px;

          border-radius: 50%;

          background: #626970;
        }

        .system-row.online
        .system-name::before {
          background: var(--green);

          box-shadow:
            0 0 8px rgba(62,211,138,.55);
        }

        .system-row.offline
        .system-name::before {
          background: var(--red);

          box-shadow:
            0 0 8px rgba(255,70,85,.55);
        }

        .system-state {
          font-size: 6px;
          font-weight: 900;

          text-transform: uppercase;
        }

        .system-state.online {
          color: var(--green);
        }

        .system-state.offline {
          color: var(--red);
        }

        .system-state.unknown {
          color: #697178;
        }

        .empty-panel,
        .loading-panel {
          min-height: 118px;

          display: flex;

          align-items: center;
          justify-content: center;

          padding: 22px;

          color: #697178;

          font-size: 8px;

          text-align: center;
        }

        .loading-panel {
          gap: 8px;
        }

        .loading-spinner {
          width: 14px;
          height: 14px;

          border:
            2px solid rgba(233,173,46,.16);

          border-top-color:
            var(--gold);

          border-radius: 50%;

          animation:
            mwops-spin .8s linear infinite;
        }

        .mwops-refreshing {
          animation:
            mwops-spin .8s linear infinite;
        }

        @keyframes mwops-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .dashboard-footer {
          display: flex;

          justify-content: space-between;
          align-items: center;

          gap: 15px;

          margin-top: 30px;

          padding-top: 15px;

          border-top:
            1px solid var(--line);

          color: #4d555b;

          font-size: 6px;
          font-weight: 800;

          letter-spacing: 1.1px;

          text-transform: uppercase;
        }

        .footer-brand {
          font-size: 14px;
          font-weight: 1000;

          color: #777d82;

          letter-spacing: -.5px;
        }

        .footer-brand span {
          color: var(--gold);
        }

        .footer-center {
          display: flex;
          align-items: center;

          gap: 7px;
        }

        .footer-line {
          width: 22px;
          height: 1px;

          background: var(--gold);
        }

        @media (max-width:1180px) {
          .content-grid {
            grid-template-columns: 1fr;
          }

          .system-panel {
            margin-top: 22px;
          }

          .hero-content {
            width: 70%;
          }
        }

        @media (max-width:900px) {
          .stats-grid,
          .quick-actions {
            grid-template-columns:
              repeat(2,minmax(0,1fr));
          }

          .hero-content {
            width: 78%;
            padding: 32px;
          }
        }

        @media (max-width:680px) {
          .mwops-main {
            margin-left: 0;
          }

          .mwops-topbar {
            padding: 0 14px;
          }

          .dashboard-content {
            padding: 14px 13px 30px;
          }

          .shortcut {
            display: none;
          }

          .profile-role,
          .profile-chevron {
            display: none;
          }

          .hero {
            min-height: 390px;
          }

          .hero-image {
            opacity: .42;
            background-position: 60% center;
          }

          .hero-content {
            width: 100%;
            padding: 30px 24px;
          }

          .hero-title {
            font-size: 42px;
            letter-spacing: -2.6px;
          }

          .hero-side {
            display: none;
          }

          .hero-actions {
            flex-wrap: wrap;
          }

          .stats-grid,
          .quick-actions,
          .tournament-grid {
            grid-template-columns: 1fr;
          }

          .system-list {
            grid-template-columns: 1fr;
          }

          .system-row {
            border-right: 0;

            border-bottom:
              1px solid rgba(255,255,255,.055);
          }

          .system-row:last-child {
            border-bottom: 0;
          }

          .dashboard-footer {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>

      <div className="mwops-shell">
        <div className="mwops-main">

          <header className="mwops-topbar">

            <div className="top-search">
              <Search />

              <span>
                Search tournaments, teams, or matches...
              </span>

              <span className="shortcut">
                CTRL K
              </span>
            </div>

            <div className="top-actions">

              <button
                className="top-icon"
                type="button"
                title="Notifications"
                onClick={() => {}}
              >
                <Bell />

                <span className="notification-badge">
                  3
                </span>
              </button>

              <div className="top-divider" />

              <div className="profile">

                <div className="profile-avatar">
                  AD
                </div>

                <div>
                  <div className="profile-name">
                    Admin
                  </div>

                  <div className="profile-role">
                    MWOPS Organizer
                  </div>
                </div>

                <ChevronRight
                  className="profile-chevron"
                />

              </div>

            </div>

          </header>

          <main className="dashboard-content">

            {error && (
              <div className="error-banner">

                <span>
                  Dashboard API: {error}
                </span>

                <button
                  className="retry-button"
                  type="button"
                  onClick={() =>
                    loadDashboard(true)
                  }
                >
                  Retry
                </button>

              </div>
            )}

            <section className="hero">

              <div
                className="hero-image"
                style={{
                  backgroundImage:
                    `url("${DASHBOARD_VISUALS.hero}")`,
                }}
                aria-hidden="true"
              />

              <div className="hero-glow" />

              <div className="hero-grid" />

              <div className="hero-content">

                <div className="hero-eyebrow">
                  Good Evening
                </div>

                <h1 className="hero-title">
                  Welcome Back,
                  <span>
                    MWOPS Organizer!
                  </span>
                </h1>

                <div className="hero-tagline">
                  Manage • Compete • Broadcast
                </div>

                <p className="hero-description">
                  Your tournament operations command center.
                  Manage your tournaments, matches, teams and
                  live broadcasts — all in one place.
                </p>

                <div className="hero-actions">

                  <button
                    className="primary-button"
                    type="button"
                    onClick={() =>
                      goTo("/tournaments")
                    }
                  >
                    <Plus />
                    New Tournament
                  </button>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() =>
                      goTo("/matches")
                    }
                  >
                    View Matches
                    <ArrowRight />
                  </button>

                </div>

              </div>

              <div className="hero-side">

                <div className="hero-side-label">
                  Match Warfare Operations
                </div>

                <div className="hero-side-title">
                  Games Create Legends
                </div>

                <div className="hero-side-line" />

              </div>

            </section>

            <section className="stats-grid">

              {stats.map((stat) => {

                const Icon =
                  stat.icon;

                return (
                  <article
                    key={stat.label}
                    className={
                      `stat-card ${
                        stat.live
                          ? "live"
                          : ""
                      }`
                    }
                  >

                    <div
                      className="stat-visual"
                      style={{
                        backgroundImage:
                          `url("${stat.visual}")`,
                      }}
                      aria-hidden="true"
                    />

                    <div className="stat-top">

                      <div className="stat-icon">
                        <Icon />
                      </div>

                      {stat.live && (
                        <div className="stat-live">
                          <span className="stat-live-dot" />
                          LIVE
                        </div>
                      )}

                    </div>

                    <div className="stat-value">
                      {loading
                        ? "—"
                        : stat.value}
                    </div>

                    <div className="stat-label">
                      {stat.label}
                    </div>

                    <div className="stat-helper">
                      {stat.helper}
                    </div>

                  </article>
                );
              })}

            </section>

            <section className="section">

              <div className="section-header">

                <div className="section-title-wrap">

                  <div className="section-marker" />

                  <h2 className="section-title">
                    Quick Actions
                  </h2>

                  <span className="section-caption">
                    Essential organizer tools
                  </span>

                </div>

                <button
                  className="section-link"
                  type="button"
                  onClick={() =>
                    loadDashboard(true)
                  }
                  disabled={refreshing}
                >
                  {refreshing
                    ? "Refreshing..."
                    : "Refresh"}

                  <RefreshCw
                    className={
                      refreshing
                        ? "mwops-refreshing"
                        : ""
                    }
                  />
                </button>

              </div>

              <div className="quick-actions">

                {quickActions.map(
                  (action) => {

                    const Icon =
                      action.icon;

                    return (
                      <div
                        className="action-card"
                        key={action.title}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          goTo(action.route)
                        }
                        onKeyDown={(event) => {

                          if (
                            event.key ===
                              "Enter" ||
                            event.key ===
                              " "
                          ) {
                            event.preventDefault();

                            goTo(
                              action.route
                            );
                          }

                        }}
                      >

                        <div
                          className="action-visual"
                          style={{
                            backgroundImage:
                              `url("${action.visual}")`,
                          }}
                          aria-hidden="true"
                        />

                        <div className="action-accent" />

                        <div className="action-icon">
                          <Icon />
                        </div>

                        <div className="action-bottom">

                          <div>

                            <div className="action-title">
                              {action.title}
                            </div>

                            <div className="action-description">
                              {action.description}
                            </div>

                          </div>

                          <div className="action-arrow">
                            <ChevronRight />
                          </div>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>

            </section>

            <section className="section">

              <div className="content-grid">

                <div>

                  <div className="section-header">

                    <div className="section-title-wrap">

                      <div className="section-marker" />

                      <h2 className="section-title">
                        Your Tournaments
                      </h2>

                    </div>

                    <button
                      className="section-link"
                      type="button"
                      onClick={() =>
                        goTo("/tournaments")
                      }
                    >
                      View All
                      <ArrowRight />
                    </button>

                  </div>

                  {loading ? (

                    <div className="panel">

                      <div className="loading-panel">

                        <div className="loading-spinner" />

                        Loading tournaments...

                      </div>

                    </div>

                  ) : tournaments.length === 0 ? (

                    <div className="panel">

                      <div className="empty-panel">
                        No tournaments have been created yet.
                      </div>

                    </div>

                  ) : (

                    <div className="tournament-grid">

                      {tournaments
                        .slice(0, 4)
                        .map(
                          (tournament) => {

                            const statusClass =
                              tournament.status.toLowerCase();

                            return (
                              <article
                                className="tournament-card"
                                key={tournament.id}
                                onClick={() =>
                                  goTo(
                                    tournament.route
                                  )
                                }
                              >

                                {tournament.image ? (

                                  <div
                                    className="tournament-image"
                                    style={{
                                      backgroundImage:
                                        `url("${tournament.image}")`,
                                    }}
                                  />

                                ) : (

                                  <div className="tournament-image-placeholder" />

                                )}

                                <div className="tournament-overlay" />

                                <div className="tournament-visual-label">
                                  MWOPS / EVENT
                                </div>

                                <div className="tournament-accent" />

                                <div className="tournament-content">

                                  <div className="tournament-top">

                                    <div>

                                      <h3 className="tournament-title">
                                        {tournament.title}
                                      </h3>

                                      {tournament.subtitle && (
                                        <div className="tournament-game">
                                          {tournament.subtitle}
                                        </div>
                                      )}

                                    </div>

                                    <div
                                      className={
                                        `tournament-status ${
                                          statusClass
                                        }`
                                      }
                                    >
                                      {tournament.status}
                                    </div>

                                  </div>

                                  <div className="tournament-spacer" />

                                  {(
                                    tournament.teams !==
                                      null ||
                                    tournament.matches !==
                                      null
                                  ) && (

                                    <div className="tournament-meta">

                                      {tournament.teams !==
                                        null && (
                                        <div className="tournament-meta-item">
                                          <Users />
                                          {tournament.teams}
                                          {" "}
                                          Teams
                                        </div>
                                      )}

                                      {tournament.matches !==
                                        null && (
                                        <div className="tournament-meta-item">
                                          <Gamepad2 />
                                          {tournament.matches}
                                          {" "}
                                          Matches
                                        </div>
                                      )}

                                    </div>

                                  )}

                                  <div className="tournament-date">

                                    <CalendarDays
                                      style={{
                                        width: "10px",
                                        height: "10px",
                                        marginRight: "4px",
                                        verticalAlign:
                                          "middle",
                                      }}
                                    />

                                    {tournament.date}

                                  </div>

                                  <div className="tournament-bottom">

                                    <button
                                      className="manage-button"
                                      type="button"
                                      onClick={(event) => {

                                        event.stopPropagation();

                                        goTo(
                                          tournament.route
                                        );

                                      }}
                                    >
                                      Manage
                                      <ArrowRight />
                                    </button>

                                  </div>

                                </div>

                              </article>
                            );
                          }
                        )}

                    </div>

                  )}

                </div>

                <div>

                  <div className="section-header">

                    <div className="section-title-wrap">

                      <div className="section-marker" />

                      <h2 className="section-title">
                        Recent Matches
                      </h2>

                    </div>

                    <button
                      className="section-link"
                      type="button"
                      onClick={() =>
                        goTo("/matches")
                      }
                    >
                      View All
                      <ArrowRight />
                    </button>

                  </div>

                  <div className="panel">

                    {loading ? (

                      <div className="loading-panel">

                        <div className="loading-spinner" />

                        Loading matches...

                      </div>

                    ) : recentMatches.length === 0 ? (

                      <div className="empty-panel">
                        No matches have been created yet.
                      </div>

                    ) : (

                      recentMatches.map(
                        (match) => (

                          <div
                            className="match-row"
                            key={match.id}
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              goTo(
                                match.route
                              )
                            }
                            onKeyDown={(event) => {

                              if (
                                event.key ===
                                  "Enter" ||
                                event.key ===
                                  " "
                              ) {
                                event.preventDefault();

                                goTo(
                                  match.route
                                );
                              }

                            }}
                          >

                            <div className="match-number">
                              {match.number}
                            </div>

                            <div className="match-visual">

                              <img
                                src={match.image}
                                alt=""
                                loading="lazy"
                              />

                            </div>

                            <div>

                              <div className="match-title">
                                {match.match}
                              </div>

                              <div className="match-tournament">
                                {match.tournament}
                              </div>

                            </div>

                            <div className="match-right">

                              <div className="match-map">
                                {match.map}
                              </div>

                              <div
                                className={
                                  `match-status ${
                                    match.status.toLowerCase()
                                  }`
                                }
                              >
                                {match.status}
                              </div>

                            </div>

                          </div>

                        )
                      )

                    )}

                  </div>

                  <div className="system-panel">

                    <div className="section-header">

                      <div className="section-title-wrap">

                        <div className="section-marker" />

                        <h2 className="section-title">
                          System Status
                        </h2>

                      </div>

                      <button
                        className="section-link"
                        type="button"
                        onClick={() =>
                          goTo("/settings")
                        }
                      >
                        Settings
                        <Settings />
                      </button>

                    </div>

                    <div className="panel">

                      <div className="system-list">

                        {systemStatus.map(
                          (item) => {

                            const statusClass =
                              getSystemStatusClass(
                                item.status
                              );

                            return (
                              <div
                                className={
                                  `system-row ${
                                    statusClass
                                  }`
                                }
                                key={item.name}
                              >

                                <div
                                  className="system-visual"
                                  style={{
                                    backgroundImage:
                                      `url("${item.image}")`,
                                  }}
                                  aria-hidden="true"
                                />

                                <div className="system-name">
                                  {item.name}
                                </div>

                                <div
                                  className={
                                    `system-state ${
                                      statusClass
                                    }`
                                  }
                                >
                                  {item.status}
                                </div>

                              </div>
                            );
                          }
                        )}

                      </div>

                    </div>

                  </div>

                </div>

              </div>

            </section>

            <footer className="dashboard-footer">

              <div className="footer-brand">
                MW
                <span>O</span>
                PS
              </div>

              <div className="footer-center">

                <span className="footer-line" />

                <span>
                  Match Warfare Operations
                </span>

              </div>

              <div>
                Organize • Compete • Broadcast
              </div>

            </footer>

          </main>

        </div>
      </div>
    </>
  );
}

export default Dashboard;