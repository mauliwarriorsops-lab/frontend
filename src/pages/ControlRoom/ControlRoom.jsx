/*
|--------------------------------------------------------------------------
| MWOPS LIVE MATCH CONTROL
|--------------------------------------------------------------------------
|
| Production control room for live esports operations.
|
| OBS IS PART OF THE CONTROL ROOM.
|
| OBS functionality includes:
| - Overlay links
| - Theme selection
| - Independent overlay links
| - Live ranking
| - Elimination alerts
| - Individual broadcast overlays
|
| IMPORTANT:
|
| Player elimination can be controlled from the compact 4-player
| status dots beside the team name.
|
| Double-click a player dot to eliminate/recall that specific player.
| The detailed player controls remain available below.
|
| There is NO +/- alive-player counter.
|
|--------------------------------------------------------------------------
| API CONTRACT
|--------------------------------------------------------------------------
|
| GET
| /api/control-room/:matchId
|
| PATCH
| /api/control-room/:matchId/team/:teamId
|
| POST
| /api/control-room/:matchId/team/:teamId/kill
|
| DELETE
| /api/control-room/:matchId/team/:teamId/kill
|
| PATCH
| /api/control-room/:matchId/player/:playerId/alive
|
|--------------------------------------------------------------------------
*/

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Activity,
  ArrowLeft,
  Check,
  ChevronDown,
  Circle,
  Copy,
  ExternalLink,
  Gamepad2,
  Minus,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  Star,
  Trophy,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
*/

const API_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

/*
|--------------------------------------------------------------------------
| LIVE CONTROL ROOM SYNC
|--------------------------------------------------------------------------
|
| The Control Room and OBS overlays use the same backend state.
|
| The overlays already poll the public Control Room endpoint. This page
| also performs a lightweight background sync so changes made from
| another operator/browser are reflected here without a manual refresh.
|
| The backend remains the source of truth.
|
|--------------------------------------------------------------------------
*/

const CONTROL_ROOM_SYNC_INTERVAL = 750;
const CONTROL_ROOM_REQUEST_TIMEOUT = 5000;

/*
|--------------------------------------------------------------------------
| OVERLAY CONFIGURATION
|--------------------------------------------------------------------------
|
| Public overlay pages are served by the frontend.
|
| This can later be changed to a dedicated overlay domain through:
|
| VITE_OVERLAY_BASE_URL=https://your-overlay-domain.com
|
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| OBS OVERLAY BASE URL
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| Do NOT use window.location.origin as the fallback here.
|
| Vercel deployment URLs can change between deployments. If the Control
| Room is opened from an old Vercel deployment, window.location.origin
| would generate OBS links pointing to that old/deleted deployment.
|
| VITE_OVERLAY_BASE_URL can still override this in Vercel Environment
| Variables when a permanent custom overlay domain is configured.
|
| Current MWOPS frontend deployment:
| https://frontend-jet-eight-s2b19axo7v.vercel.app
|
|--------------------------------------------------------------------------
*/

const OVERLAY_BASE_URL = (
  import.meta.env.VITE_OVERLAY_BASE_URL ||
  "https://frontend-jet-eight-s2b19axo7v.vercel.app"
).replace(/\/+$/, "");

/*
|--------------------------------------------------------------------------
| RESPONSE HELPERS
|--------------------------------------------------------------------------
*/

async function parseResponse(response) {
  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  let payload = null;

  try {
    if (
      contentType.includes(
        "application/json"
      )
    ) {
      payload =
        await response.json();
    } else {
      const text =
        await response.text();

      payload = text
        ? {
            message: text,
          }
        : null;
    }
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      payload?.details ||
      `Request failed with status ${response.status}`;

    const error =
      new Error(message);

    error.status =
      response.status;

    error.response =
      payload;

    throw error;
  }

  return payload;
}

function unwrapResponse(
  payload
) {
  let current = payload;

  /*
  |--------------------------------------------------------------------------
  | Some backend middleware can wrap an API response more than once.
  | Unwrap only a few known response layers so the Control Room can work
  | with both { data: state } and { data: { data: state } } responses.
  |--------------------------------------------------------------------------
  */

  for (let depth = 0; depth < 3; depth += 1) {
    if (
      current &&
      typeof current ===
        "object" &&
      !Array.isArray(current) &&
      current.data !==
        undefined
    ) {
      current =
        current.data;

      continue;
    }

    if (
      current &&
      typeof current ===
        "object" &&
      !Array.isArray(current) &&
      current.result !==
        undefined
    ) {
      current =
        current.result;

      continue;
    }

    break;
  }

  return current;
}

function normalizeArray(
  value
) {
  if (Array.isArray(value)) {
    return value;
  }

  if (
    Array.isArray(
      value?.data
    )
  ) {
    return value.data;
  }

  if (
    Array.isArray(
      value?.items
    )
  ) {
    return value.items;
  }

  if (
    Array.isArray(
      value?.matches
    )
  ) {
    return value.matches;
  }

  if (
    Array.isArray(
      value?.tournaments
    )
  ) {
    return value.tournaments;
  }

  if (
    Array.isArray(
      value?.results
    )
  ) {
    return value.results;
  }

  return [];
}

/*
|--------------------------------------------------------------------------
| MATCH HELPERS
|--------------------------------------------------------------------------
*/

function getMatchStatus(
  match
) {
  return String(
    match?.status ||
      match?.state ||
      "scheduled"
  ).toUpperCase();
}

function getMatchName(
  match,
  index = 0
) {
  return (
    match?.name ||
    match?.title ||
    match?.match_name ||
    `Match ${index + 1}`
  );
}

function getTournamentName(
  tournament
) {
  return (
    tournament?.name ||
    tournament?.title ||
    "Tournament"
  );
}

function getRoundName(
  match
) {
  if (
    typeof match?.round ===
      "object" &&
    match.round
  ) {
    return (
      match.round.name ||
      "Round 1"
    );
  }

  return (
    match?.round_name ||
    match?.round ||
    match?.roundName ||
    "Round 1"
  );
}


function findMatchById(
  matches,
  matchId
) {
  if (
    !matchId ||
    !Array.isArray(matches)
  ) {
    return null;
  }

  return (
    matches.find(
      (item) =>
        String(
          item?.id ||
            ""
        ) ===
        String(
          matchId
        )
    ) || null
  );
}

function buildFallbackTeamResults(
  selectedMatch
) {
  const matchTeams =
    Array.isArray(
      selectedMatch?.match_teams
    )
      ? selectedMatch.match_teams
      : Array.isArray(
          selectedMatch?.matchTeams
        )
        ? selectedMatch.matchTeams
        : [];

  return matchTeams.map(
    (
      matchTeam
    ) => ({
      ...matchTeam,

      team_id:
        matchTeam?.team_id ||
        matchTeam?.team?.id ||
        null,

      team_name:
        matchTeam?.team?.name ||
        matchTeam?.team_name ||
        "Unknown Team",

      team_tag:
        matchTeam?.team?.short_name ||
        matchTeam?.team_tag ||
        "",

      kills:
        Number(
          matchTeam?.kills
        ) ||
        Number(
          matchTeam?.score
        ) ||
        0,

      points:
        Number(
          matchTeam?.total_points
        ) ||
        Number(
          matchTeam?.points
        ) ||
        Number(
          matchTeam?.score
        ) ||
        0,

      placement:
        matchTeam?.placement ||
        null,

      players:
        Array.isArray(
          matchTeam?.match_team_players
        )
          ? matchTeam.match_team_players
          : Array.isArray(
              matchTeam?.players
            )
            ? matchTeam.players
            : [],
    })
  );
}

/*
|--------------------------------------------------------------------------
| TEAM HELPERS
|--------------------------------------------------------------------------
*/

function getTeamName(
  team
) {
  return (
    team?.team_name ||
    team?.team?.name ||
    team?.name ||
    `Team ${team?.slot || ""}`.trim() ||
    "Unknown Team"
  );
}

function getTeamTag(
  team
) {
  return (
    team?.team_tag ||
    team?.team?.short_name ||
    team?.short_name ||
    ""
  );
}

function getTeamId(
  team
) {
  return (
    team?.team_id ||
    team?.team?.id ||
    team?.id ||
    null
  );
}

function getSlot(
  team,
  fallback
) {
  return (
    Number(team?.slot) ||
    Number(
      team?.match_team?.slot
    ) ||
    fallback
  );
}

/*
|--------------------------------------------------------------------------
| SCORE HELPERS
|--------------------------------------------------------------------------
*/

function getKills(
  team
) {
  return Math.max(
    0,
    Number(
      team?.kills
    ) ||
      Number(
        team?.score
      ) ||
      0
  );
}

function getPoints(
  team
) {
  if (
    team?.total_points !==
      undefined &&
    team?.total_points !==
      null
  ) {
    return (
      Number(
        team.total_points
      ) || 0
    );
  }

  if (
    team?.points !==
      undefined &&
    team?.points !==
      null
  ) {
    return (
      Number(
        team.points
      ) || 0
    );
  }

  return getKills(team);
}

function getPlacement(
  team
) {
  if (
    team?.placement ===
      null ||
    team?.placement ===
      undefined ||
    team?.placement ===
      ""
  ) {
    return null;
  }

  const value =
    Number(
      team.placement
    );

  return Number.isFinite(
    value
  )
    ? value
    : null;
}

/*
|--------------------------------------------------------------------------
| PLAYER HELPERS
|--------------------------------------------------------------------------
*/

function getPlayers(
  team
) {
  if (
    Array.isArray(
      team?.players
    )
  ) {
    return team.players;
  }

  if (
    Array.isArray(
      team?.match_team_players
    )
  ) {
    return (
      team.match_team_players
    );
  }

  if (
    Array.isArray(
      team?.matchTeamPlayers
    )
  ) {
    return (
      team.matchTeamPlayers
    );
  }

  return [];
}

/*
|--------------------------------------------------------------------------
| IMPORTANT PLAYER ID HANDLING
|--------------------------------------------------------------------------
|
| The backend expects players.id from the players table.
|
| match_team_players has its own assignment id.
|
| Therefore player_id MUST be preferred.
|
|--------------------------------------------------------------------------
*/

function getPlayerId(
  player
) {
  return (
    player?.player_id ||
    player?.player?.id ||
    player?.players?.id ||
    null
  );
}

function getPlayerAssignmentId(
  player
) {
  return (
    player?.match_team_player_id ||
    player?.assignment_id ||
    player?.match_team_players_id ||
    null
  );
}

function getPlayerName(
  player
) {
  return (
    player?.gamer_tag ||
    player?.player?.gamer_tag ||
    player?.players?.gamer_tag ||
    player?.real_name ||
    player?.player?.real_name ||
    "Player"
  );
}

function isPlayerAlive(
  player
) {
  if (
    player?.is_alive !==
      undefined &&
    player?.is_alive !==
      null
  ) {
    return (
      player.is_alive !==
      false
    );
  }

  if (
    player?.alive !==
      undefined &&
    player?.alive !==
      null
  ) {
    return (
      player.alive !== false
    );
  }

  if (
    player?.eliminated ===
      true ||
    player?.status ===
      "eliminated" ||
    player?.status ===
      "dead"
  ) {
    return false;
  }

  return true;
}

function getAlivePlayers(
  team
) {
  return getPlayers(
    team
  ).filter(
    isPlayerAlive
  );
}

function getEliminatedPlayers(
  team
) {
  return getPlayers(
    team
  ).filter(
    (player) =>
      !isPlayerAlive(
        player
      )
  );
}

function getAlivePlayerCount(
  team
) {
  return getAlivePlayers(
    team
  ).length;
}

function getEliminatedPlayerCount(
  team
) {
  return getEliminatedPlayers(
    team
  ).length;
}

/*
|--------------------------------------------------------------------------
| TEAM ELIMINATION
|--------------------------------------------------------------------------
*/

function isEliminated(
  team
) {
  const players =
    getPlayers(team);

  if (
    players.length > 0
  ) {
    return (
      getAlivePlayerCount(
        team
      ) === 0
    );
  }

  return (
    team?.eliminated ===
      true ||
    team?.is_eliminated ===
      true ||
    team?.status ===
      "eliminated" ||
    team?.state ===
      "out" ||
    Boolean(
      team?.eliminated_at
    )
  );
}

/*
|--------------------------------------------------------------------------
| OVERLAY URL HELPERS
|--------------------------------------------------------------------------
*/

function createOverlayUrl(
  type,
  matchId,
  extraParams = {}
) {
  if (!matchId) {
    return "";
  }

  const normalizedType =
    String(type || "")
      .trim()
      .toLowerCase();

  if (!normalizedType) {
    return "";
  }

  const params =
    new URLSearchParams();

  /*
  |--------------------------------------------------------------------------
  | PUBLIC OVERLAY ROUTING
  |--------------------------------------------------------------------------
  |
  | IMPORTANT:
  |
  | All OBS overlays use the frontend root query format:
  |
  | /?overlay=live-ranking&matchId=UUID&theme=MWOPS+DARK
  |
  | App.jsx handles ?overlay= BEFORE normal application routes.
  |
  | This prevents OBS overlay URLs from falling through to the
  | Dashboard catch-all route.
  |
  |--------------------------------------------------------------------------
  */

  params.set(
    "overlay",
    normalizedType
  );

  params.set(
    "matchId",
    String(matchId)
  );

  Object.entries(
    extraParams
  ).forEach(
    ([key, value]) => {
      if (
        value !==
          undefined &&
        value !== null &&
        value !== ""
      ) {
        params.set(
          key,
          String(value)
        );
      }
    }
  );

  return `${OVERLAY_BASE_URL}/?${params.toString()}`;
}

/*
|--------------------------------------------------------------------------
| STATUS BADGE
|--------------------------------------------------------------------------
*/

function StatusBadge({
  status,
}) {
  const normalized =
    String(
      status || ""
    ).toUpperCase();

  const live =
    normalized === "LIVE";

  const paused =
    normalized ===
    "PAUSED";

  const completed =
    normalized ===
    "COMPLETED";

  const classes =
    live
      ? "border-red-500/40 bg-red-500/10 text-red-400"
      : paused
        ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
        : completed
          ? "border-zinc-600 bg-zinc-800/60 text-zinc-400"
          : "border-yellow-500/40 bg-yellow-500/10 text-yellow-400";

  const dot =
    live
      ? "bg-red-500"
      : paused
        ? "bg-orange-400"
        : completed
          ? "bg-zinc-500"
          : "bg-yellow-400";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${classes}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${dot} ${
          live
            ? "animate-pulse"
            : ""
        }`}
      />

      {normalized ||
        "SCHEDULED"}
    </span>
  );
}

/*
|--------------------------------------------------------------------------
| PLAYER BUTTON
|--------------------------------------------------------------------------
|
| PLAYER ELIMINATION CONTROL.
|
| The detailed player button still toggles:
|
| ALIVE -> ELIMINATED
|
| ELIMINATED -> ALIVE
|
| A compact 4-dot control beside the team name also supports
| the same player-specific action through double-click.
|
|--------------------------------------------------------------------------
*/

function PlayerStatusButton({
  player,
  onToggle,
  loading,
}) {
  const alive =
    isPlayerAlive(
      player
    );

  const playerId =
    getPlayerId(
      player
    );

  return (
    <button
      type="button"
      onClick={() =>
        onToggle(player)
      }
      disabled={
        loading ||
        !playerId
      }
      title={
        alive
          ? "Eliminate player"
          : "Restore player"
      }
      className={`group/player flex items-center gap-2 rounded-xl border px-3 py-2.5 transition ${
        alive
          ? "border-emerald-500/30 bg-emerald-500/[0.06] hover:border-emerald-400/60 hover:bg-emerald-500/10"
          : "border-orange-500/30 bg-orange-500/[0.06] hover:border-orange-400/60 hover:bg-orange-500/10"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full border text-[9px] font-black ${
          alive
            ? "border-emerald-400/50 bg-emerald-400 text-black"
            : "border-orange-400/50 bg-orange-500/20 text-orange-400"
        }`}
      >
        {alive ? (
          <Check
            size={12}
          />
        ) : (
          <X
            size={12}
          />
        )}
      </span>

      <span className="max-w-[130px] truncate text-[10px] font-black uppercase tracking-wide text-zinc-300">
        {getPlayerName(
          player
        )}
      </span>

      <span
        className={`text-[8px] font-black uppercase tracking-wider ${
          alive
            ? "text-emerald-500"
            : "text-orange-400"
        }`}
      >
        {alive
          ? "ALIVE"
          : "OUT"}
      </span>
    </button>
  );
}

/*
|--------------------------------------------------------------------------
| PLAYER STATUS PANEL
|--------------------------------------------------------------------------
*/

function PlayerControls({
  team,
  onTogglePlayer,
  playerLoading,
}) {
  const players =
    getPlayers(team);

  const alive =
    getAlivePlayerCount(
      team
    );

  const eliminated =
    getEliminatedPlayerCount(
      team
    );

  if (
    !players.length
  ) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-4">
        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">
          <Users size={13} />

          No player lineup assigned
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">
            Player Status
          </p>

          <div className="mt-1 flex items-center gap-3">
            <span className="text-sm font-black text-emerald-400">
              {alive} ALIVE
            </span>

            <span className="text-zinc-700">
              /
            </span>

            <span className="text-sm font-black text-orange-400">
              {eliminated} OUT
            </span>

            <span className="text-[10px] font-bold text-zinc-600">
              / {players.length} TOTAL
            </span>
          </div>
        </div>

        <div
          className={`rounded-lg border px-3 py-1.5 text-[9px] font-black uppercase tracking-wider ${
            alive > 0
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
              : "border-orange-500/40 bg-orange-500/10 text-orange-400"
          }`}
        >
          {alive > 0
            ? "TEAM ACTIVE"
            : "TEAM ELIMINATED"}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {players.map(
          (
            player,
            index
          ) => (
            <PlayerStatusButton
              key={
                getPlayerId(
                  player
                ) ||
                getPlayerAssignmentId(
                  player
                ) ||
                index
              }
              player={
                player
              }
              onToggle={
                onTogglePlayer
              }
              loading={
                playerLoading
              }
            />
          )
        )}
      </div>

      <div className="mt-4 border-t border-white/5 pt-3">
        <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-zinc-700">
          Click a player to eliminate or restore
        </p>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| COMPACT PLAYER DOTS
|--------------------------------------------------------------------------
|
| Four compact dots are shown beside the team name/tag.
|
| Each dot represents one player in the match lineup.
|
| Double-click:
| - ALIVE dot -> eliminate that specific player
| - OUT dot   -> recall that specific player
|
| Empty dots are shown when fewer than four players are assigned.
|--------------------------------------------------------------------------
*/

function CompactPlayerDots({
  team,
  onTogglePlayer,
  playerLoading,
}) {
  const players = getPlayers(team);
  const visiblePlayers = players.slice(0, 4);

  return (
    <div
      className="ml-1 flex items-center gap-1.5"
      title="Double-click a player dot to eliminate or recall that player"
    >
      {[0, 1, 2, 3].map((index) => {
        const player = visiblePlayers[index];

        if (!player) {
          return (
            <span
              key={`empty-${index}`}
              className="h-2.5 w-2.5 rounded-full border border-zinc-700 bg-zinc-800/80"
              title="No player assigned"
            />
          );
        }

        const alive = isPlayerAlive(player);
        const playerId = getPlayerId(player);

        return (
          <button
            key={
              playerId ||
              getPlayerAssignmentId(player) ||
              `player-dot-${index}`
            }
            type="button"
            onDoubleClick={() => {
              if (
                !playerLoading &&
                playerId
              ) {
                onTogglePlayer(player);
              }
            }}
            disabled={
              playerLoading ||
              !playerId
            }
            title={`${getPlayerName(player)} · ${
              alive ? "ALIVE" : "OUT"
            } · Double-click to ${
              alive ? "eliminate" : "recall"
            }`}
            aria-label={`${getPlayerName(player)} ${
              alive ? "alive" : "eliminated"
            }. Double-click to ${
              alive ? "eliminate" : "recall"
            }.`}
            className={`h-3 w-3 rounded-full border transition-all duration-150 ${
              alive
                ? "border-emerald-300 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.45)] hover:scale-125 hover:bg-emerald-300"
                : "border-orange-400 bg-orange-500/20 shadow-[0_0_7px_rgba(249,115,22,0.25)] hover:scale-125 hover:bg-orange-400"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          />
        );
      })}

      {players.length > 4 && (
        <span
          className="ml-0.5 text-[8px] font-black text-zinc-600"
          title={`${players.length - 4} additional player(s)`}
        >
          +{players.length - 4}
        </span>
      )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| TEAM CARD
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| TEAM CARD — COMPACT PRODUCTION ROW
|--------------------------------------------------------------------------
*/

function TeamCard({
  team,
  rank,
  onAddKill,
  onRemoveKill,
  onTogglePlayer,
  actionLoading,
  playerLoading,
}) {
  const eliminated = isEliminated(team);
  const kills = getKills(team);
  const points = getPoints(team);
  const placement = getPlacement(team);
  const teamId = getTeamId(team);
  const players = getPlayers(team);
  const alivePlayers = getAlivePlayerCount(team);
  const eliminatedPlayers = getEliminatedPlayerCount(team);
  const totalPlayers = players.length;

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border bg-[#0d0e10] transition-all duration-200 ${
        eliminated
          ? "border-orange-500/25 hover:border-orange-500/45"
          : "border-white/10 hover:border-yellow-500/30"
      }`}
    >
      <div
        className={`absolute inset-y-0 left-0 w-[2px] ${
          eliminated ? "bg-orange-500" : "bg-yellow-400"
        }`}
      />

      <div className="p-4 pl-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(300px,1.25fr)_minmax(330px,1fr)_auto] xl:items-center">
          {/* TEAM IDENTITY */}
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-[11px] font-black ${
                eliminated
                  ? "border-orange-500/30 bg-orange-500/10 text-orange-400"
                  : "border-yellow-500/25 bg-yellow-500/10 text-yellow-400"
              }`}
            >
              {String(placement || rank).padStart(2, "0")}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2.5">
                <h3 className="truncate text-sm font-black uppercase tracking-wide text-white">
                  {getTeamName(team)}
                </h3>

                <CompactPlayerDots
                  team={team}
                  onTogglePlayer={onTogglePlayer}
                  playerLoading={playerLoading}
                />
              </div>

              <div className="mt-1 flex items-center gap-2">
                <span className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">
                  {getTeamTag(team) || "NO TAG"}
                </span>
                {totalPlayers > 0 && (
                  <span className="text-[8px] font-bold text-zinc-700">
                    {alivePlayers}/{totalPlayers} PLAYERS
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* LIVE SCORE CONTROLS */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center overflow-hidden rounded-xl border border-white/10 bg-black/40">
              <button
                type="button"
                onClick={() => onRemoveKill(team)}
                disabled={actionLoading || !teamId || kills <= 0}
                title="Remove elimination"
                className="flex h-10 w-9 items-center justify-center text-zinc-500 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
              >
                <Minus size={14} />
              </button>

              <div className="min-w-[64px] border-x border-white/10 px-2 text-center">
                <p className="text-lg font-black leading-none text-yellow-400">
                  {kills}
                </p>
                <p className="mt-1 text-[7px] font-black uppercase tracking-[0.14em] text-zinc-600">
                  Eliminations
                </p>
              </div>

              <button
                type="button"
                onClick={() => onAddKill(team)}
                disabled={actionLoading || !teamId}
                title="Add elimination"
                className="flex h-10 w-9 items-center justify-center text-yellow-400 transition hover:bg-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-25"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="flex h-10 items-center gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/[0.04] px-3">
              <Star size={12} className="text-yellow-400" fill="currentColor" />
              <span className="text-sm font-black text-yellow-400">{points}</span>
              <span className="text-[7px] font-black uppercase tracking-[0.14em] text-zinc-600">
                Points
              </span>
            </div>

            <div className="hidden h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 md:flex">
              <Users size={12} className={eliminated ? "text-orange-400" : "text-emerald-400"} />
              <span className={`text-xs font-black ${eliminated ? "text-orange-400" : "text-emerald-400"}`}>
                {alivePlayers}
              </span>
              <span className="text-[8px] font-bold text-zinc-700">ALIVE</span>
            </div>
          </div>

          {/* STATUS */}
          <div className="flex items-center justify-between gap-3 xl:justify-end">
            <div className="text-right">
              <p className="text-[7px] font-black uppercase tracking-[0.15em] text-zinc-700">
                Slot {String(getSlot(team, rank)).padStart(2, "0")}
              </p>
              <p className="mt-1 text-[8px] font-bold uppercase tracking-wider text-zinc-600">
                {eliminatedPlayers} out
              </p>
            </div>

            <div
              className={`inline-flex min-w-[88px] items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[8px] font-black uppercase tracking-[0.15em] ${
                eliminated
                  ? "border-orange-500/30 bg-orange-500/10 text-orange-400"
                  : "border-emerald-500/25 bg-emerald-500/5 text-emerald-400"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${eliminated ? "bg-orange-400" : "animate-pulse bg-emerald-400"}`} />
              {eliminated ? "Eliminated" : "Alive"}
            </div>
          </div>
        </div>

        <div className="mt-3 border-t border-white/5 pt-3">
          <PlayerControls
            team={team}
            onTogglePlayer={onTogglePlayer}
            playerLoading={playerLoading}
          />
        </div>
      </div>
    </article>
  );
}

/*
|--------------------------------------------------------------------------
| MATCH SELECTOR
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| MATCH SELECTOR — COMPACT PRODUCTION BAR
|--------------------------------------------------------------------------
*/

function MatchSelector({
  tournaments,
  matches,
  selectedTournamentId,
  selectedRound,
  selectedMatchId,
  onTournamentChange,
  onRoundChange,
  onMatchChange,
  onRefresh,
  loading,
}) {
  const rounds = useMemo(() => {
    const filtered = matches.filter((item) => {
      if (!selectedTournamentId) return true;
      const tournamentId =
        item?.tournament_id ||
        item?.tournamentId ||
        item?.tournament?.id;
      return String(tournamentId || "") === String(selectedTournamentId);
    });

    const names = [];
    filtered.forEach((item) => {
      const name = getRoundName(item);
      if (!names.includes(name)) names.push(name);
    });
    return names.length ? names : ["Round 1"];
  }, [matches, selectedTournamentId]);

  const filteredMatches = useMemo(
    () =>
      matches.filter((item) => {
        const tournamentId =
          item?.tournament_id ||
          item?.tournamentId ||
          item?.tournament?.id;
        return (
          (!selectedTournamentId ||
            String(tournamentId || "") === String(selectedTournamentId)) &&
          (!selectedRound || getRoundName(item) === selectedRound)
        );
      }),
    [matches, selectedTournamentId, selectedRound]
  );

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-[#0c0d0f]">
      <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center">
        <div className="flex shrink-0 items-center gap-3 lg:w-[210px]">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-yellow-500/25 bg-yellow-500/10 text-yellow-400">
            <Radio size={16} />
          </div>
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-yellow-400">
              Production
            </p>
            <p className="mt-0.5 text-xs font-black uppercase text-zinc-300">
              Match Context
            </p>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-3">
          {[
            {
              label: "Tournament",
              value: selectedTournamentId,
              onChange: onTournamentChange,
              options: tournaments.map((item) => ({
                value: item.id,
                label: getTournamentName(item),
              })),
              placeholder: "All Tournaments",
            },
            {
              label: "Round",
              value: selectedRound,
              onChange: onRoundChange,
              options: rounds.map((item) => ({ value: item, label: item })),
              placeholder: "Round 1",
            },
            {
              label: "Match",
              value: selectedMatchId,
              onChange: onMatchChange,
              options: filteredMatches.map((item, index) => ({
                value: item.id,
                label: `${getMatchName(item, index)} · ${getMatchStatus(item)}`,
              })),
              placeholder: "Select Match",
            },
          ].map((field, index) => (
            <label key={field.label} className="relative">
              <span className="pointer-events-none absolute left-3 top-2 z-10 text-[7px] font-black uppercase tracking-[0.16em] text-zinc-700">
                {field.label}
              </span>
              <select
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                className={`h-[54px] w-full appearance-none rounded-xl border bg-black/30 px-3 pb-1 pt-5 pr-9 text-[11px] font-black uppercase outline-none transition ${
                  index === 2
                    ? "border-yellow-500/25 text-yellow-300 focus:border-yellow-400/60"
                    : "border-white/10 text-zinc-300 focus:border-yellow-500/40"
                }`}
              >
                <option value="">{field.placeholder}</option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="pointer-events-none absolute right-3 top-1/2 mt-2 -translate-y-1/2 text-zinc-600"
              />
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh match data"
          className="flex h-[54px] shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[9px] font-black uppercase tracking-wider text-zinc-500 transition hover:border-yellow-500/25 hover:text-yellow-400 disabled:opacity-40"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span className="hidden lg:inline">Refresh</span>
        </button>
      </div>
    </section>
  );
}

/*
|--------------------------------------------------------------------------
| TOP STAT
|--------------------------------------------------------------------------
*/

function TopStat({
  icon: Icon,
  value,
  label,
  type = "green",
}) {
  const classes =
    type === "red"
      ? "text-red-400"
      : type === "orange"
        ? "text-orange-400"
        : type === "yellow"
          ? "text-yellow-400"
          : "text-emerald-400";

  return (
    <div className="min-w-[80px] text-center">
      <div
        className={`flex items-center justify-center gap-1.5 text-xl font-black ${classes}`}
      >
        <Icon size={16} />

        {value}
      </div>

      <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.13em] text-zinc-600">
        {label}
      </p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| OBS OVERLAY LINK ROW
|--------------------------------------------------------------------------
*/

function OverlayLinkRow({
  icon: Icon,
  title,
  description,
  theme,
  url,
  copied,
  onCopy,
  onOpen,
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0c0f12] transition duration-200 hover:border-yellow-500/30 hover:bg-[#0e1114]">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-yellow-500/15 bg-yellow-500/[0.055] text-yellow-400 transition group-hover:border-yellow-500/30 group-hover:bg-yellow-500/[0.08]">
            <Icon size={16} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-[11px] font-black uppercase tracking-[0.05em] text-zinc-200">
                {title}
              </h3>

              <span className="rounded-md border border-yellow-500/20 bg-yellow-500/[0.06] px-2 py-0.5 text-[6px] font-black uppercase tracking-[0.13em] text-yellow-400">
                Independent
              </span>
            </div>

            <p className="mt-1 text-[9px] leading-4 text-zinc-600">
              {description}
            </p>

            <div className="mt-2 flex min-w-0 items-center gap-2">
              <span className="shrink-0 rounded-md border border-white/[0.06] bg-white/[0.025] px-2 py-1 text-[6px] font-black uppercase tracking-[0.12em] text-zinc-600">
                {theme}
              </span>

              <p className="min-w-0 truncate font-mono text-[8px] text-zinc-700">
                {url || "Select a match first"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onCopy}
            disabled={!url}
            className={`inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-[8px] font-black uppercase tracking-[0.12em] transition ${
              copied
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                : "border-yellow-500/20 bg-yellow-500/[0.055] text-yellow-400 hover:border-yellow-500/40 hover:bg-yellow-500/10"
            } disabled:cursor-not-allowed disabled:opacity-30`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>

          <button
            type="button"
            onClick={onOpen}
            disabled={!url}
            title={`Open ${title}`}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-zinc-600 transition hover:border-yellow-500/30 hover:text-yellow-400 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ExternalLink size={13} />
          </button>
        </div>
      </div>
    </article>
  );
}

/*
|--------------------------------------------------------------------------
| OBS OVERLAY LINKS MODAL
|--------------------------------------------------------------------------
|
| One premium OBS workspace.
|
| The modal intentionally contains ONLY independent overlays.
|
| Removed:
| - Master Overlay
| - Custom Theme Sets / Standard Templates tabs
| - Advanced custom-link section
|
| A single selected theme controls every generated overlay URL.
|
|--------------------------------------------------------------------------
*/

const OBS_OVERLAY_THEMES = [
  {
    name: "MWOPS DARK",
    description: "Premium graphite broadcast package.",
    tone: "Graphite",
  },
  {
    name: "MWOPS GOLD",
    description: "Championship-focused gold presentation.",
    tone: "Championship",
  },
  {
    name: "MWOPS GREEN",
    description: "Competitive live-operations package.",
    tone: "Competitive",
  },
  {
    name: "MWOPS MINIMAL",
    description: "Clean low-distraction broadcast package.",
    tone: "Minimal",
  },
];

const OBS_INDEPENDENT_OVERLAYS = [
  {
    type: "live-ranking",
    title: "Live Ranking",
    description: "Live team ranking and scoreboard.",
    icon: Activity,
  },
  {
    type: "elimination",
    title: "Elimination Alert",
    description: "Broadcast alert for an eliminated team.",
    icon: X,
  },
  {
    type: "showcase",
    title: "Playing Squads",
    description: "Active teams and player lineups.",
    icon: Users,
  },
  {
    type: "winner",
    title: "Match Winner",
    description: "Winner presentation for the completed match.",
    icon: Trophy,
  },
  {
    type: "results",
    title: "Match Results",
    description: "Final match results and points table.",
    icon: Trophy,
  },
  {
    type: "standings",
    title: "Overall Standings",
    description: "Tournament-level standings for broadcast.",
    icon: Star,
  },
];

function OBSOverlayModal({
  open,
  onClose,
  matchId,
  match,
  obsConnected,
  theme,
  onThemeChange,
}) {
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const copyLink = useCallback(async (key, url) => {
    if (!url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(key);

      window.setTimeout(() => {
        setCopied((current) =>
          current === key ? "" : current
        );
      }, 1600);
    } catch (error) {
      console.error(
        "MWOPS - Failed to copy overlay link:",
        error
      );
    }
  }, []);

  const overlayLinks = useMemo(
    () =>
      OBS_INDEPENDENT_OVERLAYS.map((overlay) => ({
        ...overlay,
        url: createOverlayUrl(
          overlay.type,
          matchId,
          {
            theme,
          }
        ),
      })),
    [matchId, theme]
  );

  if (!open) {
    return null;
  }

  const matchName =
    getMatchName(match) || "Active Match";

  const matchMap =
    match?.map || "ERANGEL";

  const matchGame =
    match?.game || "Battle Royale";

  const selectedTheme =
    OBS_OVERLAY_THEMES.find(
      (item) => item.name === theme
    ) || OBS_OVERLAY_THEMES[0];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-3 backdrop-blur-xl sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="OBS overlay links"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-[24px] border border-white/[0.10] bg-[#080a0c] shadow-[0_35px_120px_rgba(0,0,0,.72)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* HEADER */}
        <div className="relative shrink-0 overflow-hidden border-b border-white/[0.07] px-5 py-5 sm:px-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_20%,rgba(231,173,46,.11),transparent_32%),linear-gradient(120deg,rgba(255,255,255,.02),transparent_50%)]" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-yellow-400/60 via-yellow-400/10 to-transparent" />

          <div className="relative flex items-start justify-between gap-5">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-yellow-500/25 bg-yellow-500/[0.08] text-yellow-400 shadow-[0_0_28px_rgba(231,173,46,.08)]">
                <Radio size={18} />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[7px] font-black uppercase tracking-[0.22em] text-yellow-500/80">
                    MWOPS Broadcast
                  </p>

                  <span className="h-1 w-1 rounded-full bg-zinc-700" />

                  <span className="text-[7px] font-black uppercase tracking-[0.18em] text-zinc-700">
                    OBS Browser Sources
                  </span>
                </div>

                <h2 className="mt-1 text-xl font-black uppercase tracking-[-0.02em] text-white sm:text-2xl">
                  Overlay <span className="text-yellow-400">Links</span>
                </h2>

                <p className="mt-1.5 max-w-xl text-[9px] leading-4 text-zinc-600">
                  Independent broadcast graphics for OBS. Every link below
                  automatically follows the selected theme.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div
                className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[7px] font-black uppercase tracking-[0.14em] sm:flex ${
                  obsConnected
                    ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-400"
                    : "border-red-400/20 bg-red-400/[0.05] text-red-400"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    obsConnected
                      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.7)]"
                      : "bg-red-400"
                  }`}
                />
                OBS {obsConnected ? "Ready" : "Offline"}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-zinc-600 transition hover:border-white/20 hover:text-white"
                title="Close"
                aria-label="Close OBS overlay links"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[7px] font-black uppercase tracking-[0.13em] text-zinc-700">
            <span className="text-zinc-500">{matchName}</span>
            <span>•</span>
            <span>{matchGame}</span>
            <span>•</span>
            <span>{matchMap}</span>
            <span>•</span>
            <span className="text-yellow-500/70">
              Theme: {selectedTheme.name}
            </span>
          </div>
        </div>

        {/* CONTENT */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {/* SINGLE THEME BOX */}
          <section className="overflow-hidden rounded-2xl border border-yellow-500/15 bg-[#0c0f12]">
            <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-yellow-500/15 bg-yellow-500/[0.05] text-yellow-400">
                  <Sparkles size={15} />
                </div>

                <div>
                  <p className="text-[7px] font-black uppercase tracking-[0.19em] text-yellow-500/75">
                    Broadcast Theme
                  </p>
                  <h3 className="mt-0.5 text-[12px] font-black uppercase tracking-[0.04em] text-zinc-200">
                    Select one theme
                  </h3>
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <p className="text-right text-[6px] font-black uppercase tracking-[0.13em] text-zinc-700">
                  Active
                </p>
                <p className="mt-0.5 text-right text-[8px] font-black uppercase tracking-[0.08em] text-yellow-400">
                  {selectedTheme.name}
                </p>
              </div>
            </div>

            <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4 sm:p-4">
              {OBS_OVERLAY_THEMES.map((item) => {
                const active = item.name === theme;

                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => onThemeChange(item.name)}
                    className={`group relative overflow-hidden rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-yellow-400/45 bg-yellow-500/[0.085] shadow-[0_0_28px_rgba(231,173,46,.06)]"
                        : "border-white/[0.07] bg-white/[0.018] hover:border-yellow-500/25 hover:bg-yellow-500/[0.035]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[8px] font-black uppercase tracking-[0.10em] ${
                          active
                            ? "text-yellow-400"
                            : "text-zinc-400"
                        }`}
                      >
                        {item.name}
                      </span>

                      {active && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-black">
                          <Check size={11} />
                        </span>
                      )}
                    </div>

                    <p className="mt-1.5 text-[7px] leading-3.5 text-zinc-600">
                      {item.description}
                    </p>

                    <p
                      className={`mt-2 text-[6px] font-black uppercase tracking-[0.12em] ${
                        active
                          ? "text-yellow-500/70"
                          : "text-zinc-800"
                      }`}
                    >
                      {item.tone}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* INDEPENDENT OVERLAYS */}
          <section className="mt-4">
            <div className="mb-3 flex items-end justify-between gap-4 px-1">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-yellow-400 shadow-[0_0_9px_rgba(231,173,46,.7)]" />
                  <h3 className="text-[11px] font-black uppercase tracking-[0.08em] text-zinc-200">
                    Independent Overlays
                  </h3>
                </div>

                <p className="mt-1 text-[8px] text-zinc-700">
                  Add only the graphics you need as separate OBS Browser Sources.
                </p>
              </div>

              <span className="shrink-0 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[6px] font-black uppercase tracking-[0.12em] text-zinc-700">
                {overlayLinks.length} Sources
              </span>
            </div>

            <div className="grid gap-2.5 lg:grid-cols-2">
              {overlayLinks.map((overlay) => (
                <OverlayLinkRow
                  key={overlay.type}
                  icon={overlay.icon}
                  title={overlay.title}
                  description={overlay.description}
                  theme={theme}
                  url={overlay.url}
                  copied={copied === overlay.type}
                  onCopy={() =>
                    copyLink(
                      overlay.type,
                      overlay.url
                    )
                  }
                  onOpen={() =>
                    overlay.url &&
                    window.open(
                      overlay.url,
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                />
              ))}
            </div>
          </section>

          {/* OBS INSTRUCTIONS */}
          <section className="mt-4 rounded-2xl border border-white/[0.06] bg-[#0b0e11] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-zinc-500">
                  <SlidersHorizontal size={14} />
                </div>

                <div className="min-w-0">
                  <p className="text-[7px] font-black uppercase tracking-[0.18em] text-zinc-700">
                    OBS Setup
                  </p>

                  <p className="mt-1 text-[8px] leading-4 text-zinc-600">
                    Copy a source URL, then add it in OBS as a Browser Source.
                    Keep the source transparent and use the required canvas size.
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[7px] font-mono text-zinc-700">
                  1920 × 1080
                </span>

                <span className="rounded-lg border border-yellow-500/10 bg-yellow-500/[0.03] px-2.5 py-2 text-[7px] font-black uppercase tracking-[0.12em] text-yellow-500/55">
                  OBS Ready
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* FOOTER */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-white/[0.07] bg-black/20 px-5 py-3.5 sm:px-6">
          <div>
            <p className="text-[7px] font-black uppercase tracking-[0.16em] text-zinc-700">
              Independent sources
            </p>
            <p className="mt-0.5 text-[7px] text-zinc-800">
              All URLs update with the selected theme.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/[0.08] px-4 py-2.5 text-[8px] font-black uppercase tracking-[0.13em] text-yellow-400 transition hover:border-yellow-400/50 hover:bg-yellow-500/[0.12]"
          >
            <Check size={12} />
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| MATCH HEADER
|--------------------------------------------------------------------------
*/

function MatchHeader({
  match,
  results,
  onBack,
  onRefresh,
  onCalibrate,
  onOBS,
  onStart,
  onPause,
  onEnd,
  onResume,
  matchActionLoading,
}) {
  const totalTeams = results.length;
  const aliveTeams = results.filter((team) => !isEliminated(team)).length;
  const eliminatedTeams = results.filter((team) => isEliminated(team)).length;
  const totalKills = results.reduce((sum, team) => sum + getKills(team), 0);
  const totalPlayers = results.reduce((sum, team) => sum + getPlayers(team).length, 0);
  const alivePlayers = results.reduce((sum, team) => sum + getAlivePlayerCount(team), 0);
  const status = getMatchStatus(match);

  const statItems = [
    { icon: Users, value: totalTeams, label: "Teams" },
    { icon: Check, value: aliveTeams, label: "Alive" },
    { icon: Users, value: `${alivePlayers}/${totalPlayers}`, label: "Players" },
    { icon: X, value: eliminatedTeams, label: "Out", type: "orange" },
    { icon: Star, value: totalKills, label: "Kills", type: "yellow" },
  ];

  const isCompleted = ["COMPLETED", "ENDED", "FINISHED"].includes(status);
  const isPaused = status === "PAUSED";
  const isLive = ["LIVE", "ONGOING", "IN_PROGRESS", "STARTED"].includes(status);

  return (
    <header className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0e10]">
      <div className="relative px-5 py-5">
        <div className="absolute left-0 top-0 h-full w-[3px] bg-yellow-400" />

        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-500 transition hover:border-yellow-500/30 hover:text-yellow-400"
              title="Back to match selection"
            >
              <ArrowLeft size={17} />
            </button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-md border border-red-500/25 bg-red-500/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.15em] text-red-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                  Live Production
                </span>
                <span className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-700">
                  {getRoundName(match)}
                </span>
              </div>

              <h1 className="mt-2 truncate text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
                {getMatchName(match)}
              </h1>

              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600">
                <span className="flex items-center gap-1.5">
                  <Gamepad2 size={11} />
                  {match?.game || "Battle Royale"}
                </span>
                <span>•</span>
                <span>{match?.map || "ERANGEL"}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {statItems.map((item) => (
                <TopStat
                  key={item.label}
                  icon={item.icon}
                  value={item.value}
                  label={item.label}
                  type={item.type || "green"}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <StatusBadge status={status} />

              {!isCompleted && (
                <>
                  {isPaused ? (
                    <>
                      <button
                        type="button"
                        onClick={onResume}
                        disabled={matchActionLoading}
                        className="flex h-10 items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3.5 text-[9px] font-black uppercase tracking-wider text-emerald-400 transition hover:bg-emerald-500/15 disabled:opacity-40"
                      >
                        {matchActionLoading ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                        Resume
                      </button>
                      <button
                        type="button"
                        onClick={onEnd}
                        disabled={matchActionLoading}
                        className="flex h-10 items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 text-[9px] font-black uppercase tracking-wider text-red-400 transition hover:bg-red-500/15 disabled:opacity-40"
                      >
                        <Square size={12} />
                        End
                      </button>
                    </>
                  ) : isLive ? (
                    <>
                      <button
                        type="button"
                        onClick={onPause}
                        disabled={matchActionLoading}
                        className="flex h-10 items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3.5 text-[9px] font-black uppercase tracking-wider text-orange-400 transition hover:bg-orange-500/15 disabled:opacity-40"
                      >
                        {matchActionLoading ? <RefreshCw size={13} className="animate-spin" /> : <Pause size={13} />}
                        Pause
                      </button>
                      <button
                        type="button"
                        onClick={onEnd}
                        disabled={matchActionLoading}
                        className="flex h-10 items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 text-[9px] font-black uppercase tracking-wider text-red-400 transition hover:bg-red-500/15 disabled:opacity-40"
                      >
                        <Square size={12} />
                        End
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={onStart}
                      disabled={matchActionLoading}
                      className="flex h-10 items-center gap-2 rounded-xl border border-yellow-400/40 bg-yellow-400/10 px-4 text-[9px] font-black uppercase tracking-wider text-yellow-300 transition hover:bg-yellow-400/15 disabled:opacity-40"
                    >
                      {matchActionLoading ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                      Start Match
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={onRefresh}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-500 transition hover:border-yellow-500/30 hover:text-yellow-400"
                title="Refresh"
              >
                <RefreshCw size={14} />
              </button>

              <button
                type="button"
                onClick={onCalibrate}
                className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-[9px] font-black uppercase tracking-wider text-zinc-500 transition hover:border-yellow-500/30 hover:text-yellow-400"
              >
                <SlidersHorizontal size={13} />
                Calibrate
              </button>

              <button
                type="button"
                onClick={onOBS}
                className="flex h-10 items-center gap-2 rounded-xl border border-yellow-500/35 bg-yellow-500/10 px-3.5 text-[9px] font-black uppercase tracking-wider text-yellow-400 transition hover:bg-yellow-500/15"
              >
                <Radio size={13} />
                OBS & Overlays
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/*
|--------------------------------------------------------------------------
| CALIBRATION
|--------------------------------------------------------------------------
*/

function CalibrationModal({
  open,
  onClose,
}) {
  const [
    options,
    setOptions,
  ] = useState({
    showcase: false,
    ranking: false,
    final4: false,
    sequence: false,
    elimination: false,
    winner: false,
    results: false,
    standings: false,
  });

  if (!open) {
    return null;
  }

  const items = [
    [
      "showcase",
      "Playing Squads Showcase",
    ],
    [
      "ranking",
      "Live Match Ranking",
    ],
    [
      "final4",
      "Final 4 Teams",
    ],
    [
      "sequence",
      "30S Match Sequence",
    ],
    [
      "elimination",
      "Team Elimination Alert",
    ],
    [
      "winner",
      "Match Winner Screen",
    ],
    [
      "results",
      "Match Results Table",
    ],
    [
      "standings",
      "Overall Standings",
    ],
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-[540px] overflow-hidden rounded-2xl border border-yellow-500/30 bg-[#0f1012] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <SlidersHorizontal
              size={20}
              className="text-yellow-400"
            />

            <h2 className="text-xl font-black uppercase text-white">
              OBS Calibration
            </h2>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="text-zinc-500 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mx-6 mt-5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-xs leading-5 text-yellow-400">
          Toggle overlays ON to freeze them
          on screen for OBS alignment.
        </div>

        <div className="space-y-1 px-6 py-5">
          {items.map(
            ([id, label]) => {
              const active =
                options[id];

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    setOptions(
                      (
                        current
                      ) => ({
                        ...current,
                        [id]:
                          !current[
                            id
                          ],
                      })
                    )
                  }
                  className="flex w-full items-center justify-between rounded-xl px-2 py-3 text-left transition hover:bg-white/[0.04]"
                >
                  <span className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
                    {label}
                  </span>

                  <span
                    className={`flex h-9 w-14 items-center rounded-full border p-1 transition ${
                      active
                        ? "border-emerald-400 bg-emerald-500/20"
                        : "border-zinc-600 bg-zinc-800"
                    }`}
                  >
                    <span
                      className={`h-7 w-7 rounded-full transition ${
                        active
                          ? "translate-x-5 bg-emerald-400"
                          : "bg-zinc-400"
                      }`}
                    />
                  </span>
                </button>
              );
            }
          )}
        </div>

        <div className="flex justify-end border-t border-white/10 px-6 py-5">
          <button
            type="button"
            onClick={
              onClose
            }
            className="flex items-center gap-2 bg-emerald-400 px-6 py-3 text-sm font-black uppercase text-black"
          >
            <Check
              size={16}
            />

            End Calibration
          </button>
        </div>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| SIDEBAR
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| PRODUCTION SIDEBAR — OBS + ESSENTIAL MATCH INFORMATION
|--------------------------------------------------------------------------
*/

function ProductionSidebar({
  results,
  obsConnected,
  onToggleAutomation,
  automation,
  matchId,
  match,
  onOBS,
  overlayTheme,
}) {
  const aliveTeams = results.filter((team) => !isEliminated(team)).length;
  const totalKills = results.reduce((sum, team) => sum + getKills(team), 0);
  const alivePlayers = results.reduce((sum, team) => sum + getAlivePlayerCount(team), 0);
  const totalPlayers = results.reduce((sum, team) => sum + getPlayers(team).length, 0);

  const leader = [...results].sort((a, b) => getPoints(b) - getPoints(a))[0];

  const overlayLinks = [
    { label: "Live Ranking", type: "live-ranking", icon: Activity },
    { label: "Elimination Alert", type: "elimination", icon: X },
    { label: "Playing Squads", type: "showcase", icon: Users },
    { label: "Match Winner", type: "winner", icon: Trophy },
    { label: "Match Results", type: "results", icon: Trophy },
    { label: "Overall Standings", type: "standings", icon: Star },
  ];

  const copyOverlay = async (type) => {
    const url = createOverlayUrl(type, matchId, { theme: overlayTheme });
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch (error) {
      console.error("MWOPS - Failed to copy overlay link:", error);
    }
  };

  return (
    <aside className="space-y-4">
      {/* OBS / OVERLAYS */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0e10]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-yellow-500/25 bg-yellow-500/10 text-yellow-400">
              <Radio size={15} />
            </div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-zinc-600">
                Broadcast
              </p>
              <h2 className="text-sm font-black uppercase text-white">
                OBS & Overlays
              </h2>
            </div>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[7px] font-black uppercase tracking-wider ${
              obsConnected
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                : "border-red-500/25 bg-red-500/10 text-red-400"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${obsConnected ? "bg-emerald-400" : "bg-red-400"}`} />
            {obsConnected ? "Connected" : "Offline"}
          </div>
        </div>

        <div className="border-b border-white/10 px-3 py-3">
          <div className="flex items-center justify-between rounded-xl border border-yellow-500/10 bg-yellow-500/[0.025] px-3 py-2.5">
            <span className="text-[7px] font-black uppercase tracking-[0.14em] text-zinc-700">
              Active Theme
            </span>
            <span className="text-[7px] font-black uppercase tracking-[0.12em] text-yellow-400">
              {overlayTheme}
            </span>
          </div>
        </div>

        <div className="space-y-1 p-3">
          {overlayLinks.map((item) => {
            const Icon = item.icon;
            const url = createOverlayUrl(item.type, matchId, { theme: overlayTheme });

            return (
              <div
                key={item.type}
                className="flex items-center gap-2 rounded-xl border border-transparent bg-white/[0.02] px-2.5 py-2.5 transition hover:border-yellow-500/15 hover:bg-yellow-500/[0.03]"
              >
                <Icon size={13} className="shrink-0 text-yellow-400" />
                <span className="min-w-0 flex-1 truncate text-[9px] font-black uppercase tracking-wider text-zinc-400">
                  {item.label}
                </span>
                <button
                  type="button"
                  onClick={() => copyOverlay(item.type)}
                  disabled={!url}
                  title="Copy overlay link"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 text-zinc-600 transition hover:border-yellow-500/25 hover:text-yellow-400 disabled:opacity-30"
                >
                  <Copy size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}
                  disabled={!url}
                  title="Open overlay"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 text-zinc-600 transition hover:border-yellow-500/25 hover:text-yellow-400 disabled:opacity-30"
                >
                  <ExternalLink size={11} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={onOBS}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-3 text-[9px] font-black uppercase tracking-wider text-yellow-400 transition hover:bg-yellow-500/15"
          >
            <SlidersHorizontal size={12} />
            Manage OBS & All Overlays
          </button>
        </div>
      </section>

      {/* QUICK STATS */}
      <section className="rounded-2xl border border-white/10 bg-[#0d0e10] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-300">
            Match Snapshot
          </h2>
          <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-700">
            Live
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatBox icon={Users} value={aliveTeams} label="Teams Alive" />
          <StatBox icon={Users} value={`${alivePlayers}/${totalPlayers}`} label="Players" />
          <StatBox icon={Star} value={totalKills} label="Kills" type="yellow" />
          <StatBox
            icon={Trophy}
            value={leader ? getTeamName(leader) : "—"}
            label="Leader"
            text
          />
        </div>
      </section>

      {/* AUTOMATION */}
      <section className="rounded-2xl border border-white/10 bg-[#0d0e10] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={14} className="text-yellow-400" />
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-300">
              Smart Automation
            </h2>
            <p className="mt-0.5 text-[8px] text-zinc-700">
              Optional production assists
            </p>
          </div>
        </div>

        <AutomationToggle
          label="Auto-Show Final 4"
          description="Swaps live ranking to Final Teams at ≤4 alive."
          enabled={automation.final4}
          onClick={() => onToggleAutomation("final4")}
        />

        <AutomationToggle
          label="Auto-End Match"
          description="Sets winner and ends match when 1 team remains."
          enabled={automation.autoEnd}
          onClick={() => onToggleAutomation("autoEnd")}
        />
      </section>
    </aside>
  );
}

function AutomationToggle({
  label,
  description,
  enabled,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className="mb-3 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left transition hover:border-white/20"
    >
      <div className="pr-3">
        <p className="text-sm font-black text-zinc-300">
          {label}
        </p>

        <p className="mt-1 text-[10px] leading-4 text-zinc-600">
          {description}
        </p>
      </div>

      <span
        className={`flex h-9 w-14 shrink-0 items-center rounded-full border p-1 ${
          enabled
            ? "border-emerald-400 bg-emerald-500/20"
            : "border-zinc-600 bg-zinc-800"
        }`}
      >
        <span
          className={`h-7 w-7 rounded-full transition ${
            enabled
              ? "translate-x-5 bg-emerald-400"
              : "bg-zinc-400"
          }`}
        />
      </span>
    </button>
  );
}

function StatBox({
  icon: Icon,
  value,
  label,
  type = "green",
  text = false,
}) {
  const color =
    type === "yellow"
      ? "text-yellow-400"
      : type === "red"
        ? "text-red-400"
        : "text-emerald-400";

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div
        className={`flex items-center gap-2 ${color}`}
      >
        <Icon size={15} />

        <span
          className={`font-black ${
            text
              ? "text-sm"
              : "text-2xl"
          }`}
        >
          {value}
        </span>
      </div>

      <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600">
        {label}
      </p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| MAIN CONTROL ROOM
|--------------------------------------------------------------------------
*/

function ControlRoom() {
  const navigate =
    useNavigate();

  const [
    searchParams,
  ] = useSearchParams();

  /*
  |--------------------------------------------------------------------------
  | DATA
  |--------------------------------------------------------------------------
  */

  const [
    tournaments,
    setTournaments,
  ] = useState([]);

  const [
    matches,
    setMatches,
  ] = useState([]);

  /*
  |--------------------------------------------------------------------------
  | MATCH LIST REF
  |--------------------------------------------------------------------------
  |
  | Keep the latest match list outside the polling callback dependency chain.
  | If fetchControlRoom depends directly on `matches`, every successful poll
  | recreates the callback, which recreates the polling effects and can cause
  | the Control Room to repeatedly enter loading state and disappear.
  |--------------------------------------------------------------------------
  */

  const matchesRef = useRef([]);

  const [
    selectedTournamentId,
    setSelectedTournamentId,
  ] = useState("");

  const [
    selectedRound,
    setSelectedRound,
  ] = useState(
    "Round 1"
  );

  const [
    selectedMatchId,
    setSelectedMatchId,
  ] = useState("");

  const [
    match,
    setMatch,
  ] = useState(null);

  const [
    results,
    setResults,
  ] = useState([]);

  /*
  |--------------------------------------------------------------------------
  | UI
  |--------------------------------------------------------------------------
  */

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    matchLoading,
    setMatchLoading,
  ] = useState(false);

  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);

  const [
    playerLoading,
    setPlayerLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    filter,
    setFilter,
  ] = useState(
    "ALL"
  );

  const [
    calibrationOpen,
    setCalibrationOpen,
  ] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | OBS STATE
  |--------------------------------------------------------------------------
  */

  const [
    obsConnected,
    setObsConnected,
  ] = useState(false);

  const [
    obsOpen,
    setObsOpen,
  ] = useState(false);

  const [
    overlayTheme,
    setOverlayTheme,
  ] = useState(
    () =>
      localStorage.getItem(
        "mwops_overlay_theme"
      ) || "MWOPS DARK"
  );

  useEffect(() => {
    localStorage.setItem(
      "mwops_overlay_theme",
      overlayTheme
    );
  }, [overlayTheme]);

  const [
    automation,
    setAutomation,
  ] = useState({
    final4: false,
    autoEnd: false,
  });

  /*
  |--------------------------------------------------------------------------
  | MATCH LIFECYCLE MUTATION STATE
  |--------------------------------------------------------------------------
  |
  | Match actions use optimistic UI updates so START / PAUSE / RESUME / END
  | are visible immediately. The backend remains the source of truth and is
  | re-read after the mutation completes.
  |--------------------------------------------------------------------------
  */

  const [
    matchActionLoading,
    setMatchActionLoading,
  ] = useState(false);

  const [, setMatchAction] =
    useState("");

  const matchMutationRef =
    useRef(false);

  /*
  |--------------------------------------------------------------------------
  | LOAD TOURNAMENTS
  |--------------------------------------------------------------------------
  */

  const loadTournaments =
    useCallback(
      async () => {
        const response =
          await fetch(
            `${API_URL}/tournaments`,
            {
              headers: {
                Accept:
                  "application/json",
              },
              cache:
                "no-store",
            }
          );

        const payload =
          await parseResponse(
            response
          );

        return normalizeArray(
          unwrapResponse(
            payload
          )
        );
      },
      []
    );

  /*
  |--------------------------------------------------------------------------
  | LOAD MATCHES
  |--------------------------------------------------------------------------
  */

  const loadMatches =
    useCallback(
      async () => {
        const response =
          await fetch(
            `${API_URL}/matches`,
            {
              headers: {
                Accept:
                  "application/json",
              },
              cache:
                "no-store",
            }
          );

        const payload =
          await parseResponse(
            response
          );

        return normalizeArray(
          unwrapResponse(
            payload
          )
        );
      },
      []
    );

  /*
  |--------------------------------------------------------------------------
  | INITIAL DATA
  |--------------------------------------------------------------------------
  */

  const loadProductionData =
    useCallback(
      async () => {
        try {
          setLoading(true);
          setError("");

          const [
            tournamentData,
            matchData,
          ] =
            await Promise.all([
              loadTournaments(),
              loadMatches(),
            ]);

          setTournaments(
            tournamentData
          );

          matchesRef.current =
            matchData;

          setMatches(
            matchData
          );

          const urlMatchId =
            searchParams.get(
              "matchId"
            ) ||
            searchParams.get(
              "match"
            );

          const urlMatch =
            urlMatchId
              ? matchData.find(
                  (item) =>
                    String(
                      item.id
                    ) ===
                    String(
                      urlMatchId
                    )
                )
              : null;

          const firstMatch =
            urlMatch ||
            matchData[0];

          /*
          |--------------------------------------------------------------------------
          | IMPORTANT:
          | Render the selected match from /matches immediately.
          |
          | The Control Room state endpoint is a live-data endpoint. If that
          | request is briefly unavailable, the production console must NOT
          | disappear and show "Select a Live Match" when a valid match was
          | already selected.
          |--------------------------------------------------------------------------
          */

          if (firstMatch) {
            setMatch(
              firstMatch
            );

            setResults(
              buildFallbackTeamResults(
                firstMatch
              )
            );

            setSelectedMatchId(
              firstMatch.id
            );

            setSelectedRound(
              getRoundName(
                firstMatch
              )
            );

            const tournamentId =
              firstMatch?.tournament_id ||
              firstMatch?.tournamentId ||
              firstMatch?.tournament?.id;

            if (
              tournamentId
            ) {
              setSelectedTournamentId(
                tournamentId
              );
            }
          }
        } catch (err) {
          console.error(
            "MWOPS - Failed to load production data:",
            err
          );

          setError(
            err.message ||
              "Unable to load production data."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        loadTournaments,
        loadMatches,
        searchParams,
      ]
    );

  useEffect(() => {
    loadProductionData();
  }, [
    loadProductionData,
  ]);

  /*
  |--------------------------------------------------------------------------
  | FETCH CONTROL ROOM
  |--------------------------------------------------------------------------
  |
  | silent=true is used by the background sync loop. It updates the live
  | state without showing the full-page loading state on every tick.
  |
  |--------------------------------------------------------------------------
  */

  const controlRoomRequestRef =
    useRef(null);

  const mountedRef =
    useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;

      if (
        controlRoomRequestRef.current
      ) {
        controlRoomRequestRef.current.abort();
      }
    };
  }, []);

  const fetchControlRoom =
    useCallback(
      async (
        requestedMatchId,
        options = {}
      ) => {
        const {
          silent = false,
        } = options;

        if (
          !requestedMatchId
        ) {
          if (
            mountedRef.current
          ) {
            setMatch(null);
            setResults([]);
          }

          return;
        }

        const latestMatches =
          matchesRef.current;

        const fallbackMatch =
          findMatchById(
            latestMatches,
            requestedMatchId
          );

        /*
        |--------------------------------------------------------------------------
        | IMPORTANT:
        | Keep the match visible even before the live Control Room request
        | completes. This prevents the whole production UI from collapsing
        | into the empty "Select a Live Match" state during a transient API
        | failure or while the backend request is starting.
        |--------------------------------------------------------------------------
        */

        if (
          fallbackMatch &&
          mountedRef.current
        ) {
          setMatch(
            (current) =>
              current ||
              fallbackMatch
          );
        }

        if (
          controlRoomRequestRef.current
        ) {
          return;
        }

        const controller =
          new AbortController();

        controlRoomRequestRef.current =
          controller;

        const timeoutId =
          window.setTimeout(
            () => {
              controller.abort();
            },
            CONTROL_ROOM_REQUEST_TIMEOUT
          );

        try {
          if (
            !silent &&
            mountedRef.current
          ) {
            setMatchLoading(
              true
            );
            setError("");
          }

          const url =
            `${API_URL}/control-room/${encodeURIComponent(
              requestedMatchId
            )}?_mwops_ts=${Date.now()}`;

          const response =
            await fetch(
              url,
              {
                method: "GET",
                headers: {
                  Accept:
                    "application/json",
                  "Cache-Control":
                    "no-cache",
                },
                cache:
                  "no-store",
                signal:
                  controller.signal,
              }
            );

          const payload =
            await parseResponse(
              response
            );

          const data =
            unwrapResponse(
              payload
            );

          if (
            !data ||
            typeof data !==
              "object"
          ) {
            throw new Error(
              "Control Room returned an invalid response."
            );
          }

          if (
            !mountedRef.current
          ) {
            return;
          }

          const resolvedMatch =
            data.match ||
            findMatchById(
              matches,
              requestedMatchId
            ) ||
            fallbackMatch;

          setMatch(
            resolvedMatch ||
              null
          );

          if (resolvedMatch) {
            matchesRef.current =
              matchesRef.current.map(
                (item) =>
                  String(item?.id || "") ===
                  String(requestedMatchId)
                    ? {
                        ...item,
                        ...resolvedMatch,
                      }
                    : item
              );

            setMatches(
              matchesRef.current
            );
          }

          let teamResults =
            Array.isArray(
              data.results
            )
              ? data.results
              : Array.isArray(
                    data.team_stats
                  )
                ? data.team_stats
                : Array.isArray(
                      data.teamStats
                    )
                  ? data.teamStats
                  : [];

          if (
            teamResults.length ===
              0
          ) {
            teamResults =
              buildFallbackTeamResults(
                resolvedMatch
              );
          }

          teamResults =
            teamResults.map(
              (team) => {
                const players =
                  getPlayers(
                    team
                  ).map(
                    (
                      player
                    ) => ({
                      ...player,

                      player_id:
                        player?.player_id ||
                        player?.player?.id ||
                        player?.players?.id ||
                        null,

                      gamer_tag:
                        player?.gamer_tag ||
                        player?.player?.gamer_tag ||
                        player?.players?.gamer_tag ||
                        player?.real_name ||
                        "Player",

                      is_alive:
                        player?.is_alive !==
                          false,
                    })
                  );

                return {
                  ...team,

                  team_id:
                    getTeamId(
                      team
                    ),

                  team_name:
                    getTeamName(
                      team
                    ),

                  team_tag:
                    getTeamTag(
                      team
                    ),

                  kills:
                    getKills(
                      team
                    ),

                  points:
                    getPoints(
                      team
                    ),

                  players,
                };
              }
            );

          setResults(
            teamResults
          );

          /*
          |--------------------------------------------------------------------------
          | A SUCCESSFUL BACKGROUND SYNC CLEARS ONLY A LIVE-SYNC ERROR
          |--------------------------------------------------------------------------
          */

          if (
            silent
          ) {
            setError(
              (current) =>
                current.startsWith(
                  "Live sync:"
                )
                  ? ""
                  : current
            );
          }
        } catch (err) {
          if (
            err?.name ===
            "AbortError"
          ) {
            return;
          }

          console.error(
            "MWOPS - Failed to load Control Room:",
            err
          );

          /*
          |--------------------------------------------------------------------------
          | NEVER BLANK A LIVE PRODUCTION SCREEN BECAUSE OF A TEMPORARY
          | BACKGROUND NETWORK FAILURE.
          |--------------------------------------------------------------------------
          */

          if (
            silent &&
            mountedRef.current
          ) {
            setError(
              `Live sync: ${
                err.message ||
                "temporary connection problem"
              }`
            );
          } else if (
            mountedRef.current
          ) {
            setError(
              err.message ||
                "Unable to load Control Room."
            );

            /*
            |--------------------------------------------------------------------------
            | Do NOT clear match/results here.
            |
            | A valid selected match is already known from /matches. Keeping
            | that state visible is essential for a production control room.
            | The next background sync will replace fallback data with the
            | authoritative Control Room state as soon as the API is reachable.
            |--------------------------------------------------------------------------
            */

            if (
              fallbackMatch
            ) {
              setMatch(
                (current) =>
                  current ||
                  fallbackMatch
              );

              setResults(
                (current) =>
                  current.length
                    ? current
                    : buildFallbackTeamResults(
                        fallbackMatch
                      )
              );
            }
          }
        } finally {
          window.clearTimeout(
            timeoutId
          );

          if (
            controlRoomRequestRef.current ===
            controller
          ) {
            controlRoomRequestRef.current =
              null;
          }

          if (
            !silent &&
            mountedRef.current
          ) {
            setMatchLoading(
              false
            );
          }
        }
      },
      []
    );

  /*
  |--------------------------------------------------------------------------
    | INITIAL MATCH LOAD
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      selectedMatchId
    ) {
      fetchControlRoom(
        selectedMatchId
      );
    }
  }, [
    selectedMatchId,
    fetchControlRoom,
  ]);

  /*
  |--------------------------------------------------------------------------
  | LIVE CONTROL ROOM BACKGROUND SYNC
  |--------------------------------------------------------------------------
  |
  | This is the frontend fallback transport until the backend receives a
  | push-based realtime channel.
  |
  | Flow:
  |
  | Control Room action
  |       ↓
  | Backend / Database
  |       ↓
  | 750ms background sync
  |       ↓
  | Control Room + OBS overlays
  |
  | The OBS overlays independently read the same authoritative backend
  | state, so a successful mutation becomes visible in OBS automatically.
  |
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      !selectedMatchId
    ) {
      return undefined;
    }

    let active = true;

    const sync = () => {
      if (
        !active ||
        document.hidden ||
        matchMutationRef.current
      ) {
        return;
      }

      fetchControlRoom(
        selectedMatchId,
        {
          silent: true,
        }
      );
    };

    const intervalId =
      window.setInterval(
        sync,
        CONTROL_ROOM_SYNC_INTERVAL
      );

    const handleVisibility =
      () => {
        if (
          !document.hidden
        ) {
          sync();
        }
      };

    const handleFocus =
      () => {
        sync();
      };

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    window.addEventListener(
      "focus",
      handleFocus
    );

    sync();

    return () => {
      active = false;

      window.clearInterval(
        intervalId
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
  }, [
    selectedMatchId,
    fetchControlRoom,
  ]);

  /*
  |--------------------------------------------------------------------------
  | OBS
  |--------------------------------------------------------------------------
  */

  const checkOBS =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              `${API_URL}/obs`,
              {
                headers: {
                  Accept:
                    "application/json",
                },
                cache:
                  "no-store",
              }
            );

          const payload =
            await parseResponse(
              response
            );

          const data =
            unwrapResponse(
              payload
            );

          setObsConnected(
            Boolean(
              data?.connected
            )
          );
        } catch {
          setObsConnected(
            false
          );
        }
      },
      []
    );

  useEffect(() => {
    checkOBS();
  }, [
    checkOBS,
  ]);

  /*
  |--------------------------------------------------------------------------
  | MATCH SELECTION
  |--------------------------------------------------------------------------
  */

  function handleTournamentChange(
    value
  ) {
    setSelectedTournamentId(
      value
    );

    setSelectedMatchId(
      ""
    );

    setMatch(null);
    setResults([]);

    const firstMatch =
      matches.find(
        (item) => {
          const tournamentId =
            item?.tournament_id ||
            item?.tournamentId ||
            item?.tournament?.id;

          return (
            !value ||
            String(
              tournamentId ||
                ""
            ) ===
              String(value)
          );
        }
      );

    if (firstMatch) {
      setSelectedRound(
        getRoundName(
          firstMatch
        )
      );

      setSelectedMatchId(
        firstMatch.id
      );
    }
  }

  function handleRoundChange(
    value
  ) {
    setSelectedRound(
      value
    );

    setSelectedMatchId(
      ""
    );

    setMatch(null);
    setResults([]);

    const firstMatch =
      matches.find(
        (item) => {
          const tournamentId =
            item?.tournament_id ||
            item?.tournamentId ||
            item?.tournament?.id;

          return (
            (!selectedTournamentId ||
              String(
                tournamentId ||
                  ""
              ) ===
                String(
                  selectedTournamentId
                )) &&
            getRoundName(
              item
            ) === value
          );
        }
      );

    if (firstMatch) {
      setSelectedMatchId(
        firstMatch.id
      );
    }
  }

  function handleMatchChange(
    value
  ) {
    setSelectedMatchId(
      value
    );

    setMatch(null);
    setResults([]);

    if (!value) {
      return;
    }

    const selected =
      matches.find(
        (item) =>
          String(
            item.id
          ) ===
          String(value)
      );

    if (selected) {
      setSelectedRound(
        getRoundName(
          selected
        )
      );

      const tournamentId =
        selected?.tournament_id ||
        selected?.tournamentId ||
        selected?.tournament?.id;

      if (
        tournamentId
      ) {
        setSelectedTournamentId(
          tournamentId
        );
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | MATCH LIFECYCLE
  |--------------------------------------------------------------------------
  |
  | Supported backend contract:
  |
  | POST /api/matches/:matchId/start
  | POST /api/matches/:matchId/pause
  | POST /api/matches/:matchId/resume
  | POST /api/matches/:matchId/end
  |
  | The UI changes immediately and then reconciles with the backend.
  |--------------------------------------------------------------------------
  */

  const cancelLiveRequest =
    useCallback(() => {
      if (
        controlRoomRequestRef.current
      ) {
        controlRoomRequestRef.current.abort();
        controlRoomRequestRef.current = null;
      }
    }, []);

  const updateLocalMatchStatus =
    useCallback(
      (nextStatus, serverMatch = null) => {
        if (!selectedMatchId) {
          return;
        }

        const resolved =
          serverMatch &&
          typeof serverMatch === "object"
            ? serverMatch
            : null;

        setMatch((current) => ({
          ...(current || {}),
          ...(resolved || {}),
          id:
            resolved?.id ||
            current?.id ||
            selectedMatchId,
          status:
            resolved?.status ||
            resolved?.state ||
            nextStatus,
          state:
            resolved?.state ||
            nextStatus,
        }));

        matchesRef.current =
          matchesRef.current.map(
            (item) =>
              String(item?.id || "") ===
              String(selectedMatchId)
                ? {
                    ...item,
                    ...(resolved || {}),
                    status:
                      resolved?.status ||
                      resolved?.state ||
                      nextStatus,
                    state:
                      resolved?.state ||
                      nextStatus,
                  }
                : item
          );

        setMatches(
          matchesRef.current
        );
      },
      [selectedMatchId]
    );

  const runMatchLifecycleAction =
    useCallback(
      async (action) => {
        if (
          !selectedMatchId ||
          matchActionLoading
        ) {
          return;
        }

        const normalizedAction =
          String(action || "")
            .trim()
            .toLowerCase();

        const nextStatus =
          normalizedAction === "start"
            ? "LIVE"
            : normalizedAction === "pause"
              ? "PAUSED"
              : normalizedAction === "resume"
                ? "LIVE"
                : "COMPLETED";

        /*
        |--------------------------------------------------------------------------
        | Optimistic update FIRST.
        | The operator should see the state change immediately.
        |--------------------------------------------------------------------------
        */

        matchMutationRef.current = true;
        cancelLiveRequest();

        setMatchAction(
          normalizedAction
        );
        setMatchActionLoading(true);
        setError("");

        updateLocalMatchStatus(
          nextStatus
        );

        try {
          const response =
            await fetch(
              `${API_URL}/matches/${encodeURIComponent(
                selectedMatchId
              )}/${normalizedAction}`,
              {
                method: "POST",
                headers: {
                  Accept:
                    "application/json",
                  "Content-Type":
                    "application/json",
                },
                cache: "no-store",
              }
            );

          const payload =
            await parseResponse(
              response
            );

          const data =
            unwrapResponse(
              payload
            );

          /*
          |--------------------------------------------------------------------------
          | Accept common response shapes:
          | { match: {...} }
          | { data: { match: {...} } }
          | { ...match }
          |--------------------------------------------------------------------------
          */

          const serverMatch =
            data?.match ||
            data?.data?.match ||
            (
              data &&
              typeof data === "object" &&
              (
                data.id ||
                data.status ||
                data.state
              )
                ? data
                : null
            );

          if (serverMatch) {
            updateLocalMatchStatus(
              nextStatus,
              serverMatch
            );
          }

          /*
          |--------------------------------------------------------------------------
          | Reconcile with the authoritative Control Room state.
          |--------------------------------------------------------------------------
          */

          matchMutationRef.current = false;

          await fetchControlRoom(
            selectedMatchId
          );
        } catch (err) {
          console.error(
            `MWOPS - Failed to ${normalizedAction} match:`,
            err
          );

          /*
          |--------------------------------------------------------------------------
          | Roll back optimistic state on failure.
          | The authoritative state is requested again so the UI never gets
          | stuck in a fake LIVE / PAUSED / COMPLETED state.
          |--------------------------------------------------------------------------
          */

          matchMutationRef.current = false;

          setError(
            err.message ||
              `Failed to ${normalizedAction} match.`
          );

          await fetchControlRoom(
            selectedMatchId
          );
        } finally {
          matchMutationRef.current = false;
          setMatchActionLoading(
            false
          );
          setMatchAction("");
        }
      },
      [
        selectedMatchId,
        matchActionLoading,
        cancelLiveRequest,
        updateLocalMatchStatus,
        fetchControlRoom,
      ]
    );

  async function startMatch() {
    await runMatchLifecycleAction(
      "start"
    );
  }

  async function pauseMatch() {
    await runMatchLifecycleAction(
      "pause"
    );
  }

  async function resumeMatch() {
    await runMatchLifecycleAction(
      "resume"
    );
  }

  async function endMatch() {
    await runMatchLifecycleAction(
      "end"
    );
  }

  /*
  |--------------------------------------------------------------------------
  | UPDATE TEAM
  |--------------------------------------------------------------------------
  */

  async function updateTeam(
    team,
    payload
  ) {
    const teamId =
      getTeamId(team);

    if (
      !selectedMatchId ||
      !teamId
    ) {
      return;
    }

    try {
      setActionLoading(
        true
      );

      setError("");

      const response =
        await fetch(
          `${API_URL}/control-room/${encodeURIComponent(
            selectedMatchId
          )}/team/${encodeURIComponent(
            teamId
          )}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body: JSON.stringify(
              payload
            ),

            cache:
              "no-store",
          }
        );

      await parseResponse(
        response
      );

      await fetchControlRoom(
        selectedMatchId
      );
    } catch (err) {
      console.error(
        "MWOPS - Failed to update team:",
        err
      );

      setError(
        err.message ||
          "Failed to update team."
      );
    } finally {
      setActionLoading(
        false
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | ADD KILL
  |--------------------------------------------------------------------------
  */

  async function addKill(
    team
  ) {
    const teamId =
      getTeamId(team);

    if (
      !selectedMatchId ||
      !teamId
    ) {
      return;
    }

    try {
      matchMutationRef.current = true;

      setActionLoading(
        true
      );

      setError("");

      const currentKills =
        getKills(team);

      const currentPoints =
        getPoints(team);

      /*
      |--------------------------------------------------------------------------
      | Optimistic score update.
      |--------------------------------------------------------------------------
      */

      setResults((current) =>
        current.map((item) => {
          if (
            String(
              getTeamId(item) || ""
            ) !==
            String(teamId)
          ) {
            return item;
          }

          const nextKills =
            currentKills + 1;

          const nextItem = {
            ...item,
            kills: nextKills,
          };

          /*
          | If points are currently derived 1:1 from kills, keep that visual
          | value instant as well. Otherwise the backend remains responsible
          | for the authoritative points calculation.
          */
          if (
            currentPoints === currentKills
          ) {
            nextItem.points =
              currentPoints + 1;
          }

          return nextItem;
        })
      );

      const url =
        `${API_URL}/control-room/${encodeURIComponent(
          selectedMatchId
        )}/team/${encodeURIComponent(
          teamId
        )}/kill`;

      const response =
        await fetch(
          url,
          {
            method: "POST",

            headers: {
              Accept:
                "application/json",
            },

            cache:
              "no-store",
          }
        );

      await parseResponse(
        response
      );

      matchMutationRef.current = false;

      await fetchControlRoom(
        selectedMatchId
      );
    } catch (err) {
      console.error(
        "MWOPS - Failed to add kill:",
        err
      );

      setError(
        err.message ||
          "Failed to add kill."
      );
    } finally {
      matchMutationRef.current = false;

      setActionLoading(
        false
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | REMOVE KILL
  |--------------------------------------------------------------------------
  */

  async function removeKill(
    team
  ) {
    const teamId =
      getTeamId(team);

    if (
      !selectedMatchId ||
      !teamId
    ) {
      return;
    }

    if (
      getKills(team) <=
      0
    ) {
      return;
    }

    try {
      matchMutationRef.current = true;

      setActionLoading(
        true
      );

      setError("");

      const currentKills =
        getKills(team);

      const currentPoints =
        getPoints(team);

      /*
      |--------------------------------------------------------------------------
      | Optimistic score update.
      |--------------------------------------------------------------------------
      */

      setResults((current) =>
        current.map((item) => {
          if (
            String(
              getTeamId(item) || ""
            ) !==
            String(teamId)
          ) {
            return item;
          }

          const nextKills =
            Math.max(
              0,
              currentKills - 1
            );

          const nextItem = {
            ...item,
            kills: nextKills,
          };

          if (
            currentPoints === currentKills &&
            currentPoints > 0
          ) {
            nextItem.points =
              currentPoints - 1;
          }

          return nextItem;
        })
      );

      const url =
        `${API_URL}/control-room/${encodeURIComponent(
          selectedMatchId
        )}/team/${encodeURIComponent(
          teamId
        )}/kill`;

      const response =
        await fetch(
          url,
          {
            method: "DELETE",

            headers: {
              Accept:
                "application/json",
            },

            cache:
              "no-store",
          }
        );

      await parseResponse(
        response
      );

      matchMutationRef.current = false;

      await fetchControlRoom(
        selectedMatchId
      );
    } catch (err) {
      console.error(
        "MWOPS - Failed to remove kill:",
        err
      );

      setError(
        err.message ||
          "Failed to remove kill."
      );
    } finally {
      matchMutationRef.current = false;

      setActionLoading(
        false
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | PLAYER ALIVE / ELIMINATED
  |--------------------------------------------------------------------------
  */

  async function togglePlayer(
    team,
    player
  ) {
    const playerId =
      getPlayerId(
        player
      );

    if (
      !selectedMatchId
    ) {
      return;
    }

    if (!playerId) {
      console.error(
        "MWOPS - PLAYER ID MISSING:",
        player
      );

      setError(
        `Player ID is missing for ${getPlayerName(
          player
        )}.`
      );

      return;
    }

    const currentlyAlive =
      isPlayerAlive(
        player
      );

    const nextAlive =
      !currentlyAlive;

    try {
      matchMutationRef.current = true;

      setPlayerLoading(
        true
      );

      setError("");

      /*
      |--------------------------------------------------------------------------
      | Optimistic player state update.
      | This makes the player dot, player count and team status change
      | immediately while the backend request is in flight.
      |--------------------------------------------------------------------------
      */

      setResults((current) =>
        current.map((item) => {
          if (
            String(
              getTeamId(item) || ""
            ) !==
            String(
              getTeamId(team) || ""
            )
          ) {
            return item;
          }

          return {
            ...item,
            players:
              getPlayers(item).map(
                (itemPlayer) =>
                  String(
                    getPlayerId(
                      itemPlayer
                    ) || ""
                  ) ===
                  String(
                    playerId
                  )
                    ? {
                        ...itemPlayer,
                        is_alive:
                          Boolean(
                            nextAlive
                          ),
                        alive:
                          Boolean(
                            nextAlive
                          ),
                      }
                    : itemPlayer
              ),
          };
        })
      );

      const url =
        `${API_URL}/control-room/${encodeURIComponent(
          selectedMatchId
        )}/player/${encodeURIComponent(
          playerId
        )}/alive`;

      console.log(
        "MWOPS - PLAYER ALIVE UPDATE:",
        {
          url,
          matchId:
            selectedMatchId,
          teamId:
            getTeamId(
              team
            ),
          playerId,
          assignmentId:
            getPlayerAssignmentId(
              player
            ),
          previousAlive:
            currentlyAlive,
          nextAlive,
        }
      );

      const response =
        await fetch(
          url,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body: JSON.stringify({
              alive:
                Boolean(
                  nextAlive
                ),
            }),

            cache:
              "no-store",
          }
        );

      await parseResponse(
        response
      );

      matchMutationRef.current = false;

      await fetchControlRoom(
        selectedMatchId
      );
    } catch (err) {
      console.error(
        "MWOPS - Failed to update player:",
        err
      );

      setError(
        err.message ||
          "Failed to update player state."
      );
    } finally {
      matchMutationRef.current = false;

      setPlayerLoading(
        false
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | SEARCH / FILTER
  |--------------------------------------------------------------------------
  */

  const filteredResults =
    useMemo(() => {
      let list =
        [...results];

      if (
        filter ===
        "ALIVE"
      ) {
        list =
          list.filter(
            (team) =>
              !isEliminated(
                team
              )
          );
      }

      if (
        filter ===
        "OUT"
      ) {
        list =
          list.filter(
            (team) =>
              isEliminated(
                team
              )
          );
      }

      const query =
        search
          .trim()
          .toLowerCase();

      if (query) {
        list =
          list.filter(
            (team) =>
              getTeamName(
                team
              )
                .toLowerCase()
                .includes(
                  query
                ) ||
              getTeamTag(
                team
              )
                .toLowerCase()
                .includes(
                  query
                ) ||
              getPlayers(
                team
              ).some(
                (player) =>
                  getPlayerName(
                    player
                  )
                    .toLowerCase()
                    .includes(
                      query
                    )
              )
          );
      }

      return list.sort(
        (a, b) => {
          const placementA =
            getPlacement(a);

          const placementB =
            getPlacement(b);

          if (
            placementA &&
            placementB
          ) {
            return (
              placementA -
              placementB
            );
          }

          if (
            placementA
          ) {
            return -1;
          }

          if (
            placementB
          ) {
            return 1;
          }

          return (
            getSlot(
              a,
              999
            ) -
            getSlot(
              b,
              999
            )
          );
        }
      );
    }, [
      results,
      filter,
      search,
    ]);

  /*
  |--------------------------------------------------------------------------
  | AUTOMATION
  |--------------------------------------------------------------------------
  */

  function toggleAutomation(
    key
  ) {
    setAutomation(
      (current) => ({
        ...current,
        [key]:
          !current[key],
      })
    );
  }

  /*
  |--------------------------------------------------------------------------
  | REFRESH
  |--------------------------------------------------------------------------
  */

  async function refresh() {
    if (
      matchMutationRef.current
    ) {
      return;
    }

    if (
      selectedMatchId
    ) {
      await fetchControlRoom(
        selectedMatchId
      );
    } else {
      await loadProductionData();
    }

    await checkOBS();
  }

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <div className="min-h-screen bg-[#070708] text-white [background-image:radial-gradient(circle_at_top_right,rgba(234,179,8,0.06),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(234,179,8,0.035),transparent_28%)]">
      {/* TOP NAV */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080809]/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[76px] max-w-[1680px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-400">
              <Radio
                size={19}
              />
            </div>

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.28em] text-yellow-400">
                MWOPS
              </p>

              <h1 className="text-lg font-black text-white">
                Live Match Control
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                navigate(
                  "/dashboard"
                )
              }
              className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-bold text-zinc-400 transition hover:text-white sm:flex"
            >
              <ArrowLeft
                size={14}
              />

              Dashboard
            </button>

            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.15em] text-red-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />

              Production
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1680px] px-5 py-7 lg:px-8">
        {/* TITLE */}
        <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
              <p className="text-[8px] font-black uppercase tracking-[0.22em] text-yellow-400">
                Live Match Operations
              </p>
            </div>
            <h2 className="mt-1.5 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
              Control Room
            </h2>
          </div>

          <p className="max-w-xl text-left text-[10px] leading-5 text-zinc-600 lg:text-right">
            Update eliminations and kills, control match state and manage broadcast overlays from one production console.
          </p>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4">
            <div className="flex gap-3">
              <Circle
                size={15}
                className="mt-0.5 fill-red-500 text-red-500"
              />

              <div>
                <p className="text-sm font-black text-red-300">
                  Control Room Error
                </p>

                <p className="mt-1 text-xs text-red-400">
                  {error}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="text-[10px] font-black uppercase tracking-wider text-red-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* MATCH SELECTOR */}
        <MatchSelector
          tournaments={
            tournaments
          }
          matches={
            matches
          }
          selectedTournamentId={
            selectedTournamentId
          }
          selectedRound={
            selectedRound
          }
          selectedMatchId={
            selectedMatchId
          }
          onTournamentChange={
            handleTournamentChange
          }
          onRoundChange={
            handleRoundChange
          }
          onMatchChange={
            handleMatchChange
          }
          onRefresh={
            loadProductionData
          }
          loading={
            loading
          }
        />

        {/* LOADING */}
        {(loading ||
          matchLoading) &&
          !match && (
            <div className="flex min-h-[500px] items-center justify-center rounded-2xl border border-white/10 bg-[#0d0d0e]">
              <div className="text-center">
                <RefreshCw
                  size={30}
                  className="mx-auto animate-spin text-yellow-400"
                />

                <p className="mt-4 text-sm font-black text-zinc-400">
                  Opening live match...
                </p>

                <p className="mt-1 text-xs text-zinc-700">
                  Loading production state.
                </p>
              </div>
            </div>
          )}

        {/* NO MATCH */}
        {!loading &&
          !matchLoading &&
          !match && (
            <div className="flex min-h-[500px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#0d0d0e] text-center">
              <Radio
                size={34}
                className="text-yellow-400"
              />

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-yellow-400">
                Production Control
              </p>

              <h2 className="mt-2 text-2xl font-black text-white">
                Select a Live Match
              </h2>

              <p className="mt-2 max-w-md text-sm text-zinc-600">
                Choose a tournament, round and
                match above to open the control
                room.
              </p>
            </div>
          )}

        {/* LIVE CONTROL */}
        {match && (
            <>
              <MatchHeader
                match={match}
                results={
                  results
                }
                onBack={() => {
                  setSelectedMatchId(
                    ""
                  );

                  setMatch(
                    null
                  );

                  setResults(
                    []
                  );

                  setObsOpen(
                    false
                  );
                }}
                onRefresh={
                  refresh
                }
                onStart={
                  startMatch
                }
                onPause={
                  pauseMatch
                }
                onResume={
                  resumeMatch
                }
                onEnd={
                  endMatch
                }
                matchActionLoading={
                  matchActionLoading
                }
                onCalibrate={() =>
                  setCalibrationOpen(
                    true
                  )
                }
                onOBS={() =>
                  setObsOpen(
                    true
                  )
                }
              />

              {/* TEAM TOOLBAR */}
              <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0c0d0f] p-3 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3">
                  <Search size={15} className="shrink-0 text-zinc-600" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search team or player..."
                    className="h-11 min-w-0 flex-1 bg-transparent text-xs font-semibold text-white outline-none placeholder:text-zinc-700"
                  />
                </div>

                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
                  {[
                    { id: "ALL", label: "All" },
                    { id: "ALIVE", label: "Alive" },
                    { id: "OUT", label: "Out" },
                  ].map((item) => {
                    const active = filter === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setFilter(item.id)}
                        className={`rounded-lg px-3.5 py-2.5 text-[8px] font-black uppercase tracking-wider transition ${
                          active
                            ? "bg-yellow-400 text-black"
                            : "text-zinc-600 hover:text-zinc-300"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-3.5 py-2">
                    <span className="text-sm font-black text-emerald-400">
                      {results.filter((team) => !isEliminated(team)).length}
                    </span>
                    <span className="ml-1.5 text-[7px] font-black uppercase tracking-wider text-zinc-700">
                      Teams
                    </span>
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-3.5 py-2">
                    <span className="text-sm font-black text-emerald-400">
                      {results.reduce((sum, team) => sum + getAlivePlayerCount(team), 0)}
                    </span>
                    <span className="ml-1.5 text-[7px] font-black uppercase tracking-wider text-zinc-700">
                      Players
                    </span>
                  </div>

                  <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.04] px-3.5 py-2">
                    <span className="text-sm font-black text-yellow-400">
                      {results.reduce((sum, team) => sum + getKills(team), 0)}
                    </span>
                    <span className="ml-1.5 text-[7px] font-black uppercase tracking-wider text-zinc-700">
                      Kills
                    </span>
                  </div>
                </div>
              </div>

              {/* CONTENT */}
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
                <section className="min-w-0 space-y-3">
                  {filteredResults.length ===
                  0 ? (
                    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#0d0d0e]">
                      <Users
                        size={32}
                        className="text-zinc-700"
                      />

                      <p className="mt-4 text-sm font-black text-zinc-500">
                        No teams found
                      </p>

                      <p className="mt-1 text-xs text-zinc-700">
                        Try another search or
                        filter.
                      </p>
                    </div>
                  ) : (
                    filteredResults.map(
                      (
                        team,
                        index
                      ) => (
                        <TeamCard
                          key={
                            getTeamId(
                              team
                            ) ||
                            team.id ||
                            `team-${index}`
                          }
                          team={
                            team
                          }
                          rank={
                            index +
                            1
                          }
                          onAddKill={
                            addKill
                          }
                          onRemoveKill={
                            removeKill
                          }
                          onTogglePlayer={(
                            player
                          ) =>
                            togglePlayer(
                              team,
                              player
                            )
                          }
                          actionLoading={
                            actionLoading
                          }
                          playerLoading={
                            playerLoading
                          }
                        />
                      )
                    )
                  )}
                </section>

                <ProductionSidebar
                  results={results}
                  obsConnected={obsConnected}
                  automation={automation}
                  onToggleAutomation={toggleAutomation}
                  matchId={selectedMatchId}
                  match={match}
                  onOBS={() => setObsOpen(true)}
                  overlayTheme={overlayTheme}
                />
              </div>
            </>
          )}

        <footer className="mt-8 border-t border-white/10 py-6 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-700">
          MWOPS · Live Match Operations ·
          Production Control Console
        </footer>
      </main>

      {/* CALIBRATION */}
      <CalibrationModal
        open={
          calibrationOpen
        }
        onClose={() =>
          setCalibrationOpen(
            false
          )
        }
      />

      {/* OBS */}
      <OBSOverlayModal
        open={
          obsOpen
        }
        onClose={() =>
          setObsOpen(
            false
          )
        }
        matchId={
          selectedMatchId
        }
        match={
          match
        }
        obsConnected={
          obsConnected
        }
        theme={
          overlayTheme
        }
        onThemeChange={
          setOverlayTheme
        }
      />
    </div>
  );
}

export default ControlRoom;