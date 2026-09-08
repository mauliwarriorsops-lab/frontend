import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";

/*
|--------------------------------------------------------------------------
| MWOPS MASTER BROADCAST OVERLAY
|--------------------------------------------------------------------------
|
| Premium Tournament Broadcast - Option A
|
| OBS:
|
| /overlay/master?matchId=MATCH_ID&theme=MWOPS%20DARK
|
| OR:
|
| /?overlay=master&matchId=MATCH_ID&theme=MWOPS%20DARK
|
|--------------------------------------------------------------------------
|
| DESIGN SYSTEM
|
| - 1920 x 1080 broadcast canvas
| - Transparent background
| - Graphite / black broadcast panels
| - MWOPS gold accent
| - Warm white typography
| - Red only for LIVE / danger
| - Compact esports broadcast geometry
| - Gameplay remains unobstructed
|
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| LIVE SYNC
|--------------------------------------------------------------------------
|
| The overlay is a read-only broadcast client.
|
| Until the backend realtime channel is added, the overlay uses a fast,
| lightweight sync loop. This keeps OBS synchronized with Control Room
| without requiring an OBS/browser refresh.
|
| Later, the same fetch function can be driven by the backend realtime
| event without changing the overlay rendering logic.
|
|--------------------------------------------------------------------------
*/
const REFRESH_INTERVAL = 750;
const REQUEST_TIMEOUT = 5000;

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || ""
).replace(/\/+$/, "");

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function getTeamName(team, fallback = "UNKNOWN") {
  return (
    team?.team_name ||
    team?.name ||
    team?.team?.team_name ||
    team?.team?.name ||
    team?.team?.short_name ||
    fallback
  );
}

function getTeamTag(team, fallback = "TEAM") {
  return (
    team?.team_tag ||
    team?.tag ||
    team?.team?.team_tag ||
    team?.team?.tag ||
    team?.team?.short_name ||
    fallback
  );
}

function getTeamLogo(team) {
  return (
    team?.logo_url ||
    team?.logo ||
    team?.team_logo ||
    team?.team?.logo_url ||
    team?.team?.logo ||
    team?.team?.team_logo ||
    ""
  );
}

function getPlayerName(
  player,
  fallback = "PLAYER"
) {
  return (
    player?.player_name ||
    player?.name ||
    player?.username ||
    player?.ign ||
    player?.player?.player_name ||
    player?.player?.name ||
    player?.player?.username ||
    fallback
  );
}

function getPlayerId(player) {
  return (
    player?.player_id ||
    player?.id ||
    player?.player?.id ||
    null
  );
}

function getPlayerKills(player) {
  return toNumber(
    player?.kills ??
      player?.eliminations ??
      player?.elims ??
      player?.player_stats?.kills ??
      player?.stats?.kills
  );
}

function getPlayerDamage(player) {
  return toNumber(
    player?.damage ??
      player?.damage_dealt ??
      player?.total_damage ??
      player?.player_stats?.damage ??
      player?.stats?.damage
  );
}

function getPlayerAssists(player) {
  return toNumber(
    player?.assists ??
      player?.player_stats?.assists ??
      player?.stats?.assists
  );
}

function isPlayerAlive(player) {
  if (!player) {
    return false;
  }

  if (
    player?.is_alive === true ||
    player?.alive === true ||
    player?.status === "alive" ||
    player?.status === "ALIVE"
  ) {
    return true;
  }

  if (
    player?.is_alive === false ||
    player?.alive === false ||
    player?.status === "eliminated" ||
    player?.status === "ELIMINATED" ||
    player?.status === "dead" ||
    player?.status === "DEAD"
  ) {
    return false;
  }

  return true;
}

function isTeamEliminated(team) {
  if (!team) {
    return false;
  }

  return (
    team?.is_eliminated === true ||
    team?.eliminated === true ||
    team?.status === "eliminated" ||
    team?.status === "ELIMINATED"
  );
}

function getTeamKills(team) {
  return toNumber(
    team?.kills ??
      team?.eliminations ??
      team?.elims ??
      team?.elimination_points
  );
}

function getTeamPoints(team) {
  return toNumber(
    team?.total_points ??
      team?.points ??
      team?.score ??
      team?.totalPoints
  );
}

function getTeamPlacement(team) {
  return toNumber(
    team?.placement ??
      team?.position ??
      team?.rank ??
      999
  );
}

function getTeamPlayers(team) {
  if (Array.isArray(team?.players)) {
    return team.players;
  }

  if (Array.isArray(team?.roster)) {
    return team.roster;
  }

  if (Array.isArray(team?.team_players)) {
    return team.team_players;
  }

  return [];
}

function formatTime(seconds) {
  const value = Math.max(
    0,
    toNumber(seconds)
  );

  const minutes = Math.floor(value / 60);

  const secs = Math.floor(
    value % 60
  );

  return `${String(minutes).padStart(
    2,
    "0"
  )}:${String(secs).padStart(2, "0")}`;
}

function getPositionSuffix(position) {
  const remainder10 =
    position % 10;

  const remainder100 =
    position % 100;

  if (
    remainder100 >= 11 &&
    remainder100 <= 13
  ) {
    return "TH";
  }

  if (remainder10 === 1) {
    return "ST";
  }

  if (remainder10 === 2) {
    return "ND";
  }

  if (remainder10 === 3) {
    return "RD";
  }

  return "TH";
}

function getPositionLabel(position) {
  if (
    !Number.isFinite(position) ||
    position <= 0 ||
    position === 999
  ) {
    return "--";
  }

  return `${position}${getPositionSuffix(
    position
  )}`;
}

/*
|--------------------------------------------------------------------------
| TEAM LOGO
|--------------------------------------------------------------------------
*/

function TeamLogo({
  team,
  large = false,
}) {
  const [failed, setFailed] =
    useState(false);

  const logo =
    getTeamLogo(team);

  const tag =
    getTeamTag(team);

  if (!logo || failed) {
    return (
      <div
        className={
          large
            ? "team-logo team-logo-large team-logo-fallback"
            : "team-logo team-logo-fallback"
        }
      >
        {tag
          .slice(0, 3)
          .toUpperCase()}
      </div>
    );
  }

  return (
    <div
      className={
        large
          ? "team-logo team-logo-large"
          : "team-logo"
      }
    >
      <img
        src={logo}
        alt=""
        onError={() =>
          setFailed(true)
        }
      />
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| ALIVE BARS
|--------------------------------------------------------------------------
*/

function AliveBars({
  count,
  max = 4,
}) {
  const safeCount = Math.max(
    0,
    Math.min(
      toNumber(count),
      max
    )
  );

  return (
    <div className="alive-bars">
      {Array.from({
        length: max,
      }).map((_, index) => (
        <span
          key={index}
          className={
            index < safeCount
              ? "alive-bar alive-bar-active"
              : "alive-bar"
          }
        />
      ))}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| MAIN OVERLAY
|--------------------------------------------------------------------------
*/

export default function MasterOverlay() {
  const [searchParams] =
    useSearchParams();

  const matchId =
    searchParams.get("matchId");

  const theme =
    searchParams.get("theme") ||
    "MWOPS DARK";

  const requestedTeamId =
    searchParams.get("teamId") ||
    searchParams.get(
      "focusTeamId"
    );

  const requestedPlayerId =
    searchParams.get("playerId") ||
    searchParams.get(
      "focusPlayerId"
    );

  const [state, setState] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState(null);

  /*
  |--------------------------------------------------------------------------
  | LIVE SYNC REFS
  |--------------------------------------------------------------------------
  |
  | Keep the overlay from creating overlapping requests. This matters in
  | OBS because a slow network response must never allow an older response
  | to overwrite newer match data.
  |
  |--------------------------------------------------------------------------
  */

  const requestInFlight =
    useRef(false);

  const mountedRef =
    useRef(true);

  /*
  |--------------------------------------------------------------------------
  | CONTROL ROOM API
  |--------------------------------------------------------------------------
  */

  const fetchControlRoom =
    useCallback(
      async (
        showLoading = false
      ) => {
        if (!matchId) {
          if (mountedRef.current) {
            setError(
              "Missing matchId"
            );

            setLoading(false);
          }

          return;
        }

        /*
        | Do not allow the 750ms sync loop to stack requests.
        */
        if (requestInFlight.current) {
          return;
        }

        requestInFlight.current = true;

        if (
          showLoading &&
          mountedRef.current
        ) {
          setLoading(true);
        }

        const controller =
          new AbortController();

        const timeoutId =
          window.setTimeout(
            () =>
              controller.abort(),
            REQUEST_TIMEOUT
          );

        try {
          const endpoint =
            `${API_BASE_URL}/control-room/${encodeURIComponent(
              matchId
            )}?_mwops_ts=${Date.now()}`;

          const response =
            await fetch(
              endpoint,
              {
                method: "GET",
                headers: {
                  Accept:
                    "application/json",
                  "Cache-Control":
                    "no-cache",
                  Pragma:
                    "no-cache",
                },
                cache: "no-store",
                signal:
                  controller.signal,
              }
            );

          if (!response.ok) {
            throw new Error(
              `Control Room API returned ${response.status}`
            );
          }

          const payload =
            await response.json();

          if (!payload?.success) {
            throw new Error(
              payload?.message ||
                "Unable to load Control Room data."
            );
          }

          if (!mountedRef.current) {
            return;
          }

          /*
          | Replace the broadcast state atomically.
          | React then re-renders the scoreboard, player HUD, rankings,
          | alive bars, kills and points from the newest server state.
          */
          setState(
            payload.data || null
          );

          setError("");

          setLastUpdated(
            new Date()
          );
        } catch (
          requestError
        ) {
          if (
            !mountedRef.current
          ) {
            return;
          }

          /*
          | Abort is expected when the request times out or the component
          | is being replaced. It should not create a noisy OBS error.
          */
          if (
            requestError?.name ===
            "AbortError"
          ) {
            setError(
              "Control Room sync timed out."
            );
          } else {
            console.error(
              "[MWOPS Overlay Sync]",
              requestError
            );

            /*
            | Keep the last valid state visible if the backend temporarily
            | drops. OBS should not blank the broadcast because of one
            | failed request.
            */
            setError(
              requestError?.message ||
                "Unable to connect to Control Room."
            );
          }
        } finally {
          window.clearTimeout(
            timeoutId
          );

          requestInFlight.current =
            false;

          if (
            showLoading &&
            mountedRef.current
          ) {
            setLoading(false);
          }
        }
      },
      [matchId]
    );

  /*
  |--------------------------------------------------------------------------
  | LIVE MATCH SYNC
  |--------------------------------------------------------------------------
  |
  | Control Room writes to the backend.
  | This overlay continuously reads the authoritative match state.
  |
  | The short interval makes changes appear in OBS almost immediately
  | while we keep the actual realtime transport in the backend layer.
  |
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    /*
    | Always fetch immediately when the OBS browser source loads or when
    | its matchId changes.
    */
    fetchControlRoom(true);

    let intervalId = null;

    const startSync = () => {
      if (intervalId !== null) {
        return;
      }

      intervalId =
        window.setInterval(
          () => {
            /*
            | OBS may briefly report the page as hidden while changing
            | scenes. Do not hammer the API in that situation.
            */
            if (
              document.hidden
            ) {
              return;
            }

            fetchControlRoom(
              false
            );
          },
          REFRESH_INTERVAL
        );
    };

    const stopSync = () => {
      if (
        intervalId !== null
      ) {
        window.clearInterval(
          intervalId
        );

        intervalId = null;
      }
    };

    const handleVisibility =
      () => {
        if (
          document.hidden
        ) {
          stopSync();
          return;
        }

        /*
        | Immediately catch up after OBS/browser visibility returns.
        */
        fetchControlRoom(
          false
        );

        startSync();
      };

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    startSync();

    return () => {
      stopSync();

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [
    fetchControlRoom,
  ]);

  /*
  |--------------------------------------------------------------------------
  | NORMALIZE TEAMS
  |--------------------------------------------------------------------------
  */

  const teams = useMemo(() => {
    if (!state) {
      return [];
    }

    let source = [];

    if (
      Array.isArray(
        state.results
      )
    ) {
      source = state.results;
    } else if (
      Array.isArray(
        state.team_stats
      )
    ) {
      source =
        state.team_stats;
    } else if (
      Array.isArray(
        state.teamStats
      )
    ) {
      source =
        state.teamStats;
    } else if (
      Array.isArray(
        state.teams
      )
    ) {
      source = state.teams;
    } else if (
      Array.isArray(
        state.match_teams
      )
    ) {
      source =
        state.match_teams;
    }

    return source
      .map(
        (
          team,
          index
        ) => {
          const players =
            getTeamPlayers(
              team
            );

          const alivePlayers =
            players.filter(
              isPlayerAlive
            );

          return {
            ...team,

            __index: index,

            __name:
              getTeamName(
                team,
                `TEAM ${index + 1}`
              ),

            __tag:
              getTeamTag(
                team,
                `T${index + 1}`
              ),

            __logo:
              getTeamLogo(team),

            __kills:
              getTeamKills(team),

            __points:
              getTeamPoints(team),

            __placement:
              getTeamPlacement(
                team
              ),

            __players:
              players,

            __alivePlayers:
              alivePlayers,

            __aliveCount:
              team?.alive_players ??
              team?.alivePlayers ??
              alivePlayers.length,

            __eliminated:
              isTeamEliminated(
                team
              ) ||
              alivePlayers.length ===
                0,
          };
        }
      )
      .sort(
        (a, b) => {
          const placementA =
            a.__placement;

          const placementB =
            b.__placement;

          if (
            placementA !==
              999 &&
            placementB !==
              999 &&
            placementA !==
              placementB
          ) {
            return (
              placementA -
              placementB
            );
          }

          if (
            b.__points !==
            a.__points
          ) {
            return (
              b.__points -
              a.__points
            );
          }

          if (
            b.__kills !==
            a.__kills
          ) {
            return (
              b.__kills -
              a.__kills
            );
          }

          return (
            a.__index -
            b.__index
          );
        }
      )
      .map(
        (
          team,
          index
        ) => ({
          ...team,

          __rank:
            team.__placement !==
            999
              ? team.__placement
              : index + 1,
        })
      );
  }, [state]);

  /*
  |--------------------------------------------------------------------------
  | MATCH DATA
  |--------------------------------------------------------------------------
  */

  const match =
    state?.match || {};

  const controlRoom =
    state?.control_room || {};

  const matchName =
    match?.name ||
    match?.match_name ||
    match?.title ||
    `MATCH ${
      matchId
        ? matchId.slice(
            0,
            8
          )
        : ""
    }`;

  const tournamentName =
    match?.tournament?.name ||
    match?.tournament_name ||
    state?.tournament?.name ||
    "MWOPS ESPORTS";

  const matchStatus =
    match?.status ||
    controlRoom?.status ||
    "LIVE";

  const totalPlayers =
    toNumber(
      controlRoom?.total_players ??
        state?.players?.length
    );

  const alivePlayers =
    toNumber(
      controlRoom?.alive_players ??
        teams.reduce(
          (
            sum,
            team
          ) =>
            sum +
            toNumber(
              team.__aliveCount
            ),
          0
        )
    );

  const totalKills =
    toNumber(
      controlRoom?.total_kills ??
        teams.reduce(
          (
            sum,
            team
          ) =>
            sum +
            team.__kills,
          0
        )
    );

  const totalPoints =
    toNumber(
      controlRoom?.total_points ??
        teams.reduce(
          (
            sum,
            team
          ) =>
            sum +
            team.__points,
          0
        )
    );

  /*
  |--------------------------------------------------------------------------
  | TIMER
  |--------------------------------------------------------------------------
  */

  const matchStartedAt =
    match?.started_at ||
    match?.start_time ||
    match?.startedAt ||
    null;

  const matchEndedAt =
    match?.ended_at ||
    match?.end_time ||
    match?.endedAt ||
    null;

  const [clockNow, setClockNow] =
    useState(Date.now());

  useEffect(() => {
    const timer =
      window.setInterval(
        () =>
          setClockNow(
            Date.now()
          ),
        1000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, []);

  const matchElapsedSeconds =
    useMemo(() => {
      if (!matchStartedAt) {
        return 0;
      }

      const start =
        new Date(
          matchStartedAt
        ).getTime();

      if (
        !Number.isFinite(start)
      ) {
        return 0;
      }

      const end =
        matchEndedAt
          ? new Date(
              matchEndedAt
            ).getTime()
          : clockNow;

      if (
        !Number.isFinite(end)
      ) {
        return 0;
      }

      return Math.max(
        0,
        Math.floor(
          (end - start) /
            1000
        )
      );
    }, [
      matchStartedAt,
      matchEndedAt,
      clockNow,
    ]);

  /*
  |--------------------------------------------------------------------------
  | FOCUS TEAM
  |--------------------------------------------------------------------------
  */

  const currentTeam =
    useMemo(() => {
      if (!teams.length) {
        return null;
      }

      if (requestedTeamId) {
        const requested =
          teams.find(
            (team) =>
              String(
                team?.team_id ||
                  team?.id ||
                  team?.team?.id
              ) ===
              String(
                requestedTeamId
              )
          );

        if (requested) {
          return requested;
        }
      }

      return (
        teams.find(
          (team) =>
            !team.__eliminated
        ) ||
        teams[0]
      );
    }, [
      teams,
      requestedTeamId,
    ]);

  /*
  |--------------------------------------------------------------------------
  | PLAYERS
  |--------------------------------------------------------------------------
  */

  const allPlayers =
    useMemo(() => {
      if (
        Array.isArray(
          state?.players
        )
      ) {
        return state.players;
      }

      return teams.flatMap(
        (team) =>
          team.__players.map(
            (player) => ({
              ...player,

              team_id:
                player?.team_id ||
                team?.team_id ||
                team?.id,
            })
          )
      );
    }, [state, teams]);

  const currentPlayer =
    useMemo(() => {
      if (!allPlayers.length) {
        return null;
      }

      if (requestedPlayerId) {
        const requested =
          allPlayers.find(
            (player) =>
              String(
                getPlayerId(
                  player
                )
              ) ===
              String(
                requestedPlayerId
              )
          );

        if (requested) {
          return requested;
        }
      }

      if (
        currentTeam?.__players
          ?.length
      ) {
        return (
          currentTeam.__players.find(
            isPlayerAlive
          ) ||
          currentTeam
            .__players[0]
        );
      }

      return (
        allPlayers.find(
          isPlayerAlive
        ) ||
        allPlayers[0]
      );
    }, [
      allPlayers,
      currentTeam,
      requestedPlayerId,
    ]);

  const currentTeamPlayers =
    currentTeam?.__players || [];

  /*
  |--------------------------------------------------------------------------
  | MISSING MATCH
  |--------------------------------------------------------------------------
  */

  if (!matchId) {
    return (
      <div className="overlay-error">
        <style>
          {GLOBAL_STYLES}
        </style>

        <div className="error-card">
          <div className="error-brand">
            MWOPS
          </div>

          <div className="error-title">
            MATCH ID REQUIRED
          </div>

          <div className="error-copy">
            Add a valid matchId to
            the overlay URL.
          </div>
        </div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | MAIN RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <div className="mwops-overlay">
      <style>
        {GLOBAL_STYLES}
      </style>

      {/* ================================================================
          TOP LEFT MATCH STATS
          ================================================================ */}

      <div className="match-stats">

        <div className="stat-box">
          <span>
            REMAINING
          </span>

          <strong>
            {alivePlayers}
          </strong>
        </div>

        <div className="stat-box">
          <span>
            TEAMS
          </span>

          <strong>
            {teams.length}
          </strong>
        </div>

        <div className="stat-box stat-time">
          <span>
            TIME
          </span>

          <strong>
            {formatTime(
              matchElapsedSeconds
            )}
          </strong>
        </div>

      </div>

      {/* ================================================================
          TOP RIGHT BRAND
          ================================================================ */}

      <div className="mwops-brand">
        <div className="mwops-wordmark">
          MWOPS
        </div>

        <div className="brand-line" />

        <div className="event-name">
          {tournamentName}
        </div>
      </div>

      {/* ================================================================
          LEFT TEAM PANEL
          ================================================================ */}

      <section className="team-panel">

        <div className="team-panel-header">

          <div className="team-logo-wrap">
            <TeamLogo
              team={currentTeam}
              large
            />
          </div>

          <div className="team-heading">

            <div className="team-heading-tag">
              {currentTeam?.__tag ||
                "TEAM"}
            </div>

            <div className="team-heading-name">
              {currentTeam?.__name ||
                "NO TEAM"}
            </div>

          </div>

          <div className="team-position">
            <span>
              #
            </span>

            {currentTeam?.__rank ||
              "--"}
          </div>

        </div>

        <div className="team-players">

          {currentTeamPlayers.length >
          0 ? (
            currentTeamPlayers
              .slice(0, 4)
              .map(
                (
                  player,
                  index
                ) => {
                  const alive =
                    isPlayerAlive(
                      player
                    );

                  return (
                    <div
                      className={
                        alive
                          ? "team-player"
                          : "team-player team-player-dead"
                      }
                      key={
                        getPlayerId(
                          player
                        ) ||
                        `${index}-${getPlayerName(
                          player
                        )}`
                      }
                    >
                      <div className="player-live-indicator">
                        <span
                          className={
                            alive
                              ? "player-dot player-dot-live"
                              : "player-dot player-dot-dead"
                          }
                        />
                      </div>

                      <div className="player-slot">
                        {String(
                          index + 1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </div>

                      <div className="player-ign">
                        {getPlayerName(
                          player,
                          `PLAYER ${
                            index + 1
                          }`
                        )}
                      </div>

                      <div className="player-elims">
                        {getPlayerKills(
                          player
                        )}
                      </div>
                    </div>
                  );
                }
              )
          ) : (
            <div className="roster-empty">
              ROSTER DATA UNAVAILABLE
            </div>
          )}

        </div>

        <div className="team-footer">

          <div>
            <span>
              ALIVE
            </span>

            <strong>
              {currentTeam
                ? currentTeam.__aliveCount
                : 0}
            </strong>
          </div>

          <div>
            <span>
              ELIMS
            </span>

            <strong>
              {currentTeam
                ? currentTeam.__kills
                : 0}
            </strong>
          </div>

          <div>
            <span>
              POINTS
            </span>

            <strong>
              {currentTeam
                ? currentTeam.__points
                : 0}
            </strong>
          </div>

        </div>

      </section>

      {/* ================================================================
          CENTER MATCH / MAP MODULE
          ================================================================ */}

      <section className="map-panel">

        <div className="map-header">

          <div className="map-match">
            {matchName}
          </div>

          <div className="map-live">
            <span />
            {String(
              matchStatus
            ).toUpperCase()}
          </div>

        </div>

        <div className="map-content">

          <div className="map-grid" />

          <div className="map-circle map-circle-outer" />
          <div className="map-circle map-circle-middle" />
          <div className="map-circle map-circle-inner" />

          <div className="map-cross map-cross-x" />
          <div className="map-cross map-cross-y" />

          {teams
            .slice(0, 16)
            .map(
              (
                team,
                index
              ) => (
                <span
                  key={
                    team?.team_id ||
                    team?.id ||
                    index
                  }
                  className={
                    team.__eliminated
                      ? "map-dot map-dot-dead"
                      : "map-dot"
                  }
                  style={{
                    left: `${
                      15 +
                      ((index *
                        31) %
                        70)
                    }%`,
                    top: `${
                      18 +
                      ((index *
                        47) %
                        62)
                    }%`,
                  }}
                />
              )
            )}

          <div className="map-label">
            LIVE MAP
          </div>

        </div>

        <div className="map-footer">

          <div>
            <span>
              STAGE
            </span>

            <strong>
              {match?.stage ||
                match?.stage_number ||
                match?.current_stage ||
                "--"}
            </strong>
          </div>

          <div className="map-divider" />

          <div>
            <span>
              ALIVE
            </span>

            <strong>
              {alivePlayers}
            </strong>
          </div>

        </div>

      </section>

      {/* ================================================================
          RIGHT LIVE LEADERBOARD
          ================================================================ */}

      <section className="leaderboard">

        <div className="leaderboard-header">

          <div className="leaderboard-title">
            <span className="live-indicator" />
            LIVE RANKING
          </div>

          <div className="leaderboard-headings">
            <span>
              ALIVE
            </span>

            <span>
              PTS
            </span>

            <span>
              ELIMS
            </span>
          </div>

        </div>

        <div className="leaderboard-list">

          {teams.length > 0 ? (
            teams
              .slice(0, 16)
              .map(
                (
                  team,
                  index
                ) => {

                  const rank =
                    team.__rank ||
                    index + 1;

                  const alive =
                    toNumber(
                      team.__aliveCount
                    );

                  const teamId =
                    team?.team_id ||
                    team?.id ||
                    team?.team?.id;

                  const currentTeamId =
                    currentTeam?.team_id ||
                    currentTeam?.id ||
                    currentTeam?.team?.id;

                  const highlighted =
                    currentTeamId &&
                    String(
                      currentTeamId
                    ) ===
                      String(
                        teamId
                      );

                  return (
                    <div
                      key={
                        teamId ||
                        `${team.__tag}-${index}`
                      }
                      className={
                        highlighted
                          ? "ranking-team-row ranking-selected"
                          : team.__eliminated
                          ? "ranking-team-row ranking-dead"
                          : "ranking-team-row"
                      }
                    >

                      <div className="rank">
                        {rank}
                      </div>

                      <div className="rank-logo">
                        <TeamLogo
                          team={team}
                        />
                      </div>

                      <div className="rank-team">

                        <div className="rank-tag">
                          {team.__tag}
                        </div>

                        <div className="rank-name">
                          {team.__name}
                        </div>

                      </div>

                      <div className="rank-alive">
                        <AliveBars
                          count={alive}
                        />
                      </div>

                      <div className="rank-points">
                        {team.__points}
                      </div>

                      <div className="rank-kills">
                        {team.__kills}
                      </div>

                    </div>
                  );
                }
              )
          ) : (
            <div className="leaderboard-empty">
              WAITING FOR TEAM DATA
            </div>
          )}

        </div>

        <div className="leaderboard-footer">

          <div>
            <span>
              PLAYERS
            </span>

            <strong>
              {totalPlayers}
            </strong>
          </div>

          <div>
            <span>
              ELIMS
            </span>

            <strong>
              {totalKills}
            </strong>
          </div>

          <div>
            <span>
              TOTAL PTS
            </span>

            <strong>
              {totalPoints}
            </strong>
          </div>

        </div>

      </section>

      {/* ================================================================
          BOTTOM PLAYER HUD
          ================================================================ */}

      {currentPlayer && (
        <section className="player-hud">

          <div className="hud-team">

            <TeamLogo
              team={currentTeam}
              large
            />

            <div>
              <div className="hud-team-tag">
                {currentTeam?.__tag ||
                  "TEAM"}
              </div>

              <div className="hud-team-name">
                {currentTeam?.__name ||
                  "UNKNOWN TEAM"}
              </div>
            </div>

          </div>

          <div className="hud-player">

            <div className="hud-player-name">
              {getPlayerName(
                currentPlayer
              )}
            </div>

            <div className="hud-status">

              <span
                className={
                  isPlayerAlive(
                    currentPlayer
                  )
                    ? "hud-status-dot hud-status-live"
                    : "hud-status-dot hud-status-dead"
                }
              />

              {isPlayerAlive(
                currentPlayer
              )
                ? "ALIVE"
                : "ELIMINATED"}

            </div>

          </div>

          <div className="hud-stat">
            <span>
              ELIMINATIONS
            </span>

            <strong>
              {getPlayerKills(
                currentPlayer
              )}
            </strong>
          </div>

          <div className="hud-stat">
            <span>
              DAMAGE
            </span>

            <strong>
              {getPlayerDamage(
                currentPlayer
              )}
            </strong>
          </div>

          <div className="hud-stat">
            <span>
              ASSISTS
            </span>

            <strong>
              {getPlayerAssists(
                currentPlayer
              )}
            </strong>
          </div>

          <div className="hud-rank">
            <span>
              RANK
            </span>

            <strong>
              {getPositionLabel(
                currentTeam?.__rank
              )}
            </strong>
          </div>

        </section>
      )}

      {/* ================================================================
          CONNECTION
          ================================================================ */}

      <div className="connection">

        <span
          className={
            error
              ? "connection-dot connection-error"
              : loading
              ? "connection-dot connection-loading"
              : "connection-dot connection-online"
          }
        />

        <span>
          {error
            ? "CONTROL ROOM OFFLINE"
            : loading
            ? "CONNECTING"
            : "LIVE"}
        </span>

        {lastUpdated &&
          !error && (
            <span className="connection-time">
              {lastUpdated.toLocaleTimeString(
                [],
                {
                  hour:
                    "2-digit",
                  minute:
                    "2-digit",
                  second:
                    "2-digit",
                }
              )}
            </span>
          )}

      </div>

      {/* ================================================================
          INITIAL LOADING
          ================================================================ */}

      {loading && !state && (
        <div className="overlay-loading">

          <div className="loading-ring" />

          <div className="loading-brand">
            MWOPS
          </div>

          <div className="loading-text">
            CONNECTING TO CONTROL ROOM
          </div>

        </div>
      )}

    </div>
  );
}

/*
|--------------------------------------------------------------------------
| GLOBAL STYLES
|--------------------------------------------------------------------------
*/

const GLOBAL_STYLES = `
  * {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: transparent !important;
  }

  body {
    font-family:
      Inter,
      "Segoe UI",
      Arial,
      sans-serif;

    color: #f5f1e8;

    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
  }

  /*
  |--------------------------------------------------------------------------
  | MAIN 1920 x 1080 BROADCAST CANVAS
  |--------------------------------------------------------------------------
  */

  .mwops-overlay {
    position: fixed;
    inset: 0;

    width: 100vw;
    height: 100vh;

    overflow: hidden;

    pointer-events: none;

    background: transparent;

    --gold: #d9b94f;
    --gold-bright: #f0d269;

    --white: #f5f1e8;

    --panel:
      rgba(5, 8, 10, 0.93);

    --panel-dark:
      rgba(3, 5, 7, 0.96);

    --line:
      rgba(255, 255, 255, 0.08);

    --muted:
      rgba(255, 255, 255, 0.38);

    --live: #e45858;

    --alive: #56dfb5;
  }

  /*
  |--------------------------------------------------------------------------
  | TOP MATCH STATS
  |--------------------------------------------------------------------------
  */

  .match-stats {
    position: absolute;

    top: 22px;
    left: 24px;

    display: flex;

    gap: 5px;

    height: 44px;
  }

  .stat-box {
    min-width: 106px;

    height: 44px;

    display: flex;
    align-items: center;

    gap: 10px;

    padding: 0 13px;

    background:
      linear-gradient(
        180deg,
        rgba(13, 16, 19, 0.97),
        rgba(5, 7, 9, 0.95)
      );

    border-left:
      3px solid var(--gold);

    box-shadow:
      0 7px 22px
        rgba(0, 0, 0, 0.32);
  }

  .stat-box span {
    color:
      rgba(255, 255, 255, 0.43);

    font-size: 8px;

    font-weight: 900;

    letter-spacing: 0.12em;
  }

  .stat-box strong {
    color: #ffffff;

    font-size: 17px;

    font-weight: 950;

    line-height: 1;

    font-variant-numeric:
      tabular-nums;
  }

  .stat-time {
    min-width: 124px;
  }

  .stat-time strong {
    color: var(--gold-bright);
  }

  /*
  |--------------------------------------------------------------------------
  | MWOPS BRAND
  |--------------------------------------------------------------------------
  */

  .mwops-brand {
    position: absolute;

    top: 22px;
    right: 24px;

    height: 44px;

    display: flex;
    align-items: center;

    gap: 12px;

    padding: 0 15px;

    background:
      linear-gradient(
        180deg,
        rgba(8, 11, 13, 0.97),
        rgba(3, 5, 7, 0.95)
      );

    border-right:
      3px solid var(--gold);

    box-shadow:
      0 7px 22px
        rgba(0, 0, 0, 0.32);
  }

  .mwops-wordmark {
    color: var(--gold-bright);

    font-size: 16px;

    font-weight: 1000;

    letter-spacing: 0.08em;
  }

  .brand-line {
    width: 1px;
    height: 19px;

    background:
      rgba(255, 255, 255, 0.17);
  }

  .event-name {
    max-width: 260px;

    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    color:
      rgba(255, 255, 255, 0.7);

    font-size: 8px;

    font-weight: 850;

    letter-spacing: 0.12em;

    text-transform: uppercase;
  }

  /*
  |--------------------------------------------------------------------------
  | LEFT TEAM PANEL
  |--------------------------------------------------------------------------
  */

  .team-panel {
    position: absolute;

    top: 79px;
    left: 24px;

    width: 318px;

    background:
      linear-gradient(
        180deg,
        rgba(7, 10, 12, 0.96),
        rgba(3, 5, 7, 0.93)
      );

    border-left:
      3px solid var(--gold);

    box-shadow:
      0 13px 42px
        rgba(0, 0, 0, 0.4);
  }

  .team-panel-header {
    min-height: 76px;

    display: flex;
    align-items: center;

    padding: 9px 12px;

    border-bottom:
      1px solid var(--line);

    background:
      linear-gradient(
        90deg,
        rgba(217, 185, 79, 0.12),
        transparent 70%
      );
  }

  .team-logo-wrap {
    width: 48px;
    height: 48px;

    display: flex;
    align-items: center;
    justify-content: center;

    margin-right: 11px;

    background:
      rgba(255, 255, 255, 0.045);
  }

  .team-heading {
    flex: 1;

    min-width: 0;
  }

  .team-heading-tag {
    color: var(--gold-bright);

    font-size: 11px;

    font-weight: 950;

    letter-spacing: 0.13em;
  }

  .team-heading-name {
    margin-top: 3px;

    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    color: #ffffff;

    font-size: 13px;

    font-weight: 950;

    text-transform: uppercase;
  }

  .team-position {
    min-width: 43px;

    color: #ffffff;

    font-size: 18px;

    font-weight: 950;

    text-align: right;

    font-variant-numeric:
      tabular-nums;
  }

  .team-position span {
    color:
      rgba(255, 255, 255, 0.35);

    font-size: 9px;

    margin-right: 2px;
  }

  /*
  |--------------------------------------------------------------------------
  | TEAM PLAYERS
  |--------------------------------------------------------------------------
  */

  .team-players {
    padding: 5px 8px;
  }

  .team-player {
    height: 34px;

    display: grid;

    grid-template-columns:
      20px
      27px
      1fr
      32px;

    align-items: center;

    border-bottom:
      1px solid
      rgba(255, 255, 255, 0.045);
  }

  .team-player:last-child {
    border-bottom: 0;
  }

  .player-live-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .player-dot {
    width: 6px;
    height: 6px;

    border-radius: 50%;
  }

  .player-dot-live {
    background: var(--alive);

    box-shadow:
      0 0 7px
        rgba(86, 223, 181, 0.65);
  }

  .player-dot-dead {
    background: #5c6167;
  }

  .player-slot {
    color:
      rgba(255, 255, 255, 0.28);

    font-size: 8px;

    font-weight: 900;

    font-variant-numeric:
      tabular-nums;
  }

  .player-ign {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    color:
      rgba(255, 255, 255, 0.86);

    font-size: 10px;

    font-weight: 850;

    text-transform: uppercase;
  }

  .player-elims {
    color: var(--gold-bright);

    font-size: 12px;

    font-weight: 950;

    text-align: right;
  }

  .team-player-dead {
    opacity: 0.42;
  }

  .roster-empty {
    height: 108px;

    display: flex;
    align-items: center;
    justify-content: center;

    color:
      rgba(255, 255, 255, 0.3);

    font-size: 8px;

    font-weight: 900;

    letter-spacing: 0.11em;
  }

  /*
  |--------------------------------------------------------------------------
  | TEAM FOOTER
  |--------------------------------------------------------------------------
  */

  .team-footer {
    height: 42px;

    display: grid;

    grid-template-columns:
      repeat(3, 1fr);

    border-top:
      1px solid var(--line);
  }

  .team-footer > div {
    display: flex;

    flex-direction: column;

    align-items: center;

    justify-content: center;

    border-right:
      1px solid var(--line);
  }

  .team-footer > div:last-child {
    border-right: 0;
  }

  .team-footer span {
    color:
      rgba(255, 255, 255, 0.32);

    font-size: 7px;

    font-weight: 900;

    letter-spacing: 0.1em;
  }

  .team-footer strong {
    margin-top: 3px;

    color: #ffffff;

    font-size: 12px;

    font-weight: 950;
  }

  /*
  |--------------------------------------------------------------------------
  | MAP PANEL
  |--------------------------------------------------------------------------
  |
  | Positioned between left team panel and right leaderboard.
  |
  */

  .map-panel {
    position: absolute;

    top: 79px;

    right: 462px;

    width: 242px;

    background:
      rgba(4, 7, 9, 0.94);

    border:
      1px solid
      rgba(255, 255, 255, 0.09);

    box-shadow:
      0 13px 42px
        rgba(0, 0, 0, 0.4);
  }

  .map-header {
    height: 35px;

    display: flex;

    align-items: center;

    padding: 0 9px;

    background:
      rgba(217, 185, 79, 0.09);

    border-bottom:
      1px solid var(--line);
  }

  .map-match {
    flex: 1;

    min-width: 0;

    overflow: hidden;

    text-overflow: ellipsis;

    white-space: nowrap;

    color: #ffffff;

    font-size: 7px;

    font-weight: 900;

    text-transform: uppercase;
  }

  .map-live {
    display: flex;

    align-items: center;

    gap: 5px;

    color: var(--live);

    font-size: 6px;

    font-weight: 950;

    letter-spacing: 0.08em;
  }

  .map-live span {
    width: 5px;
    height: 5px;

    border-radius: 50%;

    background: var(--live);

    box-shadow:
      0 0 7px
        rgba(228, 88, 88, 0.7);
  }

  .map-content {
    position: relative;

    height: 158px;

    overflow: hidden;

    background:
      radial-gradient(
        circle at center,
        rgba(217, 185, 79, 0.12),
        rgba(6, 15, 16, 0.94) 55%,
        rgba(2, 5, 7, 0.99)
      );
  }

  .map-grid {
    position: absolute;
    inset: 0;

    opacity: 0.2;

    background-image:
      linear-gradient(
        rgba(255, 255, 255, 0.08) 1px,
        transparent 1px
      ),
      linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.08) 1px,
        transparent 1px
      );

    background-size:
      22px 22px;
  }

  .map-circle {
    position: absolute;

    left: 50%;
    top: 50%;

    transform:
      translate(-50%, -50%);

    border:
      1px solid
      rgba(217, 185, 79, 0.28);

    border-radius: 50%;
  }

  .map-circle-outer {
    width: 116px;
    height: 116px;
  }

  .map-circle-middle {
    width: 76px;
    height: 76px;
  }

  .map-circle-inner {
    width: 35px;
    height: 35px;

    background:
      rgba(217, 185, 79, 0.04);
  }

  .map-cross {
    position: absolute;

    left: 50%;
    top: 50%;

    background:
      rgba(217, 185, 79, 0.22);
  }

  .map-cross-x {
    width: 100%;
    height: 1px;

    transform:
      translate(-50%, -50%);
  }

  .map-cross-y {
    width: 1px;
    height: 100%;

    transform:
      translate(-50%, -50%);
  }

  .map-dot {
    position: absolute;

    width: 5px;
    height: 5px;

    transform:
      translate(-50%, -50%);

    border-radius: 50%;

    background: var(--alive);

    box-shadow:
      0 0 8px
        rgba(86, 223, 181, 0.75);
  }

  .map-dot-dead {
    background: #7b6060;

    box-shadow: none;
  }

  .map-label {
    position: absolute;

    left: 9px;
    bottom: 7px;

    color:
      rgba(255, 255, 255, 0.36);

    font-size: 6px;

    font-weight: 900;

    letter-spacing: 0.14em;
  }

  .map-footer {
    height: 35px;

    display: flex;

    align-items: center;

    padding: 0 10px;

    gap: 8px;

    border-top:
      1px solid var(--line);
  }

  .map-footer > div:not(.map-divider) {
    display: flex;

    align-items: center;

    gap: 7px;
  }

  .map-footer span {
    color:
      rgba(255, 255, 255, 0.32);

    font-size: 6px;

    font-weight: 900;

    letter-spacing: 0.08em;
  }

  .map-footer strong {
    color: var(--gold-bright);

    font-size: 9px;

    font-weight: 950;
  }

  .map-divider {
    width: 1px;
    height: 15px;

    background:
      rgba(255, 255, 255, 0.1);
  }

  /*
  |--------------------------------------------------------------------------
  | RIGHT LEADERBOARD
  |--------------------------------------------------------------------------
  */

  .leaderboard {
    position: absolute;

    top: 79px;
    right: 24px;

    width: 418px;

    background:
      linear-gradient(
        180deg,
        rgba(6, 9, 11, 0.97),
        rgba(3, 5, 7, 0.95)
      );

    border-right:
      3px solid var(--gold);

    box-shadow:
      0 13px 42px
        rgba(0, 0, 0, 0.42);
  }

  .leaderboard-header {
    height: 43px;

    display: grid;

    grid-template-columns:
      1fr
      150px;

    align-items: center;

    padding: 0 9px;

    background:
      linear-gradient(
        90deg,
        rgba(217, 185, 79, 0.12),
        transparent
      );

    border-bottom:
      1px solid var(--line);
  }

  .leaderboard-title {
    display: flex;

    align-items: center;

    gap: 7px;

    color: #ffffff;

    font-size: 10px;

    font-weight: 950;

    letter-spacing: 0.12em;
  }

  .live-indicator {
    width: 7px;
    height: 7px;

    border-radius: 50%;

    background: var(--live);

    box-shadow:
      0 0 8px
        rgba(228, 88, 88, 0.75);

    animation:
      mwopsLivePulse 1.5s
      ease-in-out infinite;
  }

  .leaderboard-headings {
    display: grid;

    grid-template-columns:
      66px
      42px
      46px;

    text-align: center;

    color:
      rgba(255, 255, 255, 0.3);

    font-size: 6px;

    font-weight: 900;

    letter-spacing: 0.08em;
  }

  .leaderboard-list {
    max-height: 688px;

    overflow: hidden;
  }

  /*
  |--------------------------------------------------------------------------
  | RANKING ROW
  |--------------------------------------------------------------------------
  */

  .ranking-team-row {
    min-height: 43px;

    display: grid;

    grid-template-columns:
      31px
      39px
      minmax(105px, 1fr)
      66px
      42px
      46px;

    align-items: center;

    padding: 0 7px;

    border-bottom:
      1px solid
      rgba(255, 255, 255, 0.05);

    background:
      rgba(255, 255, 255, 0.018);
  }

  .ranking-team-row:nth-child(even) {
    background:
      rgba(255, 255, 255, 0.035);
  }

  .ranking-selected {
    background:
      linear-gradient(
        90deg,
        rgba(217, 185, 79, 0.18),
        rgba(217, 185, 79, 0.025)
      ) !important;

    box-shadow:
      inset 3px 0 0
        var(--gold);
  }

  .ranking-dead {
    opacity: 0.43;
  }

  .rank {
    color:
      rgba(255, 255, 255, 0.76);

    font-size: 12px;

    font-weight: 950;

    text-align: center;

    font-variant-numeric:
      tabular-nums;
  }

  .ranking-team-row:first-child
    .rank {
    color: var(--gold-bright);
  }

  .rank-logo {
    display: flex;

    justify-content: center;
  }

  .rank-team {
    min-width: 0;

    padding-left: 4px;
  }

  .rank-tag {
    overflow: hidden;

    text-overflow: ellipsis;

    white-space: nowrap;

    color: #ffffff;

    font-size: 11px;

    font-weight: 950;

    text-transform: uppercase;
  }

  .rank-name {
    margin-top: 1px;

    overflow: hidden;

    text-overflow: ellipsis;

    white-space: nowrap;

    color:
      rgba(255, 255, 255, 0.3);

    font-size: 6px;

    font-weight: 750;

    text-transform: uppercase;
  }

  .rank-alive {
    display: flex;

    justify-content: center;
  }

  .alive-bars {
    display: flex;

    align-items: center;

    gap: 3px;

    width: 51px;
  }

  .alive-bar {
    width: 9px;
    height: 15px;

    transform:
      skewX(-17deg);

    background:
      repeating-linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.13)
          0 3px,
        transparent 3px 5px
      );

    border-radius: 1px;
  }

  .alive-bar-active {
    background:
      repeating-linear-gradient(
        90deg,
        rgba(86, 223, 181, 0.95)
          0 3px,
        rgba(86, 223, 181, 0.45)
          3px 5px
      );

    box-shadow:
      0 0 4px
        rgba(86, 223, 181, 0.25);
  }

  .rank-points,
  .rank-kills {
    color: #ffffff;

    font-size: 12px;

    font-weight: 950;

    text-align: center;

    font-variant-numeric:
      tabular-nums;
  }

  .rank-kills {
    color: var(--gold-bright);
  }

  .leaderboard-empty {
    height: 160px;

    display: flex;

    align-items: center;

    justify-content: center;

    color:
      rgba(255, 255, 255, 0.3);

    font-size: 8px;

    font-weight: 900;

    letter-spacing: 0.11em;
  }

  /*
  |--------------------------------------------------------------------------
  | LEADERBOARD FOOTER
  |--------------------------------------------------------------------------
  */

  .leaderboard-footer {
    height: 43px;

    display: grid;

    grid-template-columns:
      repeat(3, 1fr);

    border-top:
      1px solid var(--line);
  }

  .leaderboard-footer > div {
    display: flex;

    align-items: center;

    justify-content: center;

    gap: 7px;

    border-right:
      1px solid var(--line);
  }

  .leaderboard-footer > div:last-child {
    border-right: 0;
  }

  .leaderboard-footer span {
    color:
      rgba(255, 255, 255, 0.3);

    font-size: 6px;

    font-weight: 900;

    letter-spacing: 0.08em;
  }

  .leaderboard-footer strong {
    color: var(--gold-bright);

    font-size: 12px;

    font-weight: 950;
  }

  /*
  |--------------------------------------------------------------------------
  | PLAYER HUD
  |--------------------------------------------------------------------------
  */

  .player-hud {
    position: absolute;

    left: 24px;
    bottom: 24px;

    height: 74px;

    min-width: 690px;

    display: grid;

    grid-template-columns:
      190px
      175px
      92px
      92px
      92px
      74px;

    background:
      linear-gradient(
        90deg,
        rgba(4, 7, 9, 0.97),
        rgba(7, 10, 12, 0.93)
      );

    border-left:
      3px solid var(--gold);

    box-shadow:
      0 15px 40px
        rgba(0, 0, 0, 0.48);
  }

  .hud-team {
    display: flex;

    align-items: center;

    gap: 10px;

    padding: 0 12px;

    border-right:
      1px solid var(--line);
  }

  .hud-team-tag {
    color: var(--gold-bright);

    font-size: 12px;

    font-weight: 950;

    letter-spacing: 0.08em;
  }

  .hud-team-name {
    max-width: 120px;

    margin-top: 3px;

    overflow: hidden;

    text-overflow: ellipsis;

    white-space: nowrap;

    color:
      rgba(255, 255, 255, 0.38);

    font-size: 6px;

    font-weight: 800;

    text-transform: uppercase;
  }

  .hud-player {
    display: flex;

    flex-direction: column;

    justify-content: center;

    padding: 0 13px;

    border-right:
      1px solid var(--line);
  }

  .hud-player-name {
    max-width: 150px;

    overflow: hidden;

    text-overflow: ellipsis;

    white-space: nowrap;

    color: #ffffff;

    font-size: 12px;

    font-weight: 950;

    text-transform: uppercase;
  }

  .hud-status {
    display: flex;

    align-items: center;

    gap: 5px;

    margin-top: 5px;

    color:
      rgba(255, 255, 255, 0.36);

    font-size: 6px;

    font-weight: 900;

    letter-spacing: 0.1em;
  }

  .hud-status-dot {
    width: 5px;
    height: 5px;

    border-radius: 50%;
  }

  .hud-status-live {
    background: var(--alive);

    box-shadow:
      0 0 7px
        rgba(86, 223, 181, 0.65);
  }

  .hud-status-dead {
    background: var(--live);
  }

  .hud-stat,
  .hud-rank {
    display: flex;

    flex-direction: column;

    align-items: center;

    justify-content: center;

    border-right:
      1px solid var(--line);
  }

  .hud-stat span,
  .hud-rank span {
    color:
      rgba(255, 255, 255, 0.3);

    font-size: 6px;

    font-weight: 900;

    letter-spacing: 0.07em;
  }

  .hud-stat strong {
    margin-top: 5px;

    color: #ffffff;

    font-size: 15px;

    font-weight: 950;
  }

  .hud-rank {
    border-right: 0;
  }

  .hud-rank strong {
    margin-top: 4px;

    color: var(--gold-bright);

    font-size: 15px;

    font-weight: 950;
  }

  /*
  |--------------------------------------------------------------------------
  | TEAM LOGOS
  |--------------------------------------------------------------------------
  */

  .team-logo {
    width: 30px;
    height: 30px;

    flex: 0 0 auto;

    display: flex;

    align-items: center;

    justify-content: center;

    overflow: hidden;

    background:
      rgba(255, 255, 255, 0.045);
  }

  .team-logo-large {
    width: 40px;
    height: 40px;
  }

  .team-logo img {
    width: 100%;
    height: 100%;

    object-fit: contain;
  }

  .team-logo-fallback {
    color: var(--gold-bright);

    font-size: 7px;

    font-weight: 950;

    border:
      1px solid
      rgba(217, 185, 79, 0.25);

    background:
      linear-gradient(
        135deg,
        rgba(217, 185, 79, 0.2),
        rgba(217, 185, 79, 0.04)
      );
  }

  /*
  |--------------------------------------------------------------------------
  | CONNECTION
  |--------------------------------------------------------------------------
  */

  .connection {
    position: absolute;

    right: 24px;
    bottom: 22px;

    height: 22px;

    display: flex;

    align-items: center;

    gap: 6px;

    padding: 0 9px;

    background:
      rgba(3, 5, 7, 0.82);

    border:
      1px solid
      rgba(255, 255, 255, 0.07);

    color:
      rgba(255, 255, 255, 0.38);

    font-size: 6px;

    font-weight: 900;

    letter-spacing: 0.1em;
  }

  .connection-dot {
    width: 5px;
    height: 5px;

    border-radius: 50%;
  }

  .connection-online {
    background: var(--alive);

    box-shadow:
      0 0 7px
        rgba(86, 223, 181, 0.65);
  }

  .connection-loading {
    background: var(--gold-bright);

    animation:
      mwopsLivePulse 1s infinite;
  }

  .connection-error {
    background: var(--live);

    box-shadow:
      0 0 7px
        rgba(228, 88, 88, 0.65);
  }

  .connection-time {
    color:
      rgba(255, 255, 255, 0.2);
  }

  /*
  |--------------------------------------------------------------------------
  | LOADING
  |--------------------------------------------------------------------------
  */

  .overlay-loading {
    position: fixed;

    inset: 0;

    display: flex;

    flex-direction: column;

    align-items: center;

    justify-content: center;

    background:
      radial-gradient(
        circle at center,
        rgba(217, 185, 79, 0.045),
        transparent 42%
      );
  }

  .loading-ring {
    width: 32px;
    height: 32px;

    border:
      2px solid
      rgba(217, 185, 79, 0.15);

    border-top-color:
      var(--gold-bright);

    border-radius: 50%;

    animation:
      mwopsSpin 0.9s linear infinite;
  }

  .loading-brand {
    margin-top: 13px;

    color: var(--gold-bright);

    font-size: 16px;

    font-weight: 1000;

    letter-spacing: 0.14em;
  }

  .loading-text {
    margin-top: 5px;

    color:
      rgba(255, 255, 255, 0.32);

    font-size: 7px;

    font-weight: 800;

    letter-spacing: 0.12em;
  }

  /*
  |--------------------------------------------------------------------------
  | ERROR
  |--------------------------------------------------------------------------
  */

  .overlay-error {
    position: fixed;

    inset: 0;

    display: flex;

    align-items: center;

    justify-content: center;

    background: transparent;
  }

  .error-card {
    width: 350px;

    padding: 26px;

    text-align: center;

    background:
      rgba(4, 7, 9, 0.96);

    border:
      1px solid
      rgba(217, 185, 79, 0.32);

    box-shadow:
      0 20px 60px
      rgba(0, 0, 0, 0.55);
  }

  .error-brand {
    color: var(--gold-bright);

    font-size: 19px;

    font-weight: 1000;

    letter-spacing: 0.12em;
  }

  .error-title {
    margin-top: 16px;

    color: #ffffff;

    font-size: 12px;

    font-weight: 950;

    letter-spacing: 0.08em;
  }

  .error-copy {
    margin-top: 8px;

    color:
      rgba(255, 255, 255, 0.4);

    font-size: 8px;
  }

  /*
  |--------------------------------------------------------------------------
  | ANIMATIONS
  |--------------------------------------------------------------------------
  */

  @keyframes mwopsLivePulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }

    50% {
      opacity: 0.45;
      transform: scale(0.76);
    }
  }

  @keyframes mwopsSpin {
    to {
      transform: rotate(360deg);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | RESPONSIVE BROADCAST SCALING
  |--------------------------------------------------------------------------
  |
  | The layout is primarily designed for 1920x1080.
  |
  | OBS should therefore preferably use:
  |
  | Width: 1920
  | Height: 1080
  |
  |--------------------------------------------------------------------------
  */

  @media (max-width: 1500px) {
    .leaderboard {
      width: 370px;
    }

    .map-panel {
      right: 412px;
      width: 220px;
    }

    .player-hud {
      transform-origin:
        left bottom;
      transform:
        scale(0.9);
    }
  }

  @media (max-width: 1200px) {
    .leaderboard {
      width: 335px;
    }

    .map-panel {
      display: none;
    }

    .team-panel {
      width: 280px;
    }

    .player-hud {
      transform-origin:
        left bottom;
      transform:
        scale(0.82);
    }
  }

  @media (max-width: 900px) {
    .team-panel {
      width: 250px;
    }

    .leaderboard {
      width: 315px;
    }

    .mwops-brand {
      max-width: 210px;
    }

    .event-name {
      display: none;
    }

    .player-hud {
      transform-origin:
        left bottom;
      transform:
        scale(0.72);
    }
  }
`;