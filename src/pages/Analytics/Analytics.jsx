/*
|--------------------------------------------------------------------------
| MWOPS ANALYTICS
|--------------------------------------------------------------------------
|
| Analytics dashboard for tournament operations.
| Designed to work with the MWOPS backend analytics endpoint.
|
| Expected API:
| GET /api/analytics
|
| The page does NOT invent analytics numbers.
| If backend data is unavailable, the UI clearly shows unavailable data.
|
|--------------------------------------------------------------------------
*/

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Crosshair,
  Database,
  Gamepad2,
  RefreshCw,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function unwrapResponse(payload) {
  if (!payload) return null;

  if (payload.data !== undefined) {
    return payload.data;
  }

  if (payload.result !== undefined) {
    return payload.result;
  }

  return payload;
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN").format(number);
}

function formatPercentage(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return `${number.toFixed(1)}%`;
}

function formatDuration(minutes) {
  if (minutes === null || minutes === undefined || minutes === "") {
    return "—";
  }

  const value = Number(minutes);

  if (!Number.isFinite(value)) {
    return "—";
  }

  if (value < 60) {
    return `${Math.round(value)}m`;
  }

  const hours = Math.floor(value / 60);
  const remainingMinutes = Math.round(value % 60);

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

function getStatusClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (
    normalized === "live" ||
    normalized === "ongoing" ||
    normalized === "active"
  ) {
    return "status-live";
  }

  if (
    normalized === "completed" ||
    normalized === "complete" ||
    normalized === "finished"
  ) {
    return "status-complete";
  }

  if (
    normalized === "upcoming" ||
    normalized === "scheduled" ||
    normalized === "pending"
  ) {
    return "status-upcoming";
  }

  return "status-neutral";
}

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

export default function Analytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchAnalytics = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await fetch(`${API_BASE_URL}/analytics`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        let message = `Analytics request failed with status ${response.status}.`;

        try {
          const errorPayload = await response.json();

          if (errorPayload?.message) {
            message = errorPayload.message;
          }

          if (errorPayload?.error) {
            message =
              typeof errorPayload.error === "string"
                ? errorPayload.error
                : message;
          }
        } catch {
          // Ignore invalid error JSON.
        }

        throw new Error(message);
      }

      const payload = await response.json();
      const data = unwrapResponse(payload);

      setAnalytics(data || {});
    } catch (requestError) {
      console.error("MWOPS Analytics error:", requestError);

      setAnalytics(null);

      setError(
        requestError?.message ||
          "Unable to load analytics. Please check the backend connection."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  /* ------------------------------------------------------------------------ */
  /* Normalized Data                                                          */
  /* ------------------------------------------------------------------------ */

  const stats = useMemo(() => {
    const source = analytics?.stats || analytics?.statistics || analytics || {};

    return {
      tournaments:
        source.tournaments ??
        source.totalTournaments ??
        source.total_tournaments ??
        null,

      matches:
        source.matches ??
        source.totalMatches ??
        source.total_matches ??
        null,

      teams:
        source.teams ??
        source.totalTeams ??
        source.total_teams ??
        null,

      players:
        source.players ??
        source.totalPlayers ??
        source.total_players ??
        null,

      completedMatches:
        source.completedMatches ??
        source.completed_matches ??
        null,

      liveMatches:
        source.liveMatches ??
        source.live_matches ??
        null,

      totalKills:
        source.totalKills ??
        source.total_kills ??
        source.kills ??
        null,

      averageMatchDuration:
        source.averageMatchDuration ??
        source.average_match_duration ??
        source.avgMatchDuration ??
        source.avg_match_duration ??
        null,
    };
  }, [analytics]);

  const matchPerformance = useMemo(() => {
    return (
      analytics?.matchPerformance ||
      analytics?.match_performance ||
      analytics?.performance ||
      {}
    );
  }, [analytics]);

  const tournamentPerformance = useMemo(() => {
    return (
      analytics?.tournamentPerformance ||
      analytics?.tournament_performance ||
      analytics?.tournamentsData ||
      analytics?.tournaments_data ||
      []
    );
  }, [analytics]);

  const topTeams = useMemo(() => {
    return (
      analytics?.topTeams ||
      analytics?.top_teams ||
      analytics?.teamsPerformance ||
      analytics?.teams_performance ||
      []
    );
  }, [analytics]);

  const activity = useMemo(() => {
    return (
      analytics?.activity ||
      analytics?.recentActivity ||
      analytics?.recent_activity ||
      []
    );
  }, [analytics]);

  /* ------------------------------------------------------------------------ */
  /* Derived values                                                           */
  /* ------------------------------------------------------------------------ */

  const completedMatches = stats.completedMatches;

  const liveMatches = stats.liveMatches;

  const totalMatches = stats.matches;

  const completionRate = useMemo(() => {
    if (
      completedMatches === null ||
      completedMatches === undefined ||
      totalMatches === null ||
      totalMatches === undefined ||
      Number(totalMatches) <= 0
    ) {
      return null;
    }

    return (Number(completedMatches) / Number(totalMatches)) * 100;
  }, [completedMatches, totalMatches]);

  const performanceBars = useMemo(() => {
    if (!matchPerformance || typeof matchPerformance !== "object") {
      return [];
    }

    const possible = [
      ["Completed", matchPerformance.completed ?? matchPerformance.complete],
      ["Live", matchPerformance.live ?? matchPerformance.ongoing],
      ["Upcoming", matchPerformance.upcoming ?? matchPerformance.scheduled],
      ["Paused", matchPerformance.paused],
    ];

    return possible
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([label, value]) => ({
        label,
        value: Number(value) || 0,
      }));
  }, [matchPerformance]);

  const maxPerformanceValue = Math.max(
    ...performanceBars.map((item) => item.value),
    1
  );

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="mwops-analytics-page">
      <style>{`
        .mwops-analytics-page {
          min-height: 100vh;
          width: 100%;
          background:
            radial-gradient(
              circle at 88% 0%,
              rgba(214, 164, 62, 0.07),
              transparent 30%
            ),
            radial-gradient(
              circle at 0% 100%,
              rgba(255, 255, 255, 0.025),
              transparent 28%
            ),
            #0a0b0d;
          color: #f4f1e8;
          padding: 28px;
          box-sizing: border-box;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .analytics-container {
          width: 100%;
          max-width: 1700px;
          margin: 0 auto;
        }

        .analytics-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 28px;
        }

        .analytics-title-wrap {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }

        .analytics-title-icon {
          width: 46px;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(214, 164, 62, 0.28);
          background: rgba(214, 164, 62, 0.08);
          color: #d6a43e;
          border-radius: 12px;
          flex-shrink: 0;
        }

        .analytics-eyebrow {
          margin: 0 0 5px;
          color: #d6a43e;
          font-size: 11px;
          line-height: 1;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-weight: 800;
        }

        .analytics-title {
          margin: 0;
          font-size: clamp(25px, 3vw, 34px);
          line-height: 1.05;
          font-weight: 800;
          letter-spacing: -0.035em;
        }

        .analytics-subtitle {
          margin: 8px 0 0;
          color: #8f9197;
          font-size: 13px;
          line-height: 1.6;
        }

        .analytics-header-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .analytics-button {
          border: 1px solid #2b2d31;
          background: #111316;
          color: #d7d8dc;
          min-height: 40px;
          padding: 0 14px;
          border-radius: 9px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition:
            border-color 0.18s ease,
            background 0.18s ease,
            transform 0.18s ease;
        }

        .analytics-button:hover {
          border-color: rgba(214, 164, 62, 0.5);
          background: #17181b;
          transform: translateY(-1px);
        }

        .analytics-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        .analytics-button-primary {
          border-color: rgba(214, 164, 62, 0.35);
          background: rgba(214, 164, 62, 0.12);
          color: #e4b95b;
        }

        .analytics-error {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 16px;
          margin-bottom: 22px;
          border: 1px solid rgba(211, 70, 70, 0.3);
          border-radius: 11px;
          background: rgba(211, 70, 70, 0.07);
          color: #f0b3b3;
        }

        .analytics-error strong {
          display: block;
          color: #f5d2d2;
          margin-bottom: 3px;
          font-size: 13px;
        }

        .analytics-error span {
          color: #c99494;
          font-size: 12px;
          line-height: 1.5;
        }

        .analytics-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 460px;
          border: 1px solid #202226;
          border-radius: 15px;
          background: #0f1012;
        }

        .loading-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 13px;
          color: #888b91;
          font-size: 13px;
        }

        .loading-spinner {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 2px solid #2b2d31;
          border-top-color: #d6a43e;
          animation: mwops-spin 0.8s linear infinite;
        }

        @keyframes mwops-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .analytics-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .stat-card {
          position: relative;
          min-height: 145px;
          padding: 18px;
          border: 1px solid #222428;
          border-radius: 13px;
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.025),
              rgba(255, 255, 255, 0)
            ),
            #101114;
          overflow: hidden;
        }

        .stat-card::after {
          content: "";
          position: absolute;
          width: 100px;
          height: 100px;
          right: -55px;
          bottom: -55px;
          border-radius: 50%;
          background: rgba(214, 164, 62, 0.06);
          pointer-events: none;
        }

        .stat-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .stat-label {
          color: #85878d;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .stat-icon {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #d6a43e;
          background: rgba(214, 164, 62, 0.08);
          border: 1px solid rgba(214, 164, 62, 0.14);
        }

        .stat-value {
          margin-top: 18px;
          font-size: 29px;
          font-weight: 800;
          letter-spacing: -0.04em;
          color: #f3f0e7;
        }

        .stat-meta {
          margin-top: 6px;
          color: #686b72;
          font-size: 11px;
        }

        .analytics-content-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.8fr);
          gap: 16px;
          margin-top: 16px;
        }

        .analytics-panel {
          border: 1px solid #222428;
          border-radius: 14px;
          background: #101114;
          overflow: hidden;
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 18px 19px;
          border-bottom: 1px solid #202226;
        }

        .panel-heading {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .panel-heading-icon {
          color: #d6a43e;
        }

        .panel-title {
          margin: 0;
          font-size: 14px;
          font-weight: 800;
          color: #e9e6de;
        }

        .panel-description {
          margin: 3px 0 0;
          color: #696c73;
          font-size: 11px;
        }

        .panel-body {
          padding: 18px;
        }

        .chart-area {
          min-height: 250px;
          display: flex;
          align-items: flex-end;
          gap: 14px;
          padding: 16px 8px 4px;
          border-bottom: 1px solid #25272b;
          position: relative;
        }

        .chart-area::before,
        .chart-area::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          border-top: 1px dashed rgba(255, 255, 255, 0.055);
          pointer-events: none;
        }

        .chart-area::before {
          top: 25%;
        }

        .chart-area::after {
          top: 60%;
        }

        .chart-empty {
          width: 100%;
          min-height: 220px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 8px;
          color: #65686e;
          font-size: 12px;
        }

        .chart-empty svg {
          opacity: 0.45;
        }

        .bar-item {
          flex: 1;
          min-width: 55px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          height: 215px;
          position: relative;
          z-index: 1;
        }

        .bar-value {
          color: #aaa7a0;
          font-size: 10px;
          margin-bottom: 7px;
          font-weight: 700;
        }

        .bar {
          width: min(58px, 70%);
          min-height: 4px;
          border-radius: 5px 5px 2px 2px;
          background: linear-gradient(
            to top,
            #a87d26,
            #d6a43e
          );
          box-shadow: 0 0 20px rgba(214, 164, 62, 0.08);
        }

        .bar-label {
          margin-top: 9px;
          color: #74777d;
          font-size: 10px;
          font-weight: 700;
          text-align: center;
        }

        .metric-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 13px 0;
          border-bottom: 1px solid #202226;
        }

        .metric-row:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .metric-row:first-child {
          padding-top: 0;
        }

        .metric-name {
          color: #8d8f95;
          font-size: 12px;
        }

        .metric-value {
          color: #e9e5dc;
          font-size: 13px;
          font-weight: 800;
        }

        .table-wrap {
          overflow-x: auto;
        }

        .analytics-table {
          width: 100%;
          border-collapse: collapse;
        }

        .analytics-table th {
          text-align: left;
          color: #62656b;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.09em;
          font-weight: 800;
          padding: 11px 18px;
          border-bottom: 1px solid #202226;
          white-space: nowrap;
        }

        .analytics-table td {
          padding: 13px 18px;
          border-bottom: 1px solid #1b1d20;
          color: #b9bac0;
          font-size: 12px;
          white-space: nowrap;
        }

        .analytics-table tr:last-child td {
          border-bottom: 0;
        }

        .analytics-table tbody tr:hover {
          background: rgba(255, 255, 255, 0.015);
        }

        .table-name {
          color: #e4e1d9;
          font-weight: 700;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          min-height: 23px;
          padding: 0 8px;
          border-radius: 6px;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border: 1px solid transparent;
        }

        .status-live {
          color: #f4b1b1;
          background: rgba(190, 50, 50, 0.11);
          border-color: rgba(190, 50, 50, 0.2);
        }

        .status-complete {
          color: #d6c08d;
          background: rgba(214, 164, 62, 0.08);
          border-color: rgba(214, 164, 62, 0.18);
        }

        .status-upcoming {
          color: #aaaeb7;
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .status-neutral {
          color: #8d9097;
          background: rgba(255, 255, 255, 0.035);
          border-color: rgba(255, 255, 255, 0.06);
        }

        .empty-state {
          min-height: 150px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 9px;
          color: #62656b;
          text-align: center;
          padding: 25px;
        }

        .empty-state svg {
          opacity: 0.4;
        }

        .empty-state strong {
          color: #85878d;
          font-size: 12px;
        }

        .empty-state span {
          max-width: 360px;
          font-size: 11px;
          line-height: 1.5;
        }

        .full-width-panel {
          margin-top: 16px;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
        }

        .activity-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 13px 0;
          border-bottom: 1px solid #1d1f22;
        }

        .activity-item:last-child {
          border-bottom: 0;
        }

        .activity-dot {
          width: 8px;
          height: 8px;
          margin-top: 5px;
          border-radius: 50%;
          background: #d6a43e;
          box-shadow: 0 0 12px rgba(214, 164, 62, 0.3);
          flex-shrink: 0;
        }

        .activity-text {
          flex: 1;
          min-width: 0;
          color: #b1b2b7;
          font-size: 12px;
          line-height: 1.5;
        }

        .activity-time {
          color: #62656b;
          font-size: 10px;
          white-space: nowrap;
        }

        .top-team-rank {
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid #27292d;
          color: #8b8d93;
          font-size: 10px;
          font-weight: 900;
          flex-shrink: 0;
        }

        .team-row {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 12px 0;
          border-bottom: 1px solid #1d1f22;
        }

        .team-row:last-child {
          border-bottom: 0;
        }

        .team-info {
          flex: 1;
          min-width: 0;
        }

        .team-name {
          color: #dedbd3;
          font-size: 12px;
          font-weight: 700;
        }

        .team-meta {
          margin-top: 3px;
          color: #62656b;
          font-size: 10px;
        }

        .team-score {
          color: #d6a43e;
          font-size: 13px;
          font-weight: 900;
        }

        @media (max-width: 1150px) {
          .analytics-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .analytics-content-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .mwops-analytics-page {
            padding: 16px;
          }

          .analytics-header {
            flex-direction: column;
          }

          .analytics-header-actions {
            width: 100%;
          }

          .analytics-button {
            flex: 1;
          }

          .analytics-grid {
            grid-template-columns: 1fr;
          }

          .panel-header {
            align-items: flex-start;
          }

          .chart-area {
            gap: 6px;
          }

          .bar {
            width: 70%;
          }
        }
      `}</style>

      <div className="analytics-container">
        {/* ---------------------------------------------------------------- */}
        {/* Header                                                           */}
        {/* ---------------------------------------------------------------- */}

        <header className="analytics-header">
          <div className="analytics-title-wrap">
            <div className="analytics-title-icon">
              <BarChart3 size={22} />
            </div>

            <div>
              <p className="analytics-eyebrow">Operations Intelligence</p>

              <h1 className="analytics-title">Analytics</h1>

              <p className="analytics-subtitle">
                Monitor tournament performance, match activity and operational
                metrics across MWOPS.
              </p>
            </div>
          </div>

          <div className="analytics-header-actions">
            <button
              type="button"
              className="analytics-button"
              onClick={() => fetchAnalytics(true)}
              disabled={loading || refreshing}
            >
              <RefreshCw
                size={14}
                className={refreshing ? "mwops-refresh-spin" : ""}
              />

              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </header>

        {/* ---------------------------------------------------------------- */}
        {/* Error                                                            */}
        {/* ---------------------------------------------------------------- */}

        {error && (
          <div className="analytics-error">
            <AlertCircle size={18} />

            <div>
              <strong>Analytics data unavailable</strong>

              <span>{error}</span>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Loading                                                           */}
        {/* ---------------------------------------------------------------- */}

        {loading ? (
          <div className="analytics-loading">
            <div className="loading-inner">
              <div className="loading-spinner" />
              <span>Loading MWOPS analytics...</span>
            </div>
          </div>
        ) : (
          <>
            {/* ------------------------------------------------------------ */}
            {/* Stats                                                         */}
            {/* ------------------------------------------------------------ */}

            <section className="analytics-grid">
              <StatCard
                icon={<Trophy size={17} />}
                label="Tournaments"
                value={formatNumber(stats.tournaments)}
                meta="Total tournaments"
              />

              <StatCard
                icon={<Gamepad2 size={17} />}
                label="Matches"
                value={formatNumber(stats.matches)}
                meta="Total matches"
              />

              <StatCard
                icon={<Users size={17} />}
                label="Players"
                value={formatNumber(stats.players)}
                meta="Registered players"
              />

              <StatCard
                icon={<Crosshair size={17} />}
                label="Total Kills"
                value={formatNumber(stats.totalKills)}
                meta="Recorded eliminations"
              />
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Main analytics                                                */}
            {/* ------------------------------------------------------------ */}

            <section className="analytics-content-grid">
              <div className="analytics-panel">
                <PanelHeader
                  icon={<Activity size={17} />}
                  title="Match Performance"
                  description="Current match distribution"
                />

                <div className="panel-body">
                  {performanceBars.length > 0 ? (
                    <div className="chart-area">
                      {performanceBars.map((item) => {
                        const height =
                          item.value <= 0
                            ? 4
                            : Math.max(
                                8,
                                (item.value / maxPerformanceValue) * 180
                              );

                        return (
                          <div
                            className="bar-item"
                            key={item.label}
                          >
                            <div className="bar-value">
                              {formatNumber(item.value)}
                            </div>

                            <div
                              className="bar"
                              style={{
                                height: `${height}px`,
                              }}
                            />

                            <div className="bar-label">
                              {item.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="chart-empty">
                      <BarChart3 size={25} />

                      <strong>No match performance data</strong>

                      <span>
                        Performance statistics will appear here once the
                        analytics backend provides them.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ---------------------------------------------------------- */}
              {/* Operational metrics                                         */}
              {/* ---------------------------------------------------------- */}

              <div className="analytics-panel">
                <PanelHeader
                  icon={<Zap size={17} />}
                  title="Operations"
                  description="Live platform metrics"
                />

                <div className="panel-body">
                  <MetricRow
                    name="Live Matches"
                    value={formatNumber(liveMatches)}
                  />

                  <MetricRow
                    name="Completed Matches"
                    value={formatNumber(completedMatches)}
                  />

                  <MetricRow
                    name="Completion Rate"
                    value={formatPercentage(completionRate)}
                  />

                  <MetricRow
                    name="Average Match"
                    value={formatDuration(stats.averageMatchDuration)}
                  />

                  <MetricRow
                    name="Teams Registered"
                    value={formatNumber(stats.teams)}
                  />
                </div>
              </div>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Tournament performance                                        */}
            {/* ------------------------------------------------------------ */}

            <section className="analytics-panel full-width-panel">
              <PanelHeader
                icon={<Trophy size={17} />}
                title="Tournament Performance"
                description="Tournament-level operational statistics"
              />

              {Array.isArray(tournamentPerformance) &&
              tournamentPerformance.length > 0 ? (
                <div className="table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Tournament</th>
                        <th>Status</th>
                        <th>Matches</th>
                        <th>Teams</th>
                        <th>Players</th>
                        <th>Completed</th>
                      </tr>
                    </thead>

                    <tbody>
                      {tournamentPerformance.map((tournament, index) => (
                        <tr
                          key={
                            tournament.id ||
                            tournament.tournament_id ||
                            index
                          }
                        >
                          <td>
                            <span className="table-name">
                              {tournament.name ||
                                tournament.tournament_name ||
                                "Unnamed Tournament"}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`status-badge ${getStatusClass(
                                tournament.status
                              )}`}
                            >
                              {tournament.status || "Unknown"}
                            </span>
                          </td>

                          <td>
                            {formatNumber(
                              tournament.matches ??
                                tournament.total_matches
                            )}
                          </td>

                          <td>
                            {formatNumber(
                              tournament.teams ??
                                tournament.total_teams
                            )}
                          </td>

                          <td>
                            {formatNumber(
                              tournament.players ??
                                tournament.total_players
                            )}
                          </td>

                          <td>
                            {formatNumber(
                              tournament.completedMatches ??
                                tournament.completed_matches
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={<Trophy size={25} />}
                  title="No tournament analytics yet"
                  description="Tournament performance data will appear here once matches and tournament activity are available."
                />
              )}
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Bottom grid                                                    */}
            {/* ------------------------------------------------------------ */}

            <section className="analytics-content-grid">
              {/* Top teams */}

              <div className="analytics-panel">
                <PanelHeader
                  icon={<Target size={17} />}
                  title="Top Teams"
                  description="Highest performing teams"
                />

                <div className="panel-body">
                  {Array.isArray(topTeams) && topTeams.length > 0 ? (
                    <div>
                      {topTeams.slice(0, 8).map((team, index) => (
                        <div
                          className="team-row"
                          key={team.id || team.team_id || index}
                        >
                          <div className="top-team-rank">
                            #{index + 1}
                          </div>

                          <div className="team-info">
                            <div className="team-name">
                              {team.name ||
                                team.team_name ||
                                "Unnamed Team"}
                            </div>

                            <div className="team-meta">
                              {formatNumber(
                                team.matches ??
                                  team.total_matches
                              )}{" "}
                              matches
                            </div>
                          </div>

                          <div className="team-score">
                            {formatNumber(
                              team.points ??
                                team.score ??
                                team.total_points
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Users size={25} />}
                      title="No team analytics yet"
                      description="Team performance will appear here after operational data is available."
                    />
                  )}
                </div>
              </div>

              {/* System / data health */}

              <div className="analytics-panel">
                <PanelHeader
                  icon={<Database size={17} />}
                  title="Data Health"
                  description="Analytics data availability"
                />

                <div className="panel-body">
                  <MetricRow
                    name="Analytics API"
                    value={analytics ? "Connected" : "Unavailable"}
                    valueIcon={
                      analytics ? (
                        <CheckCircle2 size={13} />
                      ) : (
                        <AlertCircle size={13} />
                      )
                    }
                  />

                  <MetricRow
                    name="Tournament Data"
                    value={
                      stats.tournaments !== null
                        ? "Available"
                        : "Unavailable"
                    }
                  />

                  <MetricRow
                    name="Match Data"
                    value={
                      stats.matches !== null
                        ? "Available"
                        : "Unavailable"
                    }
                  />

                  <MetricRow
                    name="Player Data"
                    value={
                      stats.players !== null
                        ? "Available"
                        : "Unavailable"
                    }
                  />

                  <MetricRow
                    name="Kill Data"
                    value={
                      stats.totalKills !== null
                        ? "Available"
                        : "Unavailable"
                    }
                  />
                </div>
              </div>
            </section>

            {/* ------------------------------------------------------------ */}
            {/* Activity                                                       */}
            {/* ------------------------------------------------------------ */}

            <section className="analytics-panel full-width-panel">
              <PanelHeader
                icon={<Clock3 size={17} />}
                title="Recent Activity"
                description="Latest operational events"
              />

              <div className="panel-body">
                {Array.isArray(activity) && activity.length > 0 ? (
                  <div className="activity-list">
                    {activity.slice(0, 10).map((item, index) => (
                      <div
                        className="activity-item"
                        key={item.id || index}
                      >
                        <div className="activity-dot" />

                        <div className="activity-text">
                          {item.message ||
                            item.description ||
                            item.event ||
                            item.action ||
                            "Operational activity recorded."}
                        </div>

                        <div className="activity-time">
                          {item.time ||
                            item.created_at ||
                            item.createdAt ||
                            "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Clock3 size={25} />}
                    title="No recent activity"
                    description="Recent operational activity will appear here as MWOPS processes tournament and match events."
                  />
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Components                                                                 */
/* -------------------------------------------------------------------------- */

function StatCard({ icon, label, value, meta }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <div className="stat-label">{label}</div>

        <div className="stat-icon">{icon}</div>
      </div>

      <div className="stat-value">{value}</div>

      <div className="stat-meta">{meta}</div>
    </div>
  );
}

function PanelHeader({ icon, title, description }) {
  return (
    <div className="panel-header">
      <div className="panel-heading">
        <div className="panel-heading-icon">{icon}</div>

        <div>
          <h2 className="panel-title">{title}</h2>

          {description && (
            <p className="panel-description">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricRow({ name, value, valueIcon }) {
  return (
    <div className="metric-row">
      <span className="metric-name">{name}</span>

      <span
        className="metric-value"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
        }}
      >
        {valueIcon}
        {value}
      </span>
    </div>
  );
}

function EmptyState({ icon, title, description }) {
  return (
    <div className="empty-state">
      {icon}

      <strong>{title}</strong>

      <span>{description}</span>
    </div>
  );
}