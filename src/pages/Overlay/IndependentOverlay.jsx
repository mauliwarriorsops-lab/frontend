/*
|--------------------------------------------------------------------------
| MWOPS INDEPENDENT BROADCAST OVERLAYS
|--------------------------------------------------------------------------
|
| Supported:
|
| /overlay/live-ranking
| /overlay/elimination
| /overlay/showcase
| /overlay/winner
| /overlay/results
| /overlay/standings
|
| Current routing:
|
| /?overlay=live-ranking&matchId=UUID
| /?overlay=elimination&matchId=UUID
| /?overlay=showcase&matchId=UUID
| /?overlay=winner&matchId=UUID
| /?overlay=results&matchId=UUID
| /?overlay=standings&matchId=UUID
|
| Query:
|
| ?matchId=UUID
| &theme=MWOPS+DARK
|
|--------------------------------------------------------------------------
*/

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSearchParams } from "react-router-dom";

/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

const REFRESH_INTERVAL = 750;
const REQUEST_TIMEOUT = 5000;

/*
|--------------------------------------------------------------------------
| BROADCAST THEMES
|--------------------------------------------------------------------------
|
| All independent overlays use the same renderer. The selected theme is
| read directly from ?theme=... in the OBS Browser Source URL, so no
| separate component/file is required for each theme.
|
|--------------------------------------------------------------------------
*/

const OVERLAY_THEMES = {
  "MWOPS DARK": "dark",
  "MWOPS GOLD": "gold",
  "MWOPS GREEN": "green",
  "MWOPS MINIMAL": "minimal",
};

function normalizeOverlayTheme(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\\+/g, " ")
    .replace(/\\s+/g, " ")
    .toUpperCase();

  return OVERLAY_THEMES[normalized]
    ? normalized
    : "MWOPS DARK";
}

const OverlayThemeContext = React.createContext("MWOPS DARK");

function useOverlayTheme() {
  return useContext(OverlayThemeContext);
}


/*
|--------------------------------------------------------------------------
| API BASE URL
|--------------------------------------------------------------------------
|
| Support all MWOPS environment variable names.
|
| Production:
|
| VITE_API_BASE_URL
| VITE_API_URL
| VITE_BACKEND_URL
|
| Development fallback:
|
| http://localhost:5000/api
|
|--------------------------------------------------------------------------
*/

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function number(value, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function teamId(team) {
  return (
    team?.team_id ||
    team?.id ||
    team?.team?.id ||
    null
  );
}

function teamName(
  team,
  fallback = "UNKNOWN TEAM"
) {
  return (
    team?.team_name ||
    team?.name ||
    team?.team?.team_name ||
    team?.team?.name ||
    fallback
  );
}

function teamTag(
  team,
  fallback = "TEAM"
) {
  return (
    team?.team_tag ||
    team?.tag ||
    team?.short_name ||
    team?.team?.team_tag ||
    team?.team?.tag ||
    team?.team?.short_name ||
    fallback
  );
}

function teamLogo(team) {
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

function playerId(player) {
  return (
    player?.player_id ||
    player?.id ||
    player?.player?.id ||
    null
  );
}

function playerName(
  player,
  fallback = "PLAYER"
) {
  return (
    player?.player_name ||
    player?.gamer_tag ||
    player?.name ||
    player?.username ||
    player?.ign ||
    player?.player?.player_name ||
    player?.player?.gamer_tag ||
    player?.player?.name ||
    player?.player?.username ||
    fallback
  );
}

function playerKills(player) {
  return number(
    player?.kills ??
      player?.eliminations ??
      player?.elims ??
      player?.player_stats?.kills ??
      player?.stats?.kills
  );
}

function playerDamage(player) {
  return number(
    player?.damage ??
      player?.damage_dealt ??
      player?.total_damage ??
      player?.player_stats?.damage ??
      player?.stats?.damage
  );
}

function playerAssists(player) {
  return number(
    player?.assists ??
      player?.player_stats?.assists ??
      player?.stats?.assists
  );
}

function alivePlayer(player) {
  if (!player) {
    return false;
  }

  if (
    player?.is_alive === true ||
    player?.alive === true ||
    String(
      player?.status
    ).toLowerCase() ===
      "alive"
  ) {
    return true;
  }

  if (
    player?.is_alive === false ||
    player?.alive === false ||
    [
      "dead",
      "eliminated",
    ].includes(
      String(
        player?.status
      ).toLowerCase()
    )
  ) {
    return false;
  }

  return true;
}

function teamKills(team) {
  return number(
    team?.kills ??
      team?.eliminations ??
      team?.elims ??
      0
  );
}

function teamPoints(team) {
  return number(
    team?.total_points ??
      team?.points ??
      team?.score ??
      team?.totalPoints ??
      0
  );
}

function teamPlacement(team) {
  const placement = number(
    team?.placement ??
      team?.position ??
      team?.rank ??
      999
  );

  return placement > 0
    ? placement
    : 999;
}

function teamPlayers(team) {
  /*
  |--------------------------------------------------------------------------
  | DIRECT PLAYERS
  |--------------------------------------------------------------------------
  */

  if (
    Array.isArray(
      team?.players
    )
  ) {
    return team.players;
  }

  /*
  |--------------------------------------------------------------------------
  | ROSTER ALIAS
  |--------------------------------------------------------------------------
  */

  if (
    Array.isArray(
      team?.roster
    )
  ) {
    return team.roster;
  }

  /*
  |--------------------------------------------------------------------------
  | TEAM PLAYERS ALIAS
  |--------------------------------------------------------------------------
  */

  if (
    Array.isArray(
      team?.team_players
    )
  ) {
    return team.team_players;
  }

  /*
  |--------------------------------------------------------------------------
  | MATCH-SPECIFIC ROSTER
  |--------------------------------------------------------------------------
  |
  | MWOPS stores the actual lineup for a match in:
  |
  | match_teams
  |    -> match_team_players
  |         -> players
  |
  |--------------------------------------------------------------------------
  */

  if (
    Array.isArray(
      team?.match_team_players
    )
  ) {
    return team.match_team_players
      .map(
        (assignment) => {
          const player =
            assignment?.players ||
            assignment?.player ||
            {};

          return {
            ...player,

            id:
              player?.id ||
              assignment?.player_id ||
              null,

            player_id:
              assignment?.player_id ||
              player?.id ||
              null,

            is_alive:
              assignment?.is_alive !==
              undefined
                ? assignment.is_alive
                : player?.is_alive,

            alive:
              assignment?.is_alive !==
              undefined
                ? assignment.is_alive
                : player?.alive,
          };
        }
      );
  }

  return [];
}

function teamEliminated(team) {
  return (
    team?.is_eliminated === true ||
    team?.eliminated === true ||
    [
      "dead",
      "eliminated",
    ].includes(
      String(
        team?.status
      ).toLowerCase()
    )
  );
}

function teamAliveCount(team) {
  const players =
    teamPlayers(team);

  if (
    team?.alive_players !==
    undefined
  ) {
    return number(
      team.alive_players
    );
  }

  if (
    team?.alivePlayers !==
    undefined
  ) {
    return number(
      team.alivePlayers
    );
  }

  return players.filter(
    alivePlayer
  ).length;
}

function ordinal(position) {
  if (
    !Number.isFinite(
      position
    ) ||
    position <= 0 ||
    position === 999
  ) {
    return "--";
  }

  const mod100 =
    position % 100;

  if (
    mod100 >= 11 &&
    mod100 <= 13
  ) {
    return `${position}TH`;
  }

  switch (
    position % 10
  ) {
    case 1:
      return `${position}ST`;

    case 2:
      return `${position}ND`;

    case 3:
      return `${position}RD`;

    default:
      return `${position}TH`;
  }
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }
  );
}

/*
|--------------------------------------------------------------------------
| LOGO
|--------------------------------------------------------------------------
*/

function Logo({
  team,
  size = 42,
}) {
  const [failed, setFailed] =
    useState(false);

  const logo =
    teamLogo(team);

  const tag =
    teamTag(team);

  if (!logo || failed) {
    return (
      <div
        className="ind-team-logo fallback"
        style={{
          width: size,
          height: size,
        }}
      >
        {tag
          .slice(0, 3)
          .toUpperCase()}
      </div>
    );
  }

  return (
    <div
      className="ind-team-logo"
      style={{
        width: size,
        height: size,
      }}
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
| LIVE BARS
|--------------------------------------------------------------------------
*/

function AliveBars({
  count = 0,
}) {
  const aliveCount = Math.max(
    0,
    Math.min(4, number(count))
  );

  return (
    <div
      className="ind-alive-bars"
      aria-label={`${aliveCount} players alive`}
    >
      {[0, 1, 2, 3].map(
        (index) => (
          <span
            key={index}
            className={
              index < aliveCount
                ? "active"
                : ""
            }
          />
        )
      )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| DATA HOOK
|--------------------------------------------------------------------------
*/

function useControlRoomData(
  matchId
) {
  const [state, setState] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [updatedAt, setUpdatedAt] =
    useState(null);

  const requestInFlightRef =
    React.useRef(false);

  const mountedRef =
    React.useRef(true);

  const load = useCallback(
    async (initial = false) => {
      if (!matchId) {
        if (
          mountedRef.current
        ) {
          setError(
            "Missing matchId"
          );

          setLoading(false);
        }

        return;
      }

      /*
      |--------------------------------------------------------------------------
      | PREVENT OVERLAPPING REQUESTS
      |--------------------------------------------------------------------------
      */

      if (
        requestInFlightRef.current
      ) {
        return;
      }

      requestInFlightRef.current =
        true;

      if (
        initial &&
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
        /*
        |--------------------------------------------------------------------------
        | CORRECT MWOPS CONTROL ROOM ENDPOINT
        |--------------------------------------------------------------------------
        |
        | OLD:
        |
        | /control-room/:matchId
        |
        | CORRECT:
        |
        | /control-room/matches/:matchId
        |
        |--------------------------------------------------------------------------
        */

        const endpoint =
          `${API_BASE_URL}/control-room/matches/${encodeURIComponent(
            matchId
          )}?_mwops_ts=${Date.now()}`;

        if (
          import.meta.env.DEV
        ) {
          console.debug(
            "[MWOPS Independent Overlay] Requesting:",
            endpoint
          );
        }

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

              cache:
                "no-store",

              signal:
                controller.signal,
            }
          );

        if (!response.ok) {
          throw new Error(
            `Control Room API error: ${response.status}`
          );
        }

        const payload =
          await response.json();

        /*
        |--------------------------------------------------------------------------
        | DEBUG API RESPONSE
        |--------------------------------------------------------------------------
        */

        if (
          import.meta.env.DEV
        ) {
          console.debug(
            "[MWOPS Independent Overlay] API response:",
            {
              success:
                payload?.success,

              message:
                payload?.message,

              hasData:
                Boolean(
                  payload?.data
                ),

              matchTeams:
                Array.isArray(
                  payload?.data
                    ?.match_teams
                )
                  ? payload.data
                      .match_teams
                      .length
                  : 0,

              broadcastTeams:
                Array.isArray(
                  payload?.data
                    ?.broadcast_teams
                )
                  ? payload.data
                      .broadcast_teams
                      .length
                  : 0,

              teams:
                Array.isArray(
                  payload?.data
                    ?.teams
                )
                  ? payload.data
                      .teams
                      .length
                  : 0,

              players:
                Array.isArray(
                  payload?.data
                    ?.players
                )
                  ? payload.data
                      .players.length
                  : 0,
            }
          );
        }

        if (
          !payload?.success
        ) {
          throw new Error(
            payload?.message ||
              "Control Room data unavailable"
          );
        }

        /*
        |--------------------------------------------------------------------------
        | KEEP LAST GOOD STATE
        |--------------------------------------------------------------------------
        */

        if (
          mountedRef.current
        ) {
          const nextState =
            payload.data ||
            null;

          setState(
            nextState
          );

          setError("");

          setUpdatedAt(
            new Date()
          );
        }
      } catch (err) {
        if (
          err?.name !==
          "AbortError"
        ) {
          console.error(
            "[MWOPS Independent Overlay] Control Room request failed:",
            err
          );

          if (
            mountedRef.current
          ) {
            setError(
              err?.message ||
                "Control Room offline"
            );
          }
        }
      } finally {
        window.clearTimeout(
          timeoutId
        );

        requestInFlightRef.current =
          false;

        if (
          initial &&
          mountedRef.current
        ) {
          setLoading(false);
        }
      }
    },
    [matchId]
  );

  useEffect(() => {
    mountedRef.current =
      true;

    /*
    |--------------------------------------------------------------------------
    | INITIAL LOAD
    |--------------------------------------------------------------------------
    */

    load(true);

    /*
    |--------------------------------------------------------------------------
    | FAST POLLING
    |--------------------------------------------------------------------------
    */

    const interval =
      window.setInterval(
        () => {
          if (
            !document.hidden
          ) {
            load(false);
          }
        },
        REFRESH_INTERVAL
      );

    /*
    |--------------------------------------------------------------------------
    | VISIBILITY
    |--------------------------------------------------------------------------
    */

    const handleVisibility =
      () => {
        if (
          !document.hidden
        ) {
          load(false);
        }
      };

    /*
    |--------------------------------------------------------------------------
    | FOCUS
    |--------------------------------------------------------------------------
    */

    const handleFocus =
      () => {
        load(false);
      };

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    window.addEventListener(
      "focus",
      handleFocus
    );

    return () => {
      mountedRef.current =
        false;

      window.clearInterval(
        interval
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );

      window.removeEventListener(
        "focus",
        handleFocus
      );
    };
  }, [load]);

  return {
    state,
    loading,
    error,
    updatedAt,
  };
}

/*
|--------------------------------------------------------------------------
| NORMALIZED DATA
|--------------------------------------------------------------------------
*/

function useNormalizedData(
  state
) {
  return useMemo(() => {
    if (!state) {
      return {
        match: {},
        teams: [],
        players: [],
        controlRoom: {},
      };
    }

    /*
    |--------------------------------------------------------------------------
    | AUTHORITATIVE MATCH ROSTER
    |--------------------------------------------------------------------------
    */

    const matchTeams =
      Array.isArray(
        state.match_teams
      )
        ? state.match_teams
        : [];

    const results =
      Array.isArray(
        state.results
      )
        ? state.results
        : [];

    const teamStats =
      Array.isArray(
        state.team_stats
      )
        ? state.team_stats
        : Array.isArray(
            state.teamStats
          )
          ? state.teamStats
          : [];

    const genericTeams =
      Array.isArray(
        state.teams
      )
        ? state.teams
        : [];

    const broadcastTeams =
      Array.isArray(
        state.broadcast_teams
      )
        ? state.broadcast_teams
        : Array.isArray(
            state.broadcastTeams
          )
          ? state.broadcastTeams
          : [];

    /*
    |--------------------------------------------------------------------------
    | BUILD RESULT LOOKUP
    |--------------------------------------------------------------------------
    */

    const resultByTeamId =
      new Map();

    [
      ...results,
      ...teamStats,
      ...broadcastTeams,
    ].forEach(
      (item) => {
        const id =
          teamId(item);

        if (
          id !== null &&
          id !== undefined
        ) {
          resultByTeamId.set(
            String(id),
            item
          );
        }
      }
    );

    /*
    |--------------------------------------------------------------------------
    | BUILD TEAM LOOKUP
    |--------------------------------------------------------------------------
    */

    const genericTeamById =
      new Map();

    genericTeams.forEach(
      (item) => {
        const id =
          teamId(item);

        if (
          id !== null &&
          id !== undefined
        ) {
          genericTeamById.set(
            String(id),
            item
          );
        }
      }
    );

    /*
    |--------------------------------------------------------------------------
    | BUILD SOURCE
    |--------------------------------------------------------------------------
    |
    | Priority:
    |
    | 1. match_teams
    | 2. broadcast_teams
    | 3. results
    | 4. team_stats
    | 5. teams
    |
    |--------------------------------------------------------------------------
    */

    let source = [];

    if (
      matchTeams.length
    ) {
      source =
        matchTeams.map(
          (
            matchTeam,
            index
          ) => {
            const id =
              teamId(
                matchTeam
              );

            const key =
              id !== null &&
              id !== undefined
                ? String(id)
                : null;

            const result =
              key
                ? resultByTeamId.get(
                    key
                  ) || {}
                : {};

            const genericTeam =
              key
                ? genericTeamById.get(
                    key
                  ) || {}
                : {};

            return {
              ...genericTeam,

              ...matchTeam,

              ...result,

              team:
                matchTeam?.teams ||
                matchTeam?.team ||
                genericTeam?.team ||
                result?.team ||
                null,

              match_team_players:
                matchTeam?.match_team_players ||
                matchTeam?.team_players ||
                result?.match_team_players ||
                [],

              __sourceIndex:
                index,
            };
          }
        );
    } else if (
      broadcastTeams.length
    ) {
      source =
        broadcastTeams;
    } else if (
      results.length
    ) {
      source =
        results;
    } else if (
      teamStats.length
    ) {
      source =
        teamStats;
    } else {
      source =
        genericTeams;
    }

    /*
    |--------------------------------------------------------------------------
    | NORMALIZE TEAMS
    |--------------------------------------------------------------------------
    */

    const teams =
      source
        .map(
          (
            team,
            index
          ) => {
            const players =
              teamPlayers(
                team
              );

            return {
              ...team,

              __index:
                team.__sourceIndex ??
                index,

              __id:
                teamId(team),

              __name:
                teamName(
                  team,
                  `TEAM ${index + 1}`
                ),

              __tag:
                teamTag(
                  team,
                  `T${index + 1}`
                ),

              __logo:
                teamLogo(
                  team
                ),

              __kills:
                teamKills(
                  team
                ),

              __points:
                teamPoints(
                  team
                ),

              __placement:
                teamPlacement(
                  team
                ),

              __players:
                players,

              __alive:
                teamAliveCount({
                  ...team,
                  players,
                }),

              __eliminated:
                teamEliminated(
                  team
                ),
            };
          }
        )
        .sort(
          (
            a,
            b
          ) => {
            /*
            |--------------------------------------------------------------------------
            | PLACEMENT
            |--------------------------------------------------------------------------
            */

            if (
              a.__placement !==
                999 &&
              b.__placement !==
                999
            ) {
              if (
                a.__placement !==
                b.__placement
              ) {
                return (
                  a.__placement -
                  b.__placement
                );
              }
            }

            /*
            |--------------------------------------------------------------------------
            | POINTS
            |--------------------------------------------------------------------------
            */

            if (
              b.__points !==
              a.__points
            ) {
              return (
                b.__points -
                a.__points
              );
            }

            /*
            |--------------------------------------------------------------------------
            | KILLS
            |--------------------------------------------------------------------------
            */

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

    /*
    |--------------------------------------------------------------------------
    | PLAYER LIST
    |--------------------------------------------------------------------------
    */

    let players =
      Array.isArray(
        state.players
      )
        ? state.players
        : [];

    /*
    |--------------------------------------------------------------------------
    | FALLBACK PLAYER RECONSTRUCTION
    |--------------------------------------------------------------------------
    */

    if (
      !players.length
    ) {
      players =
        teams.flatMap(
          (team) =>
            team.__players.map(
              (player) => ({
                ...player,

                team_id:
                  player?.team_id ||
                  team.__id,

                team_name:
                  player?.team_name ||
                  team.__name,

                team_tag:
                  player?.team_tag ||
                  team.__tag,

                __team:
                  team,
              })
            )
        );
    }

    /*
    |--------------------------------------------------------------------------
    | ATTACH TEAM TO PLAYERS
    |--------------------------------------------------------------------------
    */

    const playersWithTeams =
      players.map(
        (player) => {
          if (
            player?.__team
          ) {
            return player;
          }

          const playerTeamId =
            player?.team_id ||
            player?.teamId ||
            player?.team?.id ||
            null;

          const owningTeam =
            teams.find(
              (team) =>
                playerTeamId &&
                team.__id &&
                String(
                  team.__id
                ) ===
                  String(
                    playerTeamId
                  )
            );

          return {
            ...player,

            __team:
              owningTeam ||
              null,
          };
        }
      );

    /*
    |--------------------------------------------------------------------------
    | DEBUG
    |--------------------------------------------------------------------------
    */

    if (
      import.meta.env.DEV
    ) {
      console.debug(
        "[MWOPS Overlay] Normalized broadcast state:",
        {
          matchId:
            state?.match?.id,

          matchTeams:
            matchTeams.length,

          broadcastTeams:
            broadcastTeams.length,

          results:
            results.length,

          teamStats:
            teamStats.length,

          genericTeams:
            genericTeams.length,

          normalizedTeams:
            teams.length,

          normalizedPlayers:
            playersWithTeams.length,

          teamNames:
            teams.map(
              (team) => ({
                id:
                  team.__id,

                name:
                  team.__name,

                tag:
                  team.__tag,

                kills:
                  team.__kills,

                points:
                  team.__points,

                alive:
                  team.__alive,

                players:
                  team.__players.length,
              })
            ),
        }
      );
    }

    return {
      match:
        state.match ||
        {},

      teams,

      players:
        playersWithTeams,

      controlRoom:
        state.control_room ||
        {},
    };
  }, [state]);
}

/*
|--------------------------------------------------------------------------
| COMMON FRAME
|--------------------------------------------------------------------------
*/

function OverlayFrame({
  children,
  title,
  eyebrow = "MWOPS ESPORTS",
  updatedAt,
  error,
}) {
  const theme = useOverlayTheme();
  const themeKey = OVERLAY_THEMES[theme] || "dark";

  return (
    <div
      className={`independent-overlay theme-${themeKey}`}
      data-theme={theme}
    >
      <div className="ind-corner ind-corner-tl" />
      <div className="ind-corner ind-corner-tr" />
      <div className="ind-corner ind-corner-bl" />
      <div className="ind-corner ind-corner-br" />

      <header className="ind-overlay-header">
        <div>
          <div className="ind-eyebrow">
            {eyebrow}
          </div>

          <div className="ind-title">
            {title}
          </div>
        </div>

        <div className="ind-brand">
          <strong>
            MWOPS
          </strong>

          <span>
            LIVE BROADCAST
          </span>
        </div>
      </header>

      {children}

      <div
        className={
          error
            ? "ind-connection error"
            : "ind-connection"
        }
      >
        <span />

        {error
          ? "CONTROL ROOM OFFLINE"
          : "LIVE DATA"}

        {updatedAt && (
          <small>
            SYNCED{" "}
            {formatDate(
              updatedAt
            )}
          </small>
        )}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| LIVE RANKING
|--------------------------------------------------------------------------
*/

function LiveRanking({
  teams,
  error,
  updatedAt,
}) {
  return (
    <OverlayFrame
      eyebrow="MATCH BROADCAST"
      title="LIVE RANKING"
      error={error}
      updatedAt={updatedAt}
    >
      <div className="ranking-card">

        <div className="ranking-columns">
          <span>
            POS
          </span>

          <span>
            TEAM
          </span>

          <span>
            ALIVE
          </span>

          <span>
            POINTS
          </span>

          <span>
            ELIMS
          </span>
        </div>

        <div className="ranking-list">

          {teams.length ? (
            teams
              .slice(0, 20)
              .map(
                (
                  team,
                  index
                ) => (
                  <div
                    className={
                      `ranking-row ${
                        index === 0
                          ? "first"
                          : ""
                      } ${
                        team.__eliminated
                          ? "eliminated"
                          : ""
                      }`
                    }
                    key={
                      team.__id ||
                      `${team.__tag}-${index}`
                    }
                  >

                    <div className="ranking-position">
                      {team.__rank}
                    </div>

                    <div className="ranking-team">

                      <Logo
                        team={team}
                        size={42}
                      />

                      <div>
                        <strong>
                          {team.__tag}
                        </strong>

                        <small>
                          {team.__name}
                        </small>
                      </div>

                    </div>

                    <div className="ranking-alive">
                      <AliveBars
                        count={
                          team.__alive
                        }
                      />
                    </div>

                    <div className="ranking-points">
                      {team.__points}
                    </div>

                    <div className="ranking-kills">
                      {team.__kills}
                    </div>

                  </div>
                )
              )
          ) : (
            <EmptyState />
          )}

        </div>

      </div>
    </OverlayFrame>
  );
}

/*
|--------------------------------------------------------------------------
| ELIMINATION
|--------------------------------------------------------------------------
*/

function Elimination({
  teams,
  error,
  updatedAt,
}) {
  const eliminatedTeams =
    teams.filter(
      (team) =>
        team.__eliminated ||
        team.__alive === 0
    );

  const team =
    eliminatedTeams[0] ||
    teams.find(
      (item) =>
        item.__alive === 0
    );

  return (
    <OverlayFrame
      eyebrow="MATCH EVENT"
      title="ELIMINATION ALERT"
      error={error}
      updatedAt={updatedAt}
    >
      <div className="elimination-wrap">

        <div className="elimination-alert">
          <span>
            TEAM ELIMINATED
          </span>
        </div>

        {team ? (
          <div className="elimination-card">

            <div className="elim-logo">
              <Logo
                team={team}
                size={104}
              />
            </div>

            <div className="elim-team">

              <small>
                ELIMINATED
              </small>

              <strong>
                {team.__tag}
              </strong>

              <span>
                {team.__name}
              </span>

            </div>

            <div className="elim-stats">

              <div>
                <small>
                  PLACEMENT
                </small>

                <strong>
                  {ordinal(
                    team.__rank
                  )}
                </strong>
              </div>

              <div>
                <small>
                  ELIMS
                </small>

                <strong>
                  {team.__kills}
                </strong>
              </div>

              <div>
                <small>
                  POINTS
                </small>

                <strong>
                  {team.__points}
                </strong>
              </div>

            </div>

          </div>
        ) : (
          <div className="no-event">
            WAITING FOR ELIMINATION EVENT
          </div>
        )}

      </div>
    </OverlayFrame>
  );
}

/*
|--------------------------------------------------------------------------
| PLAYING SQUADS
|--------------------------------------------------------------------------
*/

function Showcase({
  teams,
  error,
  updatedAt,
}) {
  const activeTeams =
    teams.filter(
      (team) =>
        !team.__eliminated &&
        team.__alive > 0
    );

  return (
    <OverlayFrame
      eyebrow="MATCH BROADCAST"
      title="PLAYING SQUADS"
      error={error}
      updatedAt={updatedAt}
    >
      <div className="showcase-grid">

        {activeTeams.length ? (
          activeTeams
            .slice(0, 8)
            .map(
              (
                team,
                index
              ) => (
                <div
                  className="squad-card"
                  key={
                    team.__id ||
                    `${team.__tag}-${index}`
                  }
                >

                  <div className="squad-header">

                    <div className="squad-position">
                      #
                      {team.__rank}
                    </div>

                    <Logo
                      team={team}
                      size={52}
                    />

                    <div className="squad-team">
                      <strong>
                        {team.__tag}
                      </strong>

                      <small>
                        {team.__name}
                      </small>
                    </div>

                    <div className="squad-points">
                      <strong>
                        {team.__points}
                      </strong>

                      <small>
                        POINTS
                      </small>
                    </div>

                  </div>

                  <div className="squad-players">

                    {team.__players
                      .slice(0, 4)
                      .map(
                        (
                          player,
                          playerIndex
                        ) => (
                          <div
                            className={
                              alivePlayer(
                                player
                              )
                                ? "squad-player"
                                : "squad-player dead"
                            }
                            key={
                              playerId(
                                player
                              ) ||
                              `${playerIndex}-${playerName(
                                player
                              )}`
                            }
                          >

                            <span className="squad-player-number">
                              {String(
                                playerIndex +
                                  1
                              ).padStart(
                                2,
                                "0"
                              )}
                            </span>

                            <span className="squad-player-name">
                              {playerName(
                                player,
                                `PLAYER ${
                                  playerIndex +
                                  1
                                }`
                              )}
                            </span>

                            <span className="squad-player-kills">
                              {playerKills(
                                player
                              )}
                            </span>

                          </div>
                        )
                      )}

                  </div>

                  <div className="squad-footer">
                    <span>
                      {team.__alive}
                      {" "}
                      ALIVE
                    </span>

                    <span>
                      {team.__kills}
                      {" "}
                      ELIMS
                    </span>
                  </div>

                </div>
              )
            )
        ) : (
          <EmptyState />
        )}

      </div>
    </OverlayFrame>
  );
}

/*
|--------------------------------------------------------------------------
| MATCH WINNER
|--------------------------------------------------------------------------
*/

function Winner({
  teams,
  match,
  error,
  updatedAt,
}) {
  const winner =
    teams[0] || null;

  return (
    <OverlayFrame
      eyebrow="MATCH COMPLETE"
      title="MATCH WINNER"
      error={error}
      updatedAt={updatedAt}
    >
      <div className="winner-wrap">

        <div className="winner-event">
          <span>
            CHAMPION
          </span>
        </div>

        {winner ? (
          <>
            <div className="winner-rank">
              01
            </div>

            <div className="winner-logo">
              <Logo
                team={winner}
                size={150}
              />
            </div>

            <div className="winner-team">
              <small>
                MATCH WINNER
              </small>

              <strong>
                {winner.__tag}
              </strong>

              <span>
                {winner.__name}
              </span>
            </div>

            <div className="winner-stats">

              <div>
                <small>
                  PLACEMENT
                </small>

                <strong>
                  #1
                </strong>
              </div>

              <div>
                <small>
                  ELIMINATIONS
                </small>

                <strong>
                  {winner.__kills}
                </strong>
              </div>

              <div>
                <small>
                  TOTAL POINTS
                </small>

                <strong>
                  {winner.__points}
                </strong>
              </div>

            </div>

            <div className="winner-match">
              {match?.name ||
                match?.match_name ||
                "MWOPS MATCH"}
            </div>
          </>
        ) : (
          <div className="no-event">
            WINNER DATA UNAVAILABLE
          </div>
        )}

      </div>
    </OverlayFrame>
  );
}

/*
|--------------------------------------------------------------------------
| MATCH RESULTS
|--------------------------------------------------------------------------
*/

function Results({
  teams,
  match,
  error,
  updatedAt,
}) {
  return (
    <OverlayFrame
      eyebrow="MATCH COMPLETE"
      title="MATCH RESULTS"
      error={error}
      updatedAt={updatedAt}
    >
      <div className="results-card">

        <div className="results-event">
          {match?.name ||
            match?.match_name ||
            "MATCH RESULTS"}
        </div>

        <div className="results-header">
          <span>
            POS
          </span>

          <span>
            TEAM
          </span>

          <span>
            ELIMS
          </span>

          <span>
            POINTS
          </span>
        </div>

        <div className="results-list">

          {teams.length ? (
            teams
              .slice(0, 20)
              .map(
                (
                  team,
                  index
                ) => (
                  <div
                    className={
                      `result-row ${
                        index === 0
                          ? "winner-row"
                          : ""
                      }`
                    }
                    key={
                      team.__id ||
                      `${team.__tag}-${index}`
                    }
                  >

                    <div className="result-rank">
                      {String(
                        team.__rank
                      ).padStart(
                        2,
                        "0"
                      )}
                    </div>

                    <div className="result-team">

                      <Logo
                        team={team}
                        size={38}
                      />

                      <div>
                        <strong>
                          {team.__tag}
                        </strong>

                        <small>
                          {team.__name}
                        </small>
                      </div>

                    </div>

                    <div className="result-kills">
                      {team.__kills}
                    </div>

                    <div className="result-points">
                      {team.__points}
                    </div>

                  </div>
                )
              )
          ) : (
            <EmptyState />
          )}

        </div>

      </div>
    </OverlayFrame>
  );
}

/*
|--------------------------------------------------------------------------
| OVERALL STANDINGS
|--------------------------------------------------------------------------
*/

function Standings({
  teams,
  error,
  updatedAt,
}) {
  return (
    <OverlayFrame
      eyebrow="TOURNAMENT BROADCAST"
      title="OVERALL STANDINGS"
      error={error}
      updatedAt={updatedAt}
    >
      <div className="standings-card">

        <div className="standings-header">
          <span>
            RANK
          </span>

          <span>
            TEAM
          </span>

          <span>
            ELIMS
          </span>

          <span>
            MATCH PTS
          </span>

          <span>
            TOTAL
          </span>
        </div>

        <div className="standings-list">

          {teams.length ? (
            teams
              .slice(0, 20)
              .map(
                (
                  team,
                  index
                ) => {
                  const tournamentPoints =
                    number(
                      team?.tournament_points ??
                        team?.overall_points ??
                        team?.standing_points ??
                        team?.points ??
                        0
                    );

                  const total =
                    number(
                      team?.total_points ??
                        team.__points
                    );

                  return (
                    <div
                      className="standing-row"
                      key={
                        team.__id ||
                        `${team.__tag}-${index}`
                      }
                    >

                      <div
                        className={
                          index < 3
                            ? "standing-rank top"
                            : "standing-rank"
                        }
                      >
                        {String(
                          index + 1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </div>

                      <div className="standing-team">

                        <Logo
                          team={team}
                          size={40}
                        />

                        <div>
                          <strong>
                            {team.__tag}
                          </strong>

                          <small>
                            {team.__name}
                          </small>
                        </div>

                      </div>

                      <div className="standing-elims">
                        {team.__kills}
                      </div>

                      <div className="standing-match-points">
                        {tournamentPoints}
                      </div>

                      <div className="standing-total">
                        {total}
                      </div>

                    </div>
                  );
                }
              )
          ) : (
            <EmptyState />
          )}

        </div>

      </div>
    </OverlayFrame>
  );
}

/*
|--------------------------------------------------------------------------
| EMPTY
|--------------------------------------------------------------------------
*/

function EmptyState() {
  return (
    <div className="ind-empty">
      <div>
        MWOPS
      </div>

      <span>
        WAITING FOR LIVE MATCH DATA
      </span>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| MAIN COMPONENT
|--------------------------------------------------------------------------
*/

export default function IndependentOverlay({
  type = "live-ranking",
}) {
  const [
    searchParams,
  ] = useSearchParams();

  const matchId =
    searchParams.get(
      "matchId"
    );

  const theme = normalizeOverlayTheme(
    searchParams.get("theme")
  );

  const themeKey =
    OVERLAY_THEMES[theme] || "dark";

  const {
    state,
    loading,
    error,
    updatedAt,
  } =
    useControlRoomData(
      matchId
    );

  const {
    match,
    teams,
  } =
    useNormalizedData(
      state
    );

  /*
  |--------------------------------------------------------------------------
  | MISSING MATCH ID
  |--------------------------------------------------------------------------
  */

  if (!matchId) {
    return (
      <OverlayThemeContext.Provider value={theme}>
        <div className={`independent-overlay theme-${themeKey}`} data-theme={theme}>
          <style>
            {STYLES}
          </style>

          <div className="missing-match">
          <strong>
            MWOPS
          </strong>

          <span>
            MATCH ID REQUIRED
          </span>
          </div>
        </div>
      </OverlayThemeContext.Provider>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | LOADING
  |--------------------------------------------------------------------------
  */

  if (
    loading &&
    !state
  ) {
    return (
      <OverlayThemeContext.Provider value={theme}>
        <div className={`independent-overlay theme-${themeKey}`} data-theme={theme}>
          <style>
            {STYLES}
          </style>

          <div className="ind-loading">

          <div className="ind-spinner" />

          <strong>
            MWOPS
          </strong>

          <span>
            CONNECTING TO CONTROL ROOM
          </span>

          </div>
        </div>
      </OverlayThemeContext.Provider>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | OVERLAY SELECTION
  |--------------------------------------------------------------------------
  */

  let content = null;

  switch (
    String(type)
      .toLowerCase()
  ) {
    case "live-ranking":
      content = (
        <LiveRanking
          teams={teams}
          error={error}
          updatedAt={updatedAt}
        />
      );
      break;

    case "elimination":
      content = (
        <Elimination
          teams={teams}
          error={error}
          updatedAt={updatedAt}
        />
      );
      break;

    case "showcase":
      content = (
        <Showcase
          teams={teams}
          error={error}
          updatedAt={updatedAt}
        />
      );
      break;

    case "winner":
      content = (
        <Winner
          teams={teams}
          match={match}
          error={error}
          updatedAt={updatedAt}
        />
      );
      break;

    case "results":
      content = (
        <Results
          teams={teams}
          match={match}
          error={error}
          updatedAt={updatedAt}
        />
      );
      break;

    case "standings":
      content = (
        <Standings
          teams={teams}
          error={error}
          updatedAt={updatedAt}
        />
      );
      break;

    default:
      content = (
        <LiveRanking
          teams={teams}
          error={error}
          updatedAt={updatedAt}
        />
      );
      break;
  }

  return (
    <OverlayThemeContext.Provider value={theme}>
      <style>
        {STYLES}
      </style>

      {content}
    </OverlayThemeContext.Provider>
  );
}

/*
|--------------------------------------------------------------------------
| STYLES
|--------------------------------------------------------------------------
*/

const STYLES = `
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

    background:
      transparent !important;
  }

  body {
    font-family:
      Inter,
      "Segoe UI",
      Arial,
      sans-serif;

    color: #f5f1e8;

    -webkit-font-smoothing:
      antialiased;
  }

  /*
  |--------------------------------------------------------------------------
  | CANVAS
  |--------------------------------------------------------------------------
  */

  .independent-overlay {
    position: fixed;

    inset: 0;

    width: 100vw;
    height: 100vh;

    overflow: hidden;

    background:
      transparent;

    pointer-events: none;

    --gold: #d9b94f;
    --gold-light: #f1d36a;
    --accent-soft: rgba(217,185,79,0.12);
    --accent-line: rgba(217,185,79,0.35);
    --accent-glow: rgba(217,185,79,0.16);

    --white: #f5f1e8;

    --panel:
      rgba(4, 7, 9, 0.96);

    --panel-soft:
      rgba(7, 10, 13, 0.93);

    --line:
      rgba(255,255,255,0.08);

    --muted:
      rgba(255,255,255,0.38);

    --green: #51ddb1;
    --green-soft: rgba(81,221,177,0.12);

    --red: #e75b5b;
  }

  /*
  |--------------------------------------------------------------------------
  | MWOPS DARK
  |--------------------------------------------------------------------------
  */

  .independent-overlay.theme-dark {
    --gold: #d9b94f;
    --gold-light: #f1d36a;
    --accent-soft: rgba(217,185,79,0.12);
    --accent-line: rgba(217,185,79,0.35);
    --accent-glow: rgba(217,185,79,0.16);
    --panel: rgba(4,7,9,0.96);
    --panel-soft: rgba(7,10,13,0.93);
  }

  /*
  |--------------------------------------------------------------------------
  | MWOPS GOLD
  |--------------------------------------------------------------------------
  */

  .independent-overlay.theme-gold {
    --gold: #f0a928;
    --gold-light: #ffd978;
    --accent-soft: rgba(240,169,40,0.16);
    --accent-line: rgba(240,169,40,0.48);
    --accent-glow: rgba(240,169,40,0.24);
    --panel: rgba(14,10,5,0.97);
    --panel-soft: rgba(19,13,6,0.94);
    --line: rgba(255,220,150,0.11);
    --muted: rgba(255,235,195,0.42);
    --green: #75e0a8;
    --green-soft: rgba(117,224,168,0.12);
  }

  /*
  |--------------------------------------------------------------------------
  | MWOPS GREEN
  |--------------------------------------------------------------------------
  */

  .independent-overlay.theme-green {
    --gold: #35d49a;
    --gold-light: #82f3c2;
    --accent-soft: rgba(53,212,154,0.14);
    --accent-line: rgba(53,212,154,0.42);
    --accent-glow: rgba(53,212,154,0.22);
    --panel: rgba(3,11,9,0.97);
    --panel-soft: rgba(5,15,12,0.94);
    --line: rgba(105,235,190,0.11);
    --muted: rgba(205,255,236,0.40);
    --green: #82f3c2;
    --green-soft: rgba(130,243,194,0.14);
  }

  /*
  |--------------------------------------------------------------------------
  | MWOPS MINIMAL
  |--------------------------------------------------------------------------
  */

  .independent-overlay.theme-minimal {
    --gold: #d8dde2;
    --gold-light: #ffffff;
    --accent-soft: rgba(216,221,226,0.10);
    --accent-line: rgba(216,221,226,0.32);
    --accent-glow: rgba(216,221,226,0.12);
    --panel: rgba(9,11,13,0.96);
    --panel-soft: rgba(13,15,17,0.93);
    --line: rgba(255,255,255,0.10);
    --muted: rgba(255,255,255,0.36);
    --green: #aeb8bf;
    --green-soft: rgba(174,184,191,0.10);
  }

  .independent-overlay.theme-minimal .ind-overlay-header {
    border-left-color: rgba(255,255,255,0.72);
  }

  .independent-overlay.theme-minimal .ind-corner {
    opacity: 0.45;
  }

  .independent-overlay.theme-minimal .ranking-row.first {
    box-shadow: inset 3px 0 0 rgba(255,255,255,0.72);
  }

  .independent-overlay.theme-minimal .ranking-row.first {
    background: linear-gradient(
      90deg,
      rgba(255,255,255,0.08),
      rgba(255,255,255,0.015)
    );
  }

  .independent-overlay.theme-minimal .winner-wrap {
    background: radial-gradient(
      circle at center,
      rgba(255,255,255,0.055),
      transparent 48%
    );
  }

  .independent-overlay.theme-minimal .winner-logo {
    box-shadow: 0 0 60px rgba(255,255,255,0.045);
  }

  /*
  |--------------------------------------------------------------------------
  | THEME-SPECIFIC BROADCAST FINISHES
  |--------------------------------------------------------------------------
  */

  .independent-overlay.theme-gold .ind-overlay-header,
  .independent-overlay.theme-gold .ranking-card,
  .independent-overlay.theme-gold .results-card,
  .independent-overlay.theme-gold .standings-card {
    box-shadow: 0 20px 65px rgba(0,0,0,0.48), 0 0 34px var(--accent-glow);
  }

  .independent-overlay.theme-green .ind-overlay-header {
    background: linear-gradient(
      90deg,
      rgba(3,10,8,0.97),
      rgba(5,15,12,0.88)
    );
  }

  .independent-overlay.theme-green .squad-card,
  .independent-overlay.theme-green .ranking-card,
  .independent-overlay.theme-green .results-card,
  .independent-overlay.theme-green .standings-card {
    box-shadow: 0 20px 60px rgba(0,0,0,0.46), 0 0 28px var(--accent-glow);
  }

  /*
  |--------------------------------------------------------------------------
  | HEADER
  |--------------------------------------------------------------------------
  */

  .ind-overlay-header {
    position: absolute;

    top: 28px;
    left: 34px;
    right: 34px;

    height: 62px;

    display: flex;

    align-items: center;

    justify-content: space-between;

    padding:
      0 18px;

    background:
      linear-gradient(
        90deg,
        rgba(4,7,9,0.96),
        rgba(8,11,13,0.86)
      );

    border-left:
      3px solid var(--gold);

    border-bottom:
      1px solid var(--line);
  }

  .ind-eyebrow {
    color:
      var(--gold-light);

    font-size: 8px;

    font-weight: 950;

    letter-spacing:
      0.18em;

    text-transform:
      uppercase;
  }

  .ind-title {
    margin-top: 5px;

    color:
      #ffffff;

    font-size: 20px;

    font-weight: 1000;

    letter-spacing:
      0.03em;

    text-transform:
      uppercase;
  }

  .ind-brand {
    display: flex;

    align-items: center;

    gap: 13px;
  }

  .ind-brand strong {
    color:
      var(--gold-light);

    font-size: 18px;

    font-weight: 1000;

    letter-spacing:
      0.08em;
  }

  .ind-brand span {
    padding-left: 13px;

    border-left:
      1px solid
      rgba(255,255,255,0.16);

    color:
      rgba(255,255,255,0.35);

    font-size: 7px;

    font-weight: 900;

    letter-spacing:
      0.12em;
  }

  /*
  |--------------------------------------------------------------------------
  | CORNER DETAILS
  |--------------------------------------------------------------------------
  */

  .ind-corner {
    position: absolute;

    width: 18px;
    height: 18px;

    opacity: 0.7;
  }

  .ind-corner-tl {
    top: 14px;
    left: 14px;

    border-top:
      1px solid var(--gold);

    border-left:
      1px solid var(--gold);
  }

  .ind-corner-tr {
    top: 14px;
    right: 14px;

    border-top:
      1px solid var(--gold);

    border-right:
      1px solid var(--gold);
  }

  .ind-corner-bl {
    bottom: 14px;
    left: 14px;

    border-bottom:
      1px solid var(--gold);

    border-left:
      1px solid var(--gold);
  }

  .ind-corner-br {
    bottom: 14px;
    right: 14px;

    border-bottom:
      1px solid var(--gold);

    border-right:
      1px solid var(--gold);
  }

  /*
  |--------------------------------------------------------------------------
  | CONNECTION
  |--------------------------------------------------------------------------
  */

  .ind-connection {
    position: absolute;

    right: 34px;
    bottom: 24px;

    display: flex;

    align-items: center;

    gap: 7px;

    height: 23px;

    padding:
      0 9px;

    background:
      rgba(4,7,9,0.85);

    border:
      1px solid var(--line);

    color:
      rgba(255,255,255,0.35);

    font-size: 6px;

    font-weight: 900;

    letter-spacing:
      0.1em;
  }

  .ind-connection span {
    width: 5px;
    height: 5px;

    border-radius: 50%;

    background:
      var(--green);

    box-shadow:
      0 0 8px
      rgba(81,221,177,0.7);
  }

  .ind-connection.error span {
    background:
      var(--red);

    box-shadow:
      0 0 8px
      rgba(231,91,91,0.7);
  }

  .ind-connection small {
    margin-left: 3px;

    color:
      rgba(255,255,255,0.18);
  }

  /*
  |--------------------------------------------------------------------------
  | GENERIC RANKING
  |--------------------------------------------------------------------------
  */

  .ranking-card {
    position: absolute;

    top: 115px;
    right: 34px;

    width: 610px;

    background:
      var(--panel);

    border-right:
      3px solid var(--gold);

    box-shadow:
      0 20px 60px
      rgba(0,0,0,0.42);
  }

  .ranking-columns {
    height: 38px;

    display: grid;

    grid-template-columns:
      55px
      1fr
      125px
      70px
      70px;

    align-items: center;

    padding:
      0 12px;

    border-bottom:
      1px solid var(--line);

    color:
      rgba(255,255,255,0.31);

    font-size: 7px;

    font-weight: 900;

    letter-spacing:
      0.1em;
  }

  .ranking-columns span:not(:nth-child(2)) {
    text-align: center;
  }

  .ranking-list {
    max-height: 790px;

    overflow: hidden;
  }

  .ranking-row {
    min-height: 57px;

    display: grid;

    grid-template-columns:
      55px
      1fr
      125px
      70px
      70px;

    align-items: center;

    padding:
      0 12px;

    border-bottom:
      1px solid
      rgba(255,255,255,0.05);

    background:
      rgba(255,255,255,0.018);
  }

  .ranking-row:nth-child(even) {
    background:
      rgba(255,255,255,0.032);
  }

  .ranking-row.first {
    background:
      linear-gradient(
        90deg,
        rgba(217,185,79,0.15),
        rgba(217,185,79,0.025)
      );

    box-shadow:
      inset 3px 0 0
      var(--gold);
  }

  .ranking-row.eliminated {
    opacity: 0.4;
  }

  .ranking-position {
    color:
      rgba(255,255,255,0.75);

    font-size: 18px;

    font-weight: 1000;

    text-align: center;
  }

  .ranking-row.first
    .ranking-position {
    color:
      var(--gold-light);
  }

  .ranking-team {
    display: flex;

    align-items: center;

    gap: 11px;

    min-width: 0;
  }

  .ranking-team > div:last-child {
    min-width: 0;
  }

  .ranking-team strong {
    display: block;

    overflow: hidden;

    text-overflow: ellipsis;

    white-space: nowrap;

    color:
      #ffffff;

    font-size: 13px;

    font-weight: 950;
  }

  .ranking-team small {
    display: block;

    margin-top: 3px;

    overflow: hidden;

    text-overflow: ellipsis;

    white-space: nowrap;

    color:
      rgba(255,255,255,0.3);

    font-size: 7px;

    font-weight: 800;

    text-transform:
      uppercase;
  }

  .ranking-alive {
    display: flex;

    align-items: center;

    justify-content: center;
  }

  .ranking-points,
  .ranking-kills {
    color:
      #ffffff;

    font-size: 15px;

    font-weight: 1000;

    text-align: center;
  }

  .ranking-kills {
    color:
      var(--gold-light);
  }

  .ind-alive-bars {
    display: flex;

    align-items: center;

    justify-content: center;

    gap: 4px;

    width: 56px;
  }

  .ind-alive-bars span {
    flex: 0 0 10px;

    width: 10px;
    height: 18px;

    transform:
      skewX(-17deg);

    background:
      rgba(255,255,255,0.12);
  }

  .ind-alive-bars span.active {
    background:
      var(--green);

    box-shadow:
      0 0 7px
      var(--accent-glow);
  }

  /*
  |--------------------------------------------------------------------------
  | ELIMINATION
  |--------------------------------------------------------------------------
  */

  .elimination-wrap {
    position: absolute;

    top: 50%;

    left: 50%;

    width: 900px;

    transform:
      translate(-50%, -50%);
  }

  .elimination-alert {
    margin-bottom: 12px;

    text-align: center;
  }

  .elimination-alert span {
    display: inline-block;

    padding:
      8px 18px;

    color:
      var(--red);

    background:
      rgba(231,91,91,0.08);

    border:
      1px solid
      rgba(231,91,91,0.35);

    font-size: 9px;

    font-weight: 950;

    letter-spacing:
      0.2em;
  }

  .elimination-card {
    display: grid;

    grid-template-columns:
      130px
      1fr
      300px;

    align-items: center;

    min-height: 170px;

    padding:
      18px 25px;

    background:
      linear-gradient(
        110deg,
        rgba(5,7,9,0.98),
        rgba(14,8,9,0.95)
      );

    border-left:
      4px solid var(--red);

    border-top:
      1px solid
      rgba(231,91,91,0.35);

    border-bottom:
      1px solid
      rgba(231,91,91,0.15);

    box-shadow:
      0 25px 70px
      rgba(0,0,0,0.55);
  }

  .elim-logo {
    display: flex;

    justify-content: center;
  }

  .elim-team small,
  .winner-team small {
    display: block;

    color:
      var(--red);

    font-size: 8px;

    font-weight: 950;

    letter-spacing:
      0.15em;
  }

  .elim-team strong {
    display: block;

    margin-top: 5px;

    color:
      #ffffff;

    font-size: 36px;

    font-weight: 1000;
  }

  .elim-team span {
    display: block;

    margin-top: 4px;

    color:
      rgba(255,255,255,0.35);

    font-size: 9px;

    font-weight: 800;

    text-transform:
      uppercase;
  }

  .elim-stats {
    display: grid;

    grid-template-columns:
      repeat(3, 1fr);

    height: 100%;
  }

  .elim-stats > div {
    display: flex;

    flex-direction: column;

    align-items: center;

    justify-content: center;

    border-left:
      1px solid var(--line);
  }

  .elim-stats small,
  .winner-stats small {
    color:
      rgba(255,255,255,0.3);

    font-size: 7px;

    font-weight: 900;

    letter-spacing:
      0.1em;
  }

  .elim-stats strong {
    margin-top: 8px;

    color:
      #ffffff;

    font-size: 23px;

    font-weight: 1000;
  }

  /*
  |--------------------------------------------------------------------------
  | SHOWCASE
  |--------------------------------------------------------------------------
  */

  .showcase-grid {
    position: absolute;

    top: 115px;
    left: 34px;
    right: 34px;
    bottom: 65px;

    display: grid;

    grid-template-columns:
      repeat(2, 1fr);

    grid-auto-rows:
      minmax(150px, 1fr);

    gap: 12px;
  }

  .squad-card {
    min-width: 0;

    background:
      linear-gradient(
        145deg,
        rgba(5,8,10,0.97),
        rgba(9,12,14,0.92)
      );

    border:
      1px solid var(--line);

    border-left:
      3px solid var(--gold);

    box-shadow:
      0 14px 38px
      rgba(0,0,0,0.3);
  }

  .squad-header {
    height: 76px;

    display: grid;

    grid-template-columns:
      38px
      60px
      1fr
      80px;

    align-items: center;

    gap: 10px;

    padding:
      0 12px;

    border-bottom:
      1px solid var(--line);
  }

  .squad-position {
    color:
      var(--gold-light);

    font-size: 13px;

    font-weight: 1000;

    text-align: center;
  }

  .squad-team {
    min-width: 0;
  }

  .squad-team strong {
    display: block;

    color:
      #ffffff;

    font-size: 15px;

    font-weight: 1000;
  }

  .squad-team small {
    display: block;

    margin-top: 3px;

    overflow: hidden;

    text-overflow: ellipsis;

    white-space: nowrap;

    color:
      rgba(255,255,255,0.3);

    font-size: 7px;

    font-weight: 800;

    text-transform:
      uppercase;
  }

  .squad-points {
    text-align: right;
  }

  .squad-points strong {
    display: block;

    color:
      var(--gold-light);

    font-size: 20px;

    font-weight: 1000;
  }

  .squad-points small {
    color:
      rgba(255,255,255,0.3);

    font-size: 6px;

    font-weight: 900;
  }

  .squad-players {
    padding:
      7px 12px;
  }

  .squad-player {
    height: 28px;

    display: grid;

    grid-template-columns:
      28px
      1fr
      30px;

    align-items: center;

    border-bottom:
      1px solid
      rgba(255,255,255,0.04);
  }

  .squad-player.dead {
    opacity: 0.35;
  }

  .squad-player-number {
    color:
      rgba(255,255,255,0.25);

    font-size: 7px;

    font-weight: 900;
  }

  .squad-player-name {
    overflow: hidden;

    text-overflow: ellipsis;

    white-space: nowrap;

    color:
      rgba(255,255,255,0.83);

    font-size: 9px;

    font-weight: 850;

    text-transform:
      uppercase;
  }

  .squad-player-kills {
    color:
      var(--gold-light);

    font-size: 10px;

    font-weight: 950;

    text-align: right;
  }

  .squad-footer {
    height: 30px;

    display: flex;

    align-items: center;

    justify-content: space-between;

    padding:
      0 12px;

    border-top:
      1px solid var(--line);

    color:
      rgba(255,255,255,0.32);

    font-size: 7px;

    font-weight: 900;

    letter-spacing:
      0.08em;
  }

  /*
  |--------------------------------------------------------------------------
  | WINNER
  |--------------------------------------------------------------------------
  */

  .winner-wrap {
    position: absolute;

    inset: 130px 34px 65px;

    display: flex;

    flex-direction: column;

    align-items: center;

    justify-content: center;

    background:
      radial-gradient(
        circle at center,
        rgba(217,185,79,0.12),
        transparent 48%
      );
  }

  .winner-event span {
    display: inline-block;

    padding:
      8px 20px;

    color:
      var(--gold-light);

    border:
      1px solid
      rgba(217,185,79,0.35);

    background:
      rgba(217,185,79,0.06);

    font-size: 8px;

    font-weight: 950;

    letter-spacing:
      0.2em;
  }

  .winner-rank {
    position: absolute;

    top: 40px;
    right: 100px;

    color:
      rgba(217,185,79,0.08);

    font-size: 170px;

    font-weight: 1000;

    line-height: 1;
  }

  .winner-logo {
    margin-top: 24px;

    padding: 13px;

    background:
      rgba(217,185,79,0.06);

    border:
      1px solid
      rgba(217,185,79,0.3);

    box-shadow:
      0 0 70px
      rgba(217,185,79,0.08);
  }

  .winner-team {
    margin-top: 15px;

    text-align: center;
  }

  .winner-team small {
    color:
      var(--gold-light);
  }

  .winner-team strong {
    display: block;

    margin-top: 4px;

    color:
      #ffffff;

    font-size: 46px;

    font-weight: 1000;

    letter-spacing:
      0.02em;
  }

  .winner-team span {
    display: block;

    margin-top: 4px;

    color:
      rgba(255,255,255,0.34);

    font-size: 9px;

    font-weight: 800;

    text-transform:
      uppercase;
  }

  .winner-stats {
    display: flex;

    margin-top: 23px;

    background:
      rgba(4,7,9,0.92);

    border:
      1px solid var(--line);
  }

  .winner-stats > div {
    min-width: 150px;

    display: flex;

    flex-direction: column;

    align-items: center;

    padding:
      12px 20px;

    border-right:
      1px solid var(--line);
  }

  .winner-stats > div:last-child {
    border-right: 0;
  }

  .winner-stats strong {
    margin-top: 5px;

    color:
      var(--gold-light);

    font-size: 19px;

    font-weight: 1000;
  }

  .winner-match {
    margin-top: 18px;

    color:
      rgba(255,255,255,0.24);

    font-size: 7px;

    font-weight: 900;

    letter-spacing:
      0.15em;

    text-transform:
      uppercase;
  }

  /*
  |--------------------------------------------------------------------------
  | RESULTS
  |--------------------------------------------------------------------------
  */

  .results-card {
    position: absolute;

    top: 115px;
    left: 50%;

    width: 880px;

    transform:
      translateX(-50%);

    background:
      var(--panel);

    border:
      1px solid var(--line);

    border-top:
      3px solid var(--gold);

    box-shadow:
      0 20px 65px
      rgba(0,0,0,0.4);
  }

  .results-event {
    height: 43px;

    display: flex;

    align-items: center;

    padding:
      0 16px;

    color:
      rgba(255,255,255,0.38);

    font-size: 7px;

    font-weight: 900;

    letter-spacing:
      0.12em;

    text-transform:
      uppercase;

    border-bottom:
      1px solid var(--line);
  }

  .results-header {
    height: 34px;

    display: grid;

    grid-template-columns:
      70px
      1fr
      110px
      110px;

    align-items: center;

    padding:
      0 15px;

    color:
      rgba(255,255,255,0.3);

    font-size: 7px;

    font-weight: 900;

    letter-spacing:
      0.1em;

    border-bottom:
      1px solid var(--line);
  }

  .results-header span:nth-child(n+3) {
    text-align: center;
  }

  .result-row {
    height: 54px;

    display: grid;

    grid-template-columns:
      70px
      1fr
      110px
      110px;

    align-items: center;

    padding:
      0 15px;

    border-bottom:
      1px solid
      rgba(255,255,255,0.05);
  }

  .result-row.winner-row {
    background:
      rgba(217,185,79,0.11);

    box-shadow:
      inset 3px 0 0
      var(--gold);
  }

  .result-rank {
    color:
      var(--gold-light);

    font-size: 14px;

    font-weight: 1000;

    text-align: center;
  }

  .result-team {
    display: flex;

    align-items: center;

    gap: 10px;
  }

  .result-team strong {
    display: block;

    color:
      #ffffff;

    font-size: 11px;

    font-weight: 950;
  }

  .result-team small {
    display: block;

    margin-top: 2px;

    color:
      rgba(255,255,255,0.28);

    font-size: 6px;

    font-weight: 800;

    text-transform:
      uppercase;
  }

  .result-kills,
  .result-points {
    color:
      #ffffff;

    font-size: 14px;

    font-weight: 1000;

    text-align: center;
  }

  .result-points {
    color:
      var(--gold-light);
  }

  /*
  |--------------------------------------------------------------------------
  | STANDINGS
  |--------------------------------------------------------------------------
  */

  .standings-card {
    position: absolute;

    top: 115px;
    left: 50%;

    width: 960px;

    transform:
      translateX(-50%);

    background:
      var(--panel);

    border:
      1px solid var(--line);

    border-top:
      3px solid var(--gold);

    box-shadow:
      0 20px 65px
      rgba(0,0,0,0.4);
  }

  .standings-header,
  .standing-row {
    display: grid;

    grid-template-columns:
      80px
      1fr
      120px
      150px
      120px;

    align-items: center;

    padding:
      0 16px;
  }

  .standings-header {
    height: 42px;

    color:
      rgba(255,255,255,0.3);

    font-size: 7px;

    font-weight: 900;

    letter-spacing:
      0.1em;

    border-bottom:
      1px solid var(--line);
  }

  .standings-header span:nth-child(n+3) {
    text-align: center;
  }

  .standing-row {
    min-height: 57px;

    border-bottom:
      1px solid
      rgba(255,255,255,0.05);
  }

  .standing-row:nth-child(even) {
    background:
      rgba(255,255,255,0.025);
  }

  .standing-rank {
    color:
      rgba(255,255,255,0.62);

    font-size: 14px;

    font-weight: 1000;

    text-align: center;
  }

  .standing-rank.top {
    color:
      var(--gold-light);
  }

  .standing-team {
    display: flex;

    align-items: center;

    gap: 11px;
  }

  .standing-team strong {
    display: block;

    color:
      #ffffff;

    font-size: 12px;

    font-weight: 950;
  }

  .standing-team small {
    display: block;

    margin-top: 2px;

    color:
      rgba(255,255,255,0.3);

    font-size: 6px;

    font-weight: 800;

    text-transform:
      uppercase;
  }

  .standing-elims,
  .standing-match-points,
  .standing-total {
    color:
      #ffffff;

    font-size: 13px;

    font-weight: 950;

    text-align: center;
  }

  .standing-match-points {
    color:
      rgba(255,255,255,0.68);
  }

  .standing-total {
    color:
      var(--gold-light);

    font-size: 15px;
  }

  /*
  |--------------------------------------------------------------------------
  | TEAM LOGO
  |--------------------------------------------------------------------------
  */

  .ind-team-logo {
    flex: 0 0 auto;

    display: flex;

    align-items: center;

    justify-content: center;

    overflow: hidden;

    background:
      rgba(255,255,255,0.035);

    border:
      1px solid
      rgba(255,255,255,0.07);
  }

  .ind-team-logo img {
    width: 100%;
    height: 100%;

    object-fit: contain;
  }

  .ind-team-logo.fallback {
    color:
      var(--gold-light);

    font-size: 8px;

    font-weight: 1000;

    border-color:
      rgba(217,185,79,0.25);

    background:
      linear-gradient(
        135deg,
        rgba(217,185,79,0.15),
        rgba(217,185,79,0.03)
      );
  }

  /*
  |--------------------------------------------------------------------------
  | LIVE DATA SYNC
  |--------------------------------------------------------------------------
  */

  .ind-connection:not(.error) span {
    animation:
      mwopsSyncPulse 1.8s ease-in-out infinite;
  }

  @keyframes mwopsSyncPulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }

    50% {
      opacity: 0.48;
      transform: scale(0.78);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | EMPTY / LOADING
  |--------------------------------------------------------------------------
  */

  .ind-empty {
    min-height: 220px;

    display: flex;

    flex-direction: column;

    align-items: center;

    justify-content: center;

    gap: 9px;

    color:
      rgba(255,255,255,0.28);
  }

  .ind-empty div {
    color:
      var(--gold-light);

    font-size: 17px;

    font-weight: 1000;

    letter-spacing:
      0.12em;
  }

  .ind-empty span {
    font-size: 7px;

    font-weight: 900;

    letter-spacing:
      0.12em;
  }

  .ind-loading {
    position: fixed;

    inset: 0;

    display: flex;

    flex-direction: column;

    align-items: center;

    justify-content: center;

    background:
      radial-gradient(
        circle at center,
        rgba(217,185,79,0.07),
        transparent 40%
      );
  }

  .ind-spinner {
    width: 38px;
    height: 38px;

    border:
      2px solid
      rgba(217,185,79,0.15);

    border-top-color:
      var(--gold-light);

    border-radius: 50%;

    animation:
      mwopsSpin
      0.8s
      linear
      infinite;
  }

  .ind-loading strong {
    margin-top: 15px;

    color:
      var(--gold-light);

    font-size: 17px;

    font-weight: 1000;

    letter-spacing:
      0.12em;
  }

  .ind-loading span {
    margin-top: 6px;

    color:
      rgba(255,255,255,0.3);

    font-size: 7px;

    font-weight: 900;

    letter-spacing:
      0.1em;
  }

  .missing-match {
    position: fixed;

    inset: 0;

    display: flex;

    flex-direction: column;

    align-items: center;

    justify-content: center;

    gap: 10px;
  }

  .missing-match strong {
    color:
      var(--gold-light);

    font-size: 22px;

    font-weight: 1000;
  }

  .missing-match span {
    color:
      rgba(255,255,255,0.35);

    font-size: 8px;

    font-weight: 900;

    letter-spacing:
      0.12em;
  }

  .no-event {
    min-height: 170px;

    display: flex;

    align-items: center;

    justify-content: center;

    color:
      rgba(255,255,255,0.28);

    font-size: 8px;

    font-weight: 900;

    letter-spacing:
      0.12em;
  }

  /*
  |--------------------------------------------------------------------------
  | ANIMATION
  |--------------------------------------------------------------------------
  */

  @keyframes mwopsSpin {
    to {
      transform:
        rotate(360deg);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | SMALLER CANVAS
  |--------------------------------------------------------------------------
  */

  @media (max-width: 1200px) {

    .ranking-card {
      width: 500px;
    }

    .results-card {
      width: 720px;
    }

    .standings-card {
      width: 760px;
    }

    .showcase-grid {
      grid-template-columns:
        repeat(2, 1fr);
    }

  }

  @media (max-width: 800px) {

    .ind-overlay-header {
      left: 15px;
      right: 15px;
    }

    .ind-title {
      font-size: 15px;
    }

    .ind-brand span {
      display: none;
    }

    .ranking-card {
      left: 15px;
      right: 15px;

      width: auto;
    }

    .results-card,
    .standings-card {
      left: 15px;
      right: 15px;

      width: auto;

      transform: none;
    }

    .showcase-grid {
      left: 15px;
      right: 15px;

      grid-template-columns:
        1fr;
    }

    .elimination-wrap {
      width: calc(100% - 30px);
    }

    .elimination-card {
      grid-template-columns:
        90px
        1fr;

      gap: 10px;
    }

    .elim-stats {
      grid-column:
        1 / -1;

      height: 70px;
    }

  }
`;