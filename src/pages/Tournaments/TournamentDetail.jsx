/*
|--------------------------------------------------------------------------
| MWOPS TOURNAMENT CONTROL
|--------------------------------------------------------------------------
|
| Tournament management workspace.
|
| Flow:
|
| Tournaments
|     ↓
| Manage Tournament
|     ↓
| Tournament Control
|     ├── Rounds
|     ├── Teams
|     ├── Standings
|     └── Settings
|
| IMPORTANT
|--------------------------------------------------------------------------
| - No date UI is used anywhere on this page.
| - Rounds are stored in the dedicated `rounds` table.
| - Matches remain loaded from the existing matches endpoint.
|
|--------------------------------------------------------------------------
*/

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  Download,
  Gamepad2,
  Layers3,
  List,
  Loader2,
  MonitorPlay,
  Plus,
  RefreshCw,
  Settings,
  Save,
  Share2,
  Shield,
  Trophy,
  Trash2,
  Users,
  X,
} from "lucide-react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

/*
|--------------------------------------------------------------------------
| API CONFIGURATION
|--------------------------------------------------------------------------
*/

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

/*
|--------------------------------------------------------------------------
| API HELPER
|--------------------------------------------------------------------------
*/

function unwrapResponse(payload) {
  if (
    payload &&
    typeof payload === "object"
  ) {
    if (
      payload.data !== undefined
    ) {
      return payload.data;
    }

    if (
      payload.result !== undefined
    ) {
      return payload.result;
    }
  }

  return payload;
}

async function request(
  endpoint,
  options = {}
) {
  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      method:
        options.method || "GET",

      headers: {
        Accept:
          "application/json",

        ...(options.body
          ? {
              "Content-Type":
                "application/json",
            }
          : {}),
      },

      body:
        options.body !== undefined
          ? JSON.stringify(
              options.body
            )
          : undefined,

      cache: "no-store",
    }
  );

  let payload = null;

  try {
    payload =
      await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      payload?.message ||
        payload?.error?.message ||
        payload?.error ||
        payload?.data?.message ||
        `Request failed with status ${response.status}`
    );
  }

  return unwrapResponse(
    payload
  );
}


/*
|--------------------------------------------------------------------------
| PREMIUM GAME VISUALS
|--------------------------------------------------------------------------
*/

const GAME_VISUALS = {
  "PUBG Mobile":
    "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1600&q=85",
  "BGMI":
    "https://images.unsplash.com/photo-1560253023-3ec5d502959f?auto=format&fit=crop&w=1600&q=85",
  "Free Fire":
    "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1600&q=85",
  "Valorant":
    "https://images.unsplash.com/photo-1547394765-185e1e68f34e?auto=format&fit=crop&w=1600&q=85",
  "Call of Duty Mobile":
    "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=1600&q=85",
  default:
    "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1600&q=85",
};

function getGameVisual(game) {
  const key = String(game || "").trim();
  return GAME_VISUALS[key] || GAME_VISUALS.default;
}

/*
|--------------------------------------------------------------------------
| STATUS CONFIGURATION
|--------------------------------------------------------------------------
*/

const STATUS_CONFIG = {
  draft: {
    label: "DRAFT",
    dot: "bg-[#92979d]",
    text: "text-[#92979d]",
    border:
      "border-[#6f7479]/30",
    background:
      "bg-[#6f7479]/10",
  },

  upcoming: {
    label: "UPCOMING",
    dot: "bg-[#f2b632]",
    text: "text-[#f2b632]",
    border:
      "border-[#f2b632]/30",
    background:
      "bg-[#f2b632]/10",
  },

  ongoing: {
    label: "ONGOING",
    dot: "bg-[#e7ad2e]",
    text: "text-[#e7ad2e]",
    border:
      "border-[#e7ad2e]/30",
    background:
      "bg-[#e7ad2e]/10",
  },

  live: {
    label: "LIVE",
    dot: "bg-[#ff3b3b]",
    text: "text-[#ff5555]",
    border:
      "border-[#ff3b3b]/30",
    background:
      "bg-[#ff3b3b]/10",
  },

  completed: {
    label: "COMPLETED",
    dot: "bg-[#92979d]",
    text: "text-[#92979d]",
    border:
      "border-[#6f7479]/30",
    background:
      "bg-[#6f7479]/10",
  },
};

function StatusBadge({
  status,
}) {
  const normalized =
    String(
      status || "draft"
    ).toLowerCase();

  const config =
    STATUS_CONFIG[
      normalized
    ] ||
    STATUS_CONFIG.draft;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] ${config.border} ${config.background} ${config.text}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${config.dot}`}
      />

      {config.label}
    </span>
  );
}

/*
|--------------------------------------------------------------------------
| MATCH ROUND HELPERS
|--------------------------------------------------------------------------
|
| Matches may not yet contain a round_id.
|
| We support the existing possible fields:
|
| - round
| - round_name
| - round_number
| - round_id
|
|--------------------------------------------------------------------------
*/

function getMatchRoundId(
  match
) {
  if (
    match?.round_id
  ) {
    return String(
      match.round_id
    );
  }

  if (
    match?.round?.id
  ) {
    return String(
      match.round.id
    );
  }

  return null;
}

function getMatchRoundName(
  match
) {
  if (
    match?.round_name !==
      undefined &&
    match?.round_name !== null &&
    String(
      match.round_name
    ).trim() !== ""
  ) {
    return String(
      match.round_name
    );
  }

  if (
    typeof match?.round ===
      "string" &&
    match.round.trim() !== ""
  ) {
    return match.round;
  }

  if (
    typeof match?.round ===
      "object" &&
    match.round?.name
  ) {
    return String(
      match.round.name
    );
  }

  if (
    match?.round_number !==
      undefined &&
    match?.round_number !== null
  ) {
    return `Round ${match.round_number}`;
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| ROUND STATE
|--------------------------------------------------------------------------
*/

function getRoundState(
  matches
) {
  if (!matches.length) {
    return {
      label: "PENDING",
      type: "pending",
    };
  }

  const normalized =
    matches.map(
      (match) =>
        String(
          match.status || ""
        ).toLowerCase()
    );

  if (
    normalized.includes("live")
  ) {
    return {
      label: "LIVE",
      type: "live",
    };
  }

  if (
    normalized.includes(
      "ongoing"
    )
  ) {
    return {
      label: "ONGOING",
      type: "ongoing",
    };
  }

  if (
    normalized.every(
      (status) =>
        status ===
          "completed" ||
        status === "ended"
    )
  ) {
    return {
      label: "COMPLETED",
      type: "completed",
    };
  }

  return {
    label: "PENDING",
    type: "pending",
  };
}

/*
|--------------------------------------------------------------------------
| NEW ROUND MODAL
|--------------------------------------------------------------------------
*/

function NewRoundModal({
  open,
  name,
  setName,
  onClose,
  onSubmit,
  saving,
  error,
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          if (!saving) {
            onClose();
          }
        }
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#2b332f] bg-[#0c1110] shadow-[0_25px_100px_rgba(0,0,0,0.65)]">

        {/* HEADER */}

        <div className="flex items-start justify-between border-b border-[#252d2a] px-6 py-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e7ad2e]/10 text-[#e7ad2e]">
                <Layers3
                  size={19}
                />
              </div>

              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[0.17em] text-[#e7ad2e]">
                  Tournament Structure
                </p>

                <h2 className="mt-1 text-lg font-extrabold text-white">
                  New Round
                </h2>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#2b332f] text-[#69736e] transition hover:border-[#e7ad2e]/30 hover:text-white disabled:opacity-50"
          >
            <X
              size={17}
            />
          </button>
        </div>

        {/* BODY */}

        <form
          onSubmit={onSubmit}
          className="p-6"
        >
          <label
            htmlFor="round-name"
            className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#79837d]"
          >
            Round Name
          </label>

          <input
            id="round-name"
            type="text"
            value={name}
            onChange={(event) =>
              setName(
                event.target.value
              )
            }
            placeholder="e.g. Rising Blood"
            autoFocus
            disabled={saving}
            className="mt-3 w-full rounded-xl border border-[#303934] bg-[#070908] px-4 py-3.5 text-sm font-bold text-white outline-none placeholder:text-[#414944] focus:border-[#e7ad2e]/60 focus:ring-1 focus:ring-[#e7ad2e]/20 disabled:opacity-60"
          />

          <p className="mt-2 text-xs leading-5 text-[#59635e]">
            Give this competition stage a clear
            operational name. Dates are not
            required.
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-[#ff3b3b]/30 bg-[#ff3b3b]/10 px-4 py-3 text-xs font-bold leading-5 text-[#ff7777]">
              {error}
            </div>
          )}

          {/* ACTIONS */}

          <div className="mt-7 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-[#303934] bg-[#151a18] px-5 py-3 text-xs font-extrabold uppercase tracking-[0.06em] text-[#858e89] transition hover:border-[#424b46] hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                !name.trim()
              }
              className="inline-flex items-center gap-2 rounded-xl bg-[#e7ad2e] px-5 py-3 text-xs font-extrabold uppercase tracking-[0.06em] text-[#151107] transition hover:bg-[#ffc94b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2
                  size={15}
                  className="animate-spin"
                />
              ) : (
                <Plus
                  size={15}
                />
              )}

              {saving
                ? "Creating..."
                : "Create Round"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| ROUND CARD
|--------------------------------------------------------------------------
*/

function getMatchVisual(match, fallbackVisual) {
  return (
    match?.image_url ||
    match?.thumbnail_url ||
    match?.banner_url ||
    match?.cover_url ||
    fallbackVisual
  );
}

function getMatchTitle(match, index) {
  return (
    match?.name ||
    match?.match_name ||
    match?.title ||
    `Match ${index + 1}`
  );
}

function getMatchMap(match) {
  return (
    match?.map ||
    match?.map_name ||
    match?.mapName ||
    "Map not set"
  );
}

function getMatchStatusLabel(match) {
  const value = String(match?.status || "scheduled").toLowerCase();
  if (value === "live") return "LIVE";
  if (value === "paused" || value === "pause") return "PAUSED";
  if (value === "completed" || value === "ended" || value === "finished") return "ENDED";
  return "SCHEDULED";
}

function RoundCard({
  round,
  index,
  visual,
  onViewMatches,
  onStandings,
  onAddMatch,
  onDeleteRound,
  onDeleteMatch,
  deletingRoundId,
  deletingMatchId,
  onSettings,
  onShare,
  onDownload,
}) {
  const state = getRoundState(round.matches);
  const matchCount = round.matches.length;

  const stateStyles = {
    live: {
      badge: "border-[#ff3b3b]/40 bg-[#ff3b3b]/10 text-[#ff5555]",
      icon: "bg-[#ff3b3b]/10 text-[#ff5555]",
    },
    ongoing: {
      badge: "border-[#e7ad2e]/40 bg-[#e7ad2e]/10 text-[#e7ad2e]",
      icon: "bg-[#e7ad2e]/10 text-[#e7ad2e]",
    },
    completed: {
      badge: "border-[#6f7479]/40 bg-[#6f7479]/10 text-[#92979d]",
      icon: "bg-[#6f7479]/10 text-[#92979d]",
    },
    pending: {
      badge: "border-[#6f7479]/40 bg-[#6f7479]/10 text-[#92979d]",
      icon: "bg-[#6f7479]/10 text-[#92979d]",
    },
  };

  const styles = stateStyles[state.type] || stateStyles.pending;

  return (
    <article className="group relative overflow-hidden rounded-[6px] border border-white/[0.09] bg-[#0d1115] shadow-[0_20px_60px_rgba(0,0,0,.28)] transition duration-300 hover:-translate-y-[2px] hover:border-[#e7ad2e]/40">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(231,173,46,.11),transparent_35%),linear-gradient(135deg,rgba(255,255,255,.025),transparent_38%)]" />

      {/* ROUND VISUAL */}
      <div className="relative h-[150px] overflow-hidden border-b border-white/[0.08]">
        <img
          src={visual}
          alt=""
          className="h-full w-full object-cover opacity-55 transition duration-700 group-hover:scale-[1.045] group-hover:opacity-70"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,9,11,.97)_0%,rgba(7,9,11,.72)_44%,rgba(7,9,11,.22)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(7,9,11,.94)_0%,transparent_55%)]" />
        <div className="absolute left-6 top-5 flex items-center gap-2">
          <span className="h-[2px] w-8 bg-[#e7ad2e] shadow-[0_0_14px_rgba(231,173,46,.55)]" />
          <span className="text-[8px] font-black uppercase tracking-[.22em] text-[#c0c3be]">Competition Stage</span>
        </div>
        <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[9px] font-black tracking-[.22em] text-[#e7ad2e]">STAGE {String(index + 1).padStart(2, "0")}</div>
            <div className="mt-1 text-[11px] font-black uppercase tracking-[.18em] text-white/75">{round.name}</div>
          </div>
          <span className={`rounded-[3px] border px-3 py-1.5 text-[8px] font-black uppercase tracking-[.16em] ${styles.badge}`}>
            {state.label}
          </span>
        </div>
      </div>

      <div className="relative p-6 lg:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[4px] border border-white/[0.08] ${styles.icon}`}>
              <Layers3 size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] font-black tracking-[.16em] text-[#e7ad2e]">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-[8px] font-black uppercase tracking-[.18em] text-[#515a60]">ROUND</span>
              </div>
              <h3 className="mwops-display mt-1 truncate text-2xl text-white sm:text-3xl">{round.name}</h3>
              <p className="mt-2 text-xs font-semibold text-[#69737a]">{matchCount} {matchCount === 1 ? "match" : "matches"} in this stage</p>
            </div>
          </div>

          <button
            type="button"
            title="Delete round"
            onClick={() => onDeleteRound(round)}
            disabled={deletingRoundId === String(round.id)}
            className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-[4px] border border-red-400/15 bg-red-400/[0.035] px-3 text-[8px] font-black uppercase tracking-[.14em] text-red-300/70 transition hover:border-red-400/35 hover:bg-red-400/[0.08] hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deletingRoundId === String(round.id) ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Delete Round
          </button>
        </div>

        {/* MATCH VISUAL GRID */}
        <div className="mt-7 border-t border-white/[0.07] pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[.2em] text-[#e7ad2e]">Stage Matches</p>
              <p className="mt-1 text-[10px] text-[#525b61]">Individual production slots</p>
            </div>
            <span className="font-mono text-[9px] font-bold text-[#697178]">{String(matchCount).padStart(2, "0")} SLOTS</span>
          </div>

          {matchCount > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {round.matches.map((match, matchIndex) => {
                const matchId = match?.id || match?.match_id;
                const matchStatus = getMatchStatusLabel(match);
                const matchVisual = getMatchVisual(match, visual);
                const isLive = matchStatus === "LIVE";
                return (
                  <div key={matchId || `${round.id}-match-${matchIndex}`} className="group/match relative overflow-hidden rounded-[5px] border border-white/[0.08] bg-[#090d11] transition duration-300 hover:border-[#e7ad2e]/35 hover:shadow-[0_14px_35px_rgba(0,0,0,.25)]">
                    <div className="relative h-[92px] overflow-hidden">
                      <img src={matchVisual} alt="" className="h-full w-full object-cover opacity-45 transition duration-500 group-hover/match:scale-[1.06] group-hover/match:opacity-60" />
                      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,9,12,.96),rgba(6,9,12,.48),rgba(6,9,12,.24))]" />
                      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(6,9,12,.9),transparent)]" />
                      <div className="absolute left-3 top-3 flex items-center gap-2">
                        <span className="font-mono text-[8px] font-black tracking-[.15em] text-[#e7ad2e]">M{String(matchIndex + 1).padStart(2, "0")}</span>
                        <span className="h-1 w-1 rounded-full bg-white/25" />
                        <span className={`text-[7px] font-black uppercase tracking-[.12em] ${isLive ? "text-[#ff5555]" : "text-white/60"}`}>{matchStatus}</span>
                      </div>
                      <button
                        type="button"
                        title="Delete match"
                        onClick={() => onDeleteMatch(match, round)}
                        disabled={!matchId || deletingMatchId === String(matchId)}
                        className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-[4px] border border-red-400/20 bg-black/45 text-red-300/80 backdrop-blur-sm transition hover:border-red-400/45 hover:bg-red-400/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {deletingMatchId === String(matchId) ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                    <div className="p-3.5">
                      <div className="truncate text-[11px] font-black uppercase tracking-[.05em] text-white">{getMatchTitle(match, matchIndex)}</div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="truncate text-[8px] font-bold uppercase tracking-[.12em] text-[#5d676e]">{getMatchMap(match)}</span>
                        <span className="shrink-0 font-mono text-[8px] text-[#424b52]">#{String(matchIndex + 1).padStart(2, "0")}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[5px] border border-dashed border-white/[0.08] bg-white/[0.012] px-5 py-6 text-center">
              <Gamepad2 size={19} className="mx-auto text-[#3e474d]" />
              <p className="mt-2 text-[9px] font-black uppercase tracking-[.16em] text-[#555f65]">No matches assigned</p>
              <p className="mt-1 text-[9px] text-[#3d454b]">Use Add Match to create the next production slot.</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-5">
          <button type="button" onClick={() => onViewMatches(round)} className="inline-flex items-center gap-2 rounded-[4px] border border-[#e7ad2e]/35 bg-[#e7ad2e]/[0.055] px-4 py-2.5 text-[8px] font-black uppercase tracking-[.13em] text-[#e7ad2e] transition hover:bg-[#e7ad2e]/[0.11]"><List size={13} /> View Matches</button>
          <button type="button" onClick={() => onStandings(round)} className="inline-flex items-center gap-2 rounded-[4px] border border-white/[0.08] bg-white/[0.025] px-4 py-2.5 text-[8px] font-black uppercase tracking-[.13em] text-[#92999e] transition hover:border-[#e7ad2e]/25 hover:text-white"><BarChart3 size={13} /> Standings</button>
          <button type="button" onClick={() => onAddMatch(round)} className="inline-flex items-center gap-2 rounded-[4px] bg-[#e7ad2e] px-4 py-2.5 text-[8px] font-black uppercase tracking-[.13em] text-[#151107] shadow-[0_8px_24px_rgba(231,173,46,.12)] transition hover:bg-[#ffc94b]"><Plus size={13} /> Add Match</button>
        </div>
      </div>
    </article>
  );
}

/*
|--------------------------------------------------------------------------
| EMPTY ROUNDS
|--------------------------------------------------------------------------
*/

function EmptyRounds({
  onNewRound,
}) {
  return (
    <div className="rounded-2xl border border-[#252d2a] bg-[#0b0f0d] px-6 py-16 text-center">

      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#e7ad2e]/20 bg-[#e7ad2e]/5 text-[#e7ad2e]">
        <Layers3
          size={28}
        />
      </div>

      <p className="mt-6 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#e7ad2e]">
        Tournament Structure
      </p>

      <h2 className="mwops-display mt-2 text-3xl text-white">
        NO ROUNDS CONFIGURED
      </h2>

      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#69736e]">
        Create the first round for this
        tournament to begin building its
        competitive structure.
      </p>

      <button
        type="button"
        onClick={onNewRound}
        className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#e7ad2e] px-6 py-3 text-xs font-extrabold uppercase tracking-[0.08em] text-[#151107] transition hover:bg-[#ffc94b]"
      >
        <Plus
          size={15}
        />

        New Round
      </button>
    </div>
  );
}


/*
|--------------------------------------------------------------------------
| TOURNAMENT SIDEBAR
|--------------------------------------------------------------------------
*/

function TournamentSidebar({
  activeTab,
  onTabChange,
  onBack,
  tournament,
  roundsCount,
  matchesCount,
}) {
  const items = [
    {
      id: "rounds",
      label: "Rounds",
      icon: Layers3,
      meta: roundsCount,
    },
    {
      id: "teams",
      label: "Teams",
      icon: Users,
    },
    {
      id: "standings",
      label: "Standings",
      icon: BarChart3,
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  return (
    <aside className="mwops-control-sidebar">
      <div className="mwops-sidebar-brand">
        <div className="mwops-sidebar-mark">M</div>
        <div>
          <div className="mwops-sidebar-name">MW<span>O</span>PS</div>
          <div className="mwops-sidebar-sub">MATCH WARFARE OPERATIONS</div>
        </div>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="mwops-sidebar-back"
      >
        <ArrowLeft size={14} />
        <span>Back to Tournaments</span>
      </button>

      <div className="mwops-sidebar-section-label">
        Tournament Workspace
      </div>

      <nav className="mwops-sidebar-nav" aria-label="Tournament workspace">
        {items.map(({ id, label, icon: Icon, meta }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={`mwops-sidebar-item ${activeTab === id ? "active" : ""}`}
          >
            <span className="mwops-sidebar-item-icon">
              <Icon size={17} />
            </span>
            <span className="mwops-sidebar-item-label">{label}</span>
            {meta !== undefined && (
              <span className="mwops-sidebar-count">{meta}</span>
            )}
            {activeTab === id && (
              <span className="mwops-sidebar-active-line" />
            )}
          </button>
        ))}
      </nav>

      <div className="mwops-sidebar-tournament">
        <div
          className="mwops-sidebar-tournament-image"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(7,9,11,.86), rgba(7,9,11,.35)), url("${getGameVisual(tournament?.game)}")`,
          }}
        >
          <div className="mwops-sidebar-tournament-copy">
            <span>{tournament?.game || "ESPORTS"}</span>
            <strong>{tournament?.name || "Tournament"}</strong>
          </div>
        </div>

        <div className="mwops-sidebar-mini-stats">
          <div>
            <strong>{roundsCount}</strong>
            <span>Rounds</span>
          </div>
          <div>
            <strong>{matchesCount}</strong>
            <span>Matches</span>
          </div>
        </div>
      </div>

      <div className="mwops-sidebar-footer">
        <span className="mwops-sidebar-online-dot" />
        <div>
          <strong>System Online</strong>
          <span>Operational control services</span>
        </div>
      </div>
    </aside>
  );
}

/*
|--------------------------------------------------------------------------
| TOP STAT CARD
|--------------------------------------------------------------------------
*/

function StatCard({
  icon: Icon,
  label,
  value,
  secondary,
  type,
  visual,
}) {
  const styles = {
    rounds: {
      border: "border-[#e7ad2e]/25",
      icon: "bg-[#e7ad2e]/10 text-[#f5c44b]",
      glow: "bg-[#e7ad2e]/5",
    },

    matches: {
      border: "border-[#e7ad2e]/25",
      icon: "bg-[#e7ad2e]/10 text-[#f5c44b]",
      glow: "bg-[#e7ad2e]/5",
    },

    status: {
      border:
        "border-[#e7ad2e]/30",
      icon:
        "bg-[#e7ad2e]/10 text-[#e7ad2e]",
      glow:
        "bg-[#e7ad2e]/5",
    },
  };

  const style =
    styles[type] ||
    styles.rounds;

  return (
    <div
      className={`group/stat relative overflow-hidden rounded-[5px] border bg-[#0c1110] p-6 ${style.border}`}
    >
      {visual && (
        <div className="pointer-events-none absolute inset-0 opacity-25 transition duration-500 group-hover/stat:opacity-35" style={{ backgroundImage: `linear-gradient(90deg,rgba(10,13,16,.97),rgba(10,13,16,.72),rgba(10,13,16,.38)), url("${visual}")`, backgroundSize: "cover", backgroundPosition: "center" }} />
      )}
      <div
        className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full blur-3xl ${style.glow}`}
      />

      <div className="relative flex items-start justify-between">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-xl ${style.icon}`}
        >
          <Icon
            size={25}
          />
        </div>

        <span className="rounded-full bg-[#191d1c] px-3 py-1.5 text-[9px] font-bold text-[#8a918e]">
          {secondary}
        </span>
      </div>

      <div className="relative mt-7">
        <p className="mwops-display text-4xl text-white lg:text-5xl">
          {value}
        </p>

        <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#7c8580]">
          {label}
        </p>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| ROUNDS PAGE
|--------------------------------------------------------------------------
*/

function RoundsPage({
  tournament,
  rounds,
  matches,
  onRefresh,
  loading,
  onNewRound,
  onViewMatches,
  onStandings,
  onAddMatch,
  onDeleteRound,
  onDeleteMatch,
  deletingRoundId,
  deletingMatchId,
  onSettings,
  onShare,
  onDownload,
}) {
  const roundsWithMatches =
    useMemo(() => {
      return rounds.map(
        (round) => {
          const roundId =
            String(
              round.id
            );

          const roundName =
            String(
              round.name || ""
            )
              .trim()
              .toLowerCase();

          const roundMatches =
            matches.filter(
              (match) => {
                const matchRoundId =
                  getMatchRoundId(
                    match
                  );

                if (
                  matchRoundId &&
                  matchRoundId ===
                    roundId
                ) {
                  return true;
                }

                const matchRoundName =
                  getMatchRoundName(
                    match
                  );

                if (
                  matchRoundName &&
                  String(
                    matchRoundName
                  )
                    .trim()
                    .toLowerCase() ===
                    roundName
                ) {
                  return true;
                }

                return false;
              }
            );

          return {
            ...round,
            matches:
              roundMatches,
          };
        }
      );
    }, [
      rounds,
      matches,
    ]);

  const activeRounds =
    roundsWithMatches.filter(
      (round) => {
        const state =
          getRoundState(
            round.matches
          );

        return (
          state.type ===
            "live" ||
          state.type ===
            "ongoing"
        );
      }
    ).length;

  const tournamentStatus =
    String(
      tournament?.status ||
        "draft"
    ).toLowerCase();

  return (
    <div className="mwops-rounds-page">

      {/* PREMIUM TOURNAMENT HERO */}

      <section
        className="mwops-control-hero"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(7,9,11,.98) 0%, rgba(7,9,11,.88) 43%, rgba(7,9,11,.46) 78%, rgba(7,9,11,.72) 100%), url("${getGameVisual(tournament?.game)}")`,
        }}
      >
        <div className="mwops-control-hero-grid" />
        <div className="mwops-control-hero-copy">
          <div className="mwops-control-kicker">
            <span />
            Tournament Operations
          </div>
          <h2 className="mwops-control-hero-title">
            CONTROL <span>THE MATCH.</span>
          </h2>
          <p>
            Build the competition structure, manage rounds and move every match
            through the MWOPS production workflow.
          </p>
        </div>
        <div className="mwops-control-hero-mark">
          <div className="mwops-control-hero-game">
            {tournament?.game || "ESPORTS"}
          </div>
          <div className="mwops-control-hero-status">LIVE OPERATIONS</div>
        </div>
      </section>

      {/* HEADER */}

      <div className="border-b border-[#252b29] bg-[#0d1110]">
        <div className="px-6 py-8 lg:px-10">

          <div className="flex flex-col justify-between gap-7 xl:flex-row xl:items-start">

            <div>
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-[#e7ad2e] shadow-[0_0_18px_rgba(231,173,46,0.65)]" />

                <span className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#e7ad2e]">
                  Tournament Control
                </span>
              </div>

              <h1 className="mwops-display mt-5 max-w-5xl text-5xl leading-[0.9] text-white sm:text-6xl xl:text-7xl">
                {tournament?.name ||
                  "TOURNAMENT"}
              </h1>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <StatusBadge
                  status={
                    tournamentStatus
                  }
                />

                <span className="flex items-center gap-2 text-xs font-bold text-[#68716d]">
                  <Gamepad2
                    size={14}
                  />

                  {tournament?.game ||
                    "Esports"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">

              <button
                type="button"
                onClick={
                  onNewRound
                }
                className="inline-flex items-center gap-2 rounded-xl bg-[#e7ad2e] px-5 py-3.5 text-xs font-extrabold uppercase tracking-[0.06em] text-[#151107] shadow-[0_0_25px_rgba(231,173,46,0.12)] transition hover:bg-[#ffc94b]"
              >
                <Plus
                  size={17}
                />

                New Round
              </button>

              <button
                type="button"
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#303634] bg-[#171b1a] text-[#a0a7a4] transition hover:border-[#e7ad2e]/40 hover:text-white"
                title="Tournament Settings"
                aria-label="Open Tournament Settings"
                onClick={onSettings}
              >
                <Settings size={19} />
              </button>

              <button
                type="button"
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#303634] bg-[#171b1a] text-[#a0a7a4] transition hover:border-[#e7ad2e]/40 hover:text-white"
                title="Share Tournament"
                aria-label="Share Tournament"
                onClick={onShare}
              >
                <Share2 size={18} />
              </button>

              <button
                type="button"
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#303634] bg-[#171b1a] text-[#a0a7a4] transition hover:border-[#e7ad2e]/40 hover:text-white"
                title="Export Tournament"
                aria-label="Export Tournament"
                onClick={onDownload}
              >
                <Download size={18} />
              </button>
            </div>
          </div>

          {/* STATS */}

          <div className="mt-10 grid gap-4 lg:grid-cols-3">

            <StatCard
              type="rounds"
              icon={Layers3}
              label="Active Rounds"
              value={
                activeRounds
              }
              secondary={
                rounds.length
                  ? `of ${rounds.length} total`
                  : "No rounds"
              }
              visual={getGameVisual(tournament?.game)}
            />

            <StatCard
              type="matches"
              icon={Gamepad2}
              label="Total Matches"
              value={
                matches.length
              }
              secondary={
                matches.length
                  ? "Scheduled"
                  : "No matches"
              }
              visual={getGameVisual(tournament?.game)}
            />

            <StatCard
              type="status"
              icon={Shield}
              label="Status"
              value={(
                STATUS_CONFIG[
                  tournamentStatus
                ] ||
                STATUS_CONFIG
                  .draft
              ).label}
              secondary="Current State"
              visual={getGameVisual(tournament?.game)}
            />
          </div>
        </div>
      </div>

      {/* ROUNDS */}

      <section className="px-6 py-8 lg:px-10 lg:py-10">

        <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">

          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#e7ad2e]">
              Competition Structure
            </p>

            <h2 className="mwops-display mt-2 text-3xl text-white sm:text-4xl">
              ROUNDS
            </h2>

            <p className="mt-2 max-w-2xl text-sm text-[#69736e]">
              Manage tournament groups,
              matches and competitive
              progression.
            </p>
          </div>

          <button
            type="button"
            onClick={
              onRefresh
            }
            disabled={loading}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-[#2b332f] px-4 py-3 text-xs font-bold text-[#7c8580] transition hover:border-[#e7ad2e]/40 hover:text-white disabled:opacity-50 md:self-auto"
          >
            <RefreshCw
              size={14}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-[#252d2a] bg-[#0b0f0d]">
            <div className="flex items-center gap-3 text-sm text-[#707a75]">
              <Loader2
                size={23}
                className="animate-spin text-[#e7ad2e]"
              />

              Loading tournament
              control...
            </div>
          </div>
        ) : roundsWithMatches.length ===
          0 ? (
          <EmptyRounds
            onNewRound={
              onNewRound
            }
          />
        ) : (
          <div className="space-y-5">
            {roundsWithMatches.map(
              (
                round,
                index
              ) => (
                <RoundCard
                  key={
                    round.id
                  }
                  round={
                    round
                  }
                  index={
                    index
                  }
                  visual={
                    getGameVisual(
                      tournament?.game
                    )
                  }
                  onViewMatches={
                    onViewMatches
                  }
                  onStandings={
                    onStandings
                  }
                  onAddMatch={
                    onAddMatch
                  }
                  onDeleteRound={
                    onDeleteRound
                  }
                  onDeleteMatch={
                    onDeleteMatch
                  }
                  deletingRoundId={
                    deletingRoundId
                  }
                  deletingMatchId={
                    deletingMatchId
                  }
                  onSettings={
                    onSettings
                  }
                  onShare={
                    onShare
                  }
                  onDownload={
                    onDownload
                  }
                />
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| TEAMS PAGE
|--------------------------------------------------------------------------
*/

function TeamsPage({
  teams,
  loading,
  onRefresh,
}) {
  return (
    <div className="px-6 py-8 lg:px-10 lg:py-10">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#e7ad2e]">
            Tournament Roster
          </p>

          <h1 className="mwops-display mt-2 text-4xl text-white">
            TEAMS
          </h1>

          <p className="mt-2 text-sm text-[#69736e]">
            Teams assigned to this tournament.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-[#2b332f] px-4 py-3 text-xs font-bold text-[#7c8580] transition hover:border-[#e7ad2e]/40 hover:text-white disabled:opacity-50 md:self-auto"
        >
          <RefreshCw
            size={14}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {loading ? (
        <LoadingPanel />
      ) : teams.length === 0 ? (
        <EmptyPanel
          icon={Users}
          title="NO TEAMS YET"
          description="No teams are currently assigned to this tournament."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((team, index) => {
            const teamName =
              team?.name ||
              team?.team_name ||
              team?.team?.name ||
              "Unnamed Team";

            const teamTag =
              team?.tag ||
              team?.short_name ||
              team?.team?.tag ||
              team?.team?.short_name ||
              "TEAM";

            const logo =
              team?.logo_url ||
              team?.logo ||
              team?.team?.logo_url ||
              null;

            const slot =
              team?.slot_number ??
              team?.slot ??
              team?.team?.slot_number ??
              null;

            return (
              <div
                key={team?.id || team?.team_id || `${teamName}-${index}`}
                className="group relative overflow-hidden rounded-2xl border border-[#252d2a] bg-[#0b0f0d] p-5 transition hover:border-[#e7ad2e]/30 hover:bg-[#0d1210]"
              >
                <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-[#e7ad2e]/[0.035] blur-3xl" />

                <div className="relative flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#2b332f] bg-[#070908] text-[#e7ad2e]">
                    {logo ? (
                      <img
                        src={logo}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Users size={22} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#e7ad2e]">
                      {slot !== null
                        ? `SLOT ${String(slot).padStart(2, "0")}`
                        : `TEAM ${String(index + 1).padStart(2, "0")}`}
                    </p>

                    <h3 className="mt-1 truncate text-sm font-extrabold text-white">
                      {teamName}
                    </h3>

                    <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-[#626c67]">
                      {teamTag}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| STANDINGS PAGE
|--------------------------------------------------------------------------
*/

function StandingsPage({
  standings,
  loading,
  onRefresh,
}) {
  const rows = Array.isArray(standings) ? standings : [];

  return (
    <div className="px-6 py-8 lg:px-10 lg:py-10">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#f2b632]">
            Competition Ranking
          </p>

          <h1 className="mwops-display mt-2 text-4xl text-white">
            STANDINGS
          </h1>

          <p className="mt-2 text-sm text-[#69736e]">
            Tournament rankings and scoring.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-[#2b332f] px-4 py-3 text-xs font-bold text-[#7c8580] transition hover:border-[#e7ad2e]/40 hover:text-white disabled:opacity-50 md:self-auto"
        >
          <RefreshCw
            size={14}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {loading ? (
        <LoadingPanel />
      ) : rows.length === 0 ? (
        <EmptyPanel
          icon={Trophy}
          title="NO STANDINGS YET"
          description="Teams are loaded from the tournament roster. Standings will populate with zero scores until match results are recorded."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#252d2a] bg-[#0b0f0d]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-[#252d2a] bg-[#080b0a]">
                  {[
                    "#",
                    "Team",
                    "Matches",
                    "Wins",
                    "Kills",
                    "Placement",
                    "Points",
                  ].map((heading, index) => (
                    <th
                      key={heading}
                      className={`px-6 py-4 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#65706a] ${
                        index === 0 ? "text-left" : "text-right"
                      } ${index === 1 ? "text-left" : ""}`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => {
                  const team =
                    row?.team ||
                    row?.teams ||
                    null;

                  const teamName =
                    team?.name ||
                    team?.short_name ||
                    row?.team_name ||
                    row?.name ||
                    "Unknown Team";

                  const teamTag =
                    team?.tag ||
                    team?.short_name ||
                    row?.team_tag ||
                    row?.tag ||
                    "";

                  const matchesPlayed =
                    row?.matches_played ??
                    row?.matches ??
                    row?.match_count ??
                    row?.played ??
                    0;

                  const wins =
                    row?.wins ??
                    row?.win_count ??
                    row?.victories ??
                    0;

                  const kills =
                    row?.total_kills ??
                    row?.kills ??
                    row?.kill_count ??
                    row?.eliminations ??
                    0;

                  const placement =
                    row?.total_placement_points ??
                    row?.placement_points ??
                    row?.placementPoints ??
                    0;

                  const points =
                    row?.total_points ??
                    row?.points ??
                    row?.score ??
                    0;

                  return (
                    <tr
                      key={
                        row?.id ||
                        row?.team_id ||
                        team?.id ||
                        `${teamName}-${index}`
                      }
                      className="border-b border-[#181e1b] last:border-0 transition hover:bg-white/[0.015]"
                    >
                      <td className="px-6 py-5 font-mono text-sm text-[#f2b632]">
                        {String(
                          row?.rank ??
                            row?.position ??
                            index + 1
                        ).padStart(2, "0")}
                      </td>

                      <td className="px-6 py-5">
                        <div className="font-extrabold text-white">
                          {teamName}
                        </div>
                        {teamTag && (
                          <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#59635e]">
                            {teamTag}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-5 text-right text-sm text-[#8b9590]">
                        {matchesPlayed}
                      </td>

                      <td className="px-6 py-5 text-right text-sm text-[#8b9590]">
                        {wins}
                      </td>

                      <td className="px-6 py-5 text-right text-sm text-[#8b9590]">
                        {kills}
                      </td>

                      <td className="px-6 py-5 text-right text-sm text-[#8b9590]">
                        {placement}
                      </td>

                      <td className="px-6 py-5 text-right text-sm font-extrabold text-[#f2b632]">
                        {points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| SETTINGS PAGE
|--------------------------------------------------------------------------
|
| Tournament settings is intentionally styled after the supplied reference:
| - tournament summary cards at the top
| - green operational/scoring panel
| - points per elimination
| - 1–25 placement points
|
| The current TournamentDetail file does not expose a scoring/settings
| persistence endpoint, so this section does not invent an API contract.
| It displays the current MWOPS BGMI scoring configuration safely.
|
|--------------------------------------------------------------------------
*/

const DEFAULT_PLACEMENT_POINTS = [
  10, 6, 5, 4, 3, 2, 1, 1,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0,
];

function normalizeScoringConfig(tournament) {
  const raw =
    tournament?.scoring_config ??
    tournament?.scoringConfig ??
    {};

  const killPointsRaw =
    raw?.kill_points ??
    raw?.killPoints ??
    tournament?.kill_points ??
    tournament?.elimination_points ??
    1;

  const placementRaw =
    raw?.placement_points ??
    raw?.placementPoints ??
    [];

  const placementMap = new Map();

  if (Array.isArray(placementRaw)) {
    placementRaw.forEach((item, index) => {
      if (
        item &&
        typeof item === "object" &&
        item.place !== undefined
      ) {
        placementMap.set(
          Number(item.place),
          Math.max(
            0,
            Number(item.points) || 0
          )
        );
      } else if (
        item !== undefined &&
        item !== null
      ) {
        placementMap.set(
          index + 1,
          Math.max(0, Number(item) || 0)
        );
      }
    });
  } else if (
    placementRaw &&
    typeof placementRaw === "object"
  ) {
    Object.entries(placementRaw).forEach(
      ([place, points]) => {
        const position = Number(place);

        if (Number.isInteger(position)) {
          placementMap.set(
            position,
            Math.max(0, Number(points) || 0)
          );
        }
      }
    );
  }

  const defaults = [
    10, 6, 5, 4, 3, 2, 1, 1,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0,
  ];

  return {
    killPoints: Math.max(
      0,
      Number(killPointsRaw) || 0
    ),

    placementPoints: Array.from(
      { length: 25 },
      (_, index) =>
        placementMap.has(index + 1)
          ? placementMap.get(index + 1)
          : defaults[index] || 0
    ),
  };
}

function SettingsStatCard({
  icon: Icon,
  value,
  label,
  badge,
  accent = "cyan",
}) {
  const accents = {
    cyan: {
      border: "border-cyan-400/25",
      icon: "bg-cyan-400/10 text-cyan-300",
      glow: "bg-cyan-400/[0.055]",
    },
    orange: {
      border: "border-[#e7ad2e]/25",
      icon: "bg-[#e7ad2e]/10 text-[#f5c44b]",
      glow: "bg-[#e7ad2e]/[0.055]",
    },
    green: {
      border: "border-emerald-400/25",
      icon: "bg-emerald-400/10 text-emerald-300",
      glow: "bg-emerald-400/[0.055]",
    },
  };

  const style =
    accents[accent] || accents.cyan;

  return (
    <div
      className={`relative min-h-[148px] overflow-hidden rounded-[15px] border bg-[#101715] p-5 shadow-[0_18px_50px_rgba(0,0,0,.18)] ${style.border}`}
    >
      <div
        className={`pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full blur-3xl ${style.glow}`}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${style.icon}`}
        >
          <Icon size={21} />
        </div>

        <span className="rounded-full bg-white/[0.045] px-3 py-1.5 text-[9px] font-bold text-[#858e89]">
          {badge}
        </span>
      </div>

      <div className="relative mt-5">
        <p className="mwops-display text-3xl leading-none text-white">
          {value}
        </p>

        <p className="mt-2 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#78827d]">
          {label}
        </p>
      </div>
    </div>
  );
}

function PlacementPointEditor({
  position,
  value,
  onChange,
}) {
  const highlighted =
    position <= 3;

  return (
    <label
      className={`flex min-h-[52px] items-center justify-between gap-3 rounded-[9px] border px-3 transition ${
        highlighted
          ? "border-[#e7ad2e]/25 bg-[#e7ad2e]/[0.04]"
          : "border-white/[0.08] bg-white/[0.018]"
      } focus-within:border-emerald-300/35`}
    >
      <span
        className={`text-[11px] font-extrabold ${
          highlighted
            ? "text-[#e7ad2e]"
            : "text-[#8b9590]"
        }`}
      >
        #{position}
      </span>

      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(event) =>
          onChange(
            position - 1,
            event.target.value
          )
        }
        className="w-16 rounded-md border border-transparent bg-[#07110d] px-2 py-1.5 text-right text-sm font-black text-white outline-none transition focus:border-emerald-300/25"
        aria-label={`Placement points for position ${position}`}
      />
    </label>
  );
}

function SettingsPage({
  tournament,
  roundsCount,
  teamsCount,
  matchesCount,
  onSave,
  saving,
}) {
  const [
    killPoints,
    setKillPoints,
  ] = useState(1);

  const [
    placementPoints,
    setPlacementPoints,
  ] = useState(
    DEFAULT_PLACEMENT_POINTS
  );

  const [
    dirty,
    setDirty,
  ] = useState(false);

  const [
    localError,
    setLocalError,
  ] = useState("");

  /*
  |--------------------------------------------------------------------------
  | LOAD CURRENT TOURNAMENT SCORING
  |--------------------------------------------------------------------------
  |
  | The page first uses scoring_config returned by the backend.
  | If no scoring_config exists yet, it falls back to the MWOPS defaults.
  |
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const config =
      normalizeScoringConfig(
        tournament
      );

    setKillPoints(
      config.killPoints
    );

    setPlacementPoints(
      config.placementPoints
    );

    setDirty(false);
    setLocalError("");
  }, [tournament]);

  const updatePlacement = (
    index,
    value
  ) => {
    const numeric =
      value === ""
        ? ""
        : Math.max(
            0,
            Math.floor(
              Number(value) || 0
            )
          );

    setPlacementPoints(
      (current) =>
        current.map(
          (item, itemIndex) =>
            itemIndex === index
              ? numeric
              : item
        )
    );

    setDirty(true);
    setLocalError("");
  };

  const updateKillPoints = (
    value
  ) => {
    const numeric =
      value === ""
        ? ""
        : Math.max(
            0,
            Math.floor(
              Number(value) || 0
            )
          );

    setKillPoints(numeric);
    setDirty(true);
    setLocalError("");
  };

  const handleSave = async () => {
    const normalizedKillPoints =
      Number(killPoints);

    if (
      !Number.isFinite(
        normalizedKillPoints
      ) ||
      normalizedKillPoints < 0
    ) {
      setLocalError(
        "Points per elimination must be 0 or greater."
      );

      return;
    }

    const normalizedPlacement =
      placementPoints.map(
        (points) =>
          Math.max(
            0,
            Math.floor(
              Number(points) || 0
            )
          )
      );

    const scoringConfig = {
      kill_points:
        normalizedKillPoints,

      placement_points:
        normalizedPlacement.map(
          (points, index) => ({
            place: index + 1,
            points,
          })
        ),
    };

    setLocalError("");

    const saved =
      await onSave(
        scoringConfig
      );

    if (saved) {
      setKillPoints(
        normalizedKillPoints
      );

      setPlacementPoints(
        normalizedPlacement
      );

      setDirty(false);
    }
  };

  const resetChanges = () => {
    const config =
      normalizeScoringConfig(
        tournament
      );

    setKillPoints(
      config.killPoints
    );

    setPlacementPoints(
      config.placementPoints
    );

    setDirty(false);
    setLocalError("");
  };

  const totalPlacementPool =
    placementPoints.reduce(
      (sum, points) =>
        sum +
        (Number(points) || 0),
      0
    );

  const maxPlacement =
    Math.max(
      ...placementPoints.map(
        (points) =>
          Number(points) || 0
      ),
      0
    );

  const tournamentStatus =
    String(
      tournament?.status ||
        "draft"
    ).toLowerCase();

  const statusLabel =
    STATUS_CONFIG[
      tournamentStatus
    ]?.label ||
    "DRAFT";

  return (
    <div className="mwops-settings-page min-h-full bg-[#070a09]">
      <style>{`
        .mwops-settings-page {
          --settings-green: #35d77b;
          --settings-green-bright: #59ef98;
          --settings-green-soft: rgba(53,215,123,.11);
          --settings-cyan: #18c8df;
          --settings-orange: #ff6417;
          --settings-line: rgba(255,255,255,.075);
        }

        .mwops-settings-page .settings-display {
          font-family: "Arial Black", Inter, ui-sans-serif, system-ui, sans-serif;
          font-weight: 1000;
          letter-spacing: -1.7px;
        }

        .mwops-settings-page .settings-grid-bg {
          background-image:
            linear-gradient(rgba(255,255,255,.014) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.014) 1px, transparent 1px);
          background-size: 52px 52px;
          mask-image: linear-gradient(to bottom, black, transparent 90%);
        }

        .mwops-settings-page .settings-green-panel {
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(circle at 78% 4%,rgba(77,230,137,.15),transparent 29%),
            radial-gradient(circle at 12% 90%,rgba(27,133,78,.13),transparent 28%),
            linear-gradient(135deg,rgba(28,91,59,.58),rgba(12,34,25,.96) 42%,rgba(12,25,20,.98));
        }

        .mwops-settings-page .settings-green-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(90deg,transparent 0%,rgba(255,255,255,.018) 50%,transparent 100%),
            linear-gradient(rgba(255,255,255,.016) 1px,transparent 1px),
            linear-gradient(90deg,rgba(255,255,255,.016) 1px,transparent 1px);
          background-size: 100% 100%,48px 48px,48px 48px;
          mask-image: linear-gradient(to bottom,rgba(0,0,0,.9),rgba(0,0,0,.55));
        }

        .mwops-settings-page .settings-panel-line {
          border-color: rgba(170,255,205,.11);
          background: rgba(8,20,15,.24);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.025),0 18px 50px rgba(0,0,0,.10);
        }

        .mwops-settings-page .settings-placement-grid {
          display: grid;
          grid-template-columns: repeat(8,minmax(0,1fr));
          gap: 9px;
        }

        .mwops-settings-page input[type="number"]::-webkit-inner-spin-button,
        .mwops-settings-page input[type="number"]::-webkit-outer-spin-button {
          opacity: .55;
        }

        @media (max-width:1100px) {
          .mwops-settings-page .settings-placement-grid {
            grid-template-columns: repeat(4,minmax(0,1fr));
          }
        }

        @media (max-width:620px) {
          .mwops-settings-page .settings-placement-grid {
            grid-template-columns: repeat(2,minmax(0,1fr));
          }
        }
      `}</style>

      <div className="relative overflow-hidden border-b border-[#252c29] bg-[#0b0f0e]">
        <div className="settings-grid-bg pointer-events-none absolute inset-0" />

        <div className="relative px-6 py-8 lg:px-10 lg:py-9">
          <div className="flex flex-col justify-between gap-7 xl:flex-row xl:items-start">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff6417] shadow-[0_0_16px_rgba(255,100,23,.65)]" />

                <span className="text-[11px] font-black uppercase tracking-[.18em] text-[#ff6417]">
                  Tournament Control
                </span>
              </div>

              <h1 className="settings-display mt-5 max-w-5xl text-4xl uppercase leading-[.92] text-[#f5f4ef] sm:text-5xl xl:text-6xl">
                {tournament?.name ||
                  "TOURNAMENT"}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <StatusBadge
                  status={
                    tournamentStatus
                  }
                />

                <span className="flex items-center gap-2 text-xs font-bold text-[#68736e]">
                  <Gamepad2 size={14} />
                  {tournament?.game ||
                    "BGMI"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={
                  saving ||
                  !dirty
                }
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#35d77b] px-4 text-[10px] font-black uppercase tracking-[.1em] text-[#06100b] shadow-[0_8px_25px_rgba(53,215,123,.12)] transition hover:bg-[#59ef98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? (
                  <Loader2
                    size={15}
                    className="animate-spin"
                  />
                ) : (
                  <Save size={15} />
                )}

                {saving
                  ? "Saving..."
                  : "Save Changes"}
              </button>

              {dirty && (
                <button
                  type="button"
                  onClick={resetChanges}
                  disabled={saving}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#303936] bg-[#171c1a] px-4 text-[10px] font-black uppercase tracking-[.1em] text-[#8c9691] transition hover:border-[#35d77b]/30 hover:text-white disabled:opacity-40"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="mt-9 grid gap-4 lg:grid-cols-3">
            <SettingsStatCard
              icon={Layers3}
              value={roundsCount}
              label="Active Rounds"
              badge={`of ${roundsCount || 0} total`}
              accent="cyan"
            />

            <SettingsStatCard
              icon={Gamepad2}
              value={matchesCount}
              label="Total Matches"
              badge={
                matchesCount
                  ? "Scheduled"
                  : "No matches"
              }
              accent="orange"
            />

            <SettingsStatCard
              icon={Shield}
              value={statusLabel}
              label="Status"
              badge="Current State"
              accent="green"
            />
          </div>
        </div>
      </div>

      <section className="relative px-6 py-8 lg:px-10 lg:py-10">
        <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                <Trophy size={21} />
              </div>

              <div>
                <h2 className="settings-display text-2xl uppercase text-white sm:text-3xl">
                  Points System
                </h2>

                <p className="mt-1 text-xs font-medium text-[#74807a]">
                  Configure the scoring rules for this tournament.
                  Changes are saved to the tournament scoring configuration.
                </p>
              </div>
            </div>
          </div>

          {dirty && (
            <span className="rounded-full border border-amber-300/15 bg-amber-300/[0.05] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.12em] text-amber-200/80">
              Unsaved Changes
            </span>
          )}
        </div>

        <div className="settings-green-panel rounded-[15px] border border-emerald-300/10 p-5 shadow-[0_28px_90px_rgba(0,0,0,.28)] sm:p-7 lg:p-8">
          <div className="relative z-[1]">
            <div className="settings-panel-line flex items-center justify-between gap-5 rounded-[12px] border px-4 py-4 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#ff6417]">
                  <span className="text-xl font-black">
                    ⊙
                  </span>
                </div>

                <div>
                  <span className="text-sm font-extrabold text-[#f3f4ef]">
                    Points Per Elimination
                  </span>
                  <p className="mt-0.5 text-[9px] text-[#627068]">
                    Finish points awarded for each elimination
                  </p>
                </div>
              </div>

              <input
                type="number"
                min="0"
                step="1"
                value={killPoints}
                onChange={(event) =>
                  updateKillPoints(
                    event.target.value
                  )
                }
                className="h-11 w-20 rounded-lg border border-white/[0.04] bg-[#07140f] px-3 text-center text-lg font-black text-white outline-none transition focus:border-emerald-300/30"
                aria-label="Points per elimination"
              />
            </div>

            {localError && (
              <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-xs font-bold text-red-200">
                {localError}
              </div>
            )}

            <div className="mt-7">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[.13em] text-[#a8b4ad]">
                    Placement Points
                  </p>

                  <p className="mt-1 text-[10px] text-[#6f7d75]">
                    Edit each position directly. Values are stored per tournament.
                  </p>
                </div>

                <span className="font-mono text-[9px] font-bold uppercase tracking-[.12em] text-[#6d7b73]">
                  25 positions
                </span>
              </div>

              <div className="settings-placement-grid mt-4">
                {placementPoints.map(
                  (points, index) => (
                    <PlacementPointEditor
                      key={index}
                      position={
                        index + 1
                      }
                      value={
                        points
                      }
                      onChange={
                        updatePlacement
                      }
                    />
                  )
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-3 border-t border-emerald-200/[0.08] pt-5 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-300/10 bg-[#07130e]/55 px-4 py-3">
                <p className="text-[8px] font-black uppercase tracking-[.13em] text-[#627068]">
                  Teams
                </p>
                <p className="mt-1 text-sm font-black text-[#dfe9e2]">
                  {teamsCount}
                </p>
              </div>

              <div className="rounded-xl border border-emerald-300/10 bg-[#07130e]/55 px-4 py-3">
                <p className="text-[8px] font-black uppercase tracking-[.13em] text-[#627068]">
                  Placement Pool
                </p>
                <p className="mt-1 text-sm font-black text-[#dfe9e2]">
                  {totalPlacementPool} pts
                </p>
              </div>

              <div className="rounded-xl border border-emerald-300/10 bg-[#07130e]/55 px-4 py-3">
                <p className="text-[8px] font-black uppercase tracking-[.13em] text-[#627068]">
                  Highest Placement
                </p>
                <p className="mt-1 text-sm font-black text-[#dfe9e2]">
                  {maxPlacement} pts
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col items-start justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/[0.12] px-4 py-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.15em] text-[#7e8c84]">
                  Configuration Summary
                </p>

                <p className="mt-1 text-xs text-[#637168]">
                  {teamsCount} teams · {roundsCount} rounds · {matchesCount} matches
                </p>
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={
                  saving ||
                  !dirty
                }
                className="inline-flex items-center gap-2 rounded-lg bg-[#35d77b] px-4 py-2.5 text-[9px] font-black uppercase tracking-[.12em] text-[#06100b] transition hover:bg-[#59ef98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? (
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <Save size={14} />
                )}

                {saving
                  ? "Saving..."
                  : "Save Scoring"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/*
|-------------------------------------------------------------------------- 
| SETTING ROW
|--------------------------------------------------------------------------
*/

function SettingRow({
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-[#252d2a] bg-[#070908] p-4">
      <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#59635e]">
        {label}
      </p>

      <div className="mt-2 text-sm font-bold text-white">
        {value}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| OPERATION ROW
|--------------------------------------------------------------------------
*/

function OperationRow({
  icon: Icon,
  title,
  description,
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#252d2a] bg-[#070908] p-4 transition hover:border-[#e7ad2e]/25">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e7ad2e]/5 text-[#e7ad2e]">
          <Icon size={17} />
        </div>

        <div>
          <p className="text-sm font-bold text-white">
            {title}
          </p>

          <p className="mt-1 text-xs text-[#59635e]">
            {description}
          </p>
        </div>
      </div>

      <ChevronRight
        size={16}
        className="text-[#414944]"
      />
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| EMPTY PANEL
|--------------------------------------------------------------------------
*/

function EmptyPanel({
  icon: Icon,
  title,
  description,
}) {
  return (
    <div className="flex min-h-[330px] flex-col items-center justify-center rounded-2xl border border-[#252d2a] bg-[#0b0f0d] px-6 text-center">

      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#e7ad2e]/20 bg-[#e7ad2e]/5 text-[#e7ad2e]">
        <Icon
          size={27}
        />
      </div>

      <h2 className="mwops-display mt-6 text-3xl text-white">
        {title}
      </h2>

      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#65706a]">
        {description}
      </p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| LOADING PANEL
|--------------------------------------------------------------------------
*/

function LoadingPanel() {
  return (
    <div className="flex min-h-[330px] items-center justify-center rounded-2xl border border-[#252d2a] bg-[#0b0f0d]">
      <div className="flex items-center gap-3 text-sm text-[#6d7771]">
        <Loader2
          size={23}
          className="animate-spin text-[#e7ad2e]"
        />

        Loading...
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| MAIN COMPONENT
|--------------------------------------------------------------------------
*/

function TournamentDetail() {
  const {
    tournamentId,
  } = useParams();

  const navigate =
    useNavigate();

  /*
  |--------------------------------------------------------------------------
  | STATE
  |--------------------------------------------------------------------------
  */

  const [
    tournament,
    setTournament,
  ] = useState(null);

  const [
    matches,
    setMatches,
  ] = useState([]);

  const [
    rounds,
    setRounds,
  ] = useState([]);

  const [
    teams,
    setTeams,
  ] = useState([]);

  const [
    standings,
    setStandings,
  ] = useState([]);

  const [
    activeTab,
    setActiveTab,
  ] = useState("rounds");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    matchesLoading,
    setMatchesLoading,
  ] = useState(false);

  const [
    roundsLoading,
    setRoundsLoading,
  ] = useState(false);

  const [
    teamsLoading,
    setTeamsLoading,
  ] = useState(false);

  const [
    standingsLoading,
    setStandingsLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    notice,
    setNotice,
  ] = useState("");

  /*
  |--------------------------------------------------------------------------
  | NEW ROUND STATE
  |--------------------------------------------------------------------------
  */

  const [
    newRoundOpen,
    setNewRoundOpen,
  ] = useState(false);

  const [
    newRoundName,
    setNewRoundName,
  ] = useState("");

  const [
    newRoundSaving,
    setNewRoundSaving,
  ] = useState(false);

  const [
    newRoundError,
    setNewRoundError,
  ] = useState("");

  const [
    deletingRoundId,
    setDeletingRoundId,
  ] = useState(null);

  const [
    deletingMatchId,
    setDeletingMatchId,
  ] = useState(null);

  /*
  |--------------------------------------------------------------------------
  | TOURNAMENT SETTINGS SAVE STATE
  |--------------------------------------------------------------------------
  */

  const [
    settingsSaving,
    setSettingsSaving,
  ] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | OPERATOR NOTICE
  |--------------------------------------------------------------------------
  */

  const showNotice =
    useCallback(
      (message) => {
        setNotice(message);

        window.clearTimeout(
          showNotice.timer
        );

        showNotice.timer =
          window.setTimeout(() => {
            setNotice("");
          }, 2600);
      },
      []
    );

  /*
  |--------------------------------------------------------------------------
  | LOAD TOURNAMENT
  |--------------------------------------------------------------------------
  */

  const loadTournament =
    useCallback(
      async (teamOverride = null) => {
        if (!tournamentId) {
          setError(
            "Tournament ID is missing."
          );

          return;
        }

        try {
          setLoading(true);
          setError("");

          const data =
            await request(
              `/tournaments/${encodeURIComponent(
                tournamentId
              )}`
            );

          const tournamentData =
            data?.tournament ||
            data;

          setTournament(
            tournamentData
          );
        } catch (err) {
          console.error(
            "Failed to load tournament:",
            err
          );

          setError(
            err.message ||
              "Failed to load tournament."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        tournamentId,
      ]
    );

  /*
  |--------------------------------------------------------------------------
  | LOAD ROUNDS
  |--------------------------------------------------------------------------
  */

  const loadRounds =
    useCallback(
      async () => {
        if (!tournamentId) {
          return;
        }

        try {
          setRoundsLoading(
            true
          );

          const data =
            await request(
              `/tournaments/${encodeURIComponent(
                tournamentId
              )}/rounds`
            );

          let roundData =
            data?.rounds ||
            data;

          /*
          |--------------------------------------------------------------------------
          | Defensive response handling
          |--------------------------------------------------------------------------
          */

          if (
            roundData?.data
          ) {
            roundData =
              roundData.data;
          }

          setRounds(
            Array.isArray(
              roundData
            )
              ? roundData
              : []
          );
        } catch (err) {
          console.error(
            "Failed to load tournament rounds:",
            err
          );

          setRounds([]);

          /*
          |--------------------------------------------------------------------------
          | Do not block the entire tournament page if rounds fail.
          |--------------------------------------------------------------------------
          */

        } finally {
          setRoundsLoading(
            false
          );
        }
      },
      [
        tournamentId,
      ]
    );

  /*
  |--------------------------------------------------------------------------
  | LOAD MATCHES
  |--------------------------------------------------------------------------
  */

  const loadMatches =
    useCallback(
      async () => {
        if (!tournamentId) {
          return;
        }

        try {
          setMatchesLoading(
            true
          );

          const data =
            await request(
              `/matches?tournament_id=${encodeURIComponent(
                tournamentId
              )}`
            );

          const matchData =
            data?.matches ||
            data;

          setMatches(
            Array.isArray(
              matchData
            )
              ? matchData
              : []
          );
        } catch (err) {
          console.error(
            "Failed to load tournament matches:",
            err
          );

          setMatches([]);
        } finally {
          setMatchesLoading(
            false
          );
        }
      },
      [
        tournamentId,
      ]
    );

  /*
  |--------------------------------------------------------------------------
  | LOAD TEAMS
  |--------------------------------------------------------------------------
  */

  const loadTeams =
    useCallback(
      async () => {
        if (!tournamentId) {
          setTeams([]);
          return [];
        }

        try {
          setTeamsLoading(true);

          // No team.service.js exists in the current frontend repository.
          // Use the existing HTTP helper and the real /teams endpoint.
          const data = await request(
            `/teams?_mwops_ts=${Date.now()}`
          );

          const raw =
            data?.teams ??
            data?.data ??
            data;

          const list =
            Array.isArray(raw)
              ? raw
              : Array.isArray(raw?.teams)
                ? raw.teams
                : Array.isArray(raw?.data)
                  ? raw.data
                  : [];

          const normalizedTeams = list
            .filter(Boolean)
            .filter((team) => {
              const ownerId =
                team?.tournament_id ??
                team?.tournamentId ??
                team?.tournament?.id;

              return (
                ownerId &&
                String(ownerId) === String(tournamentId)
              );
            })
            .map((team) => ({
              ...team,
              id: team?.id ?? team?.team_id,
              name:
                team?.name ??
                team?.team_name ??
                team?.team?.name ??
                'Unnamed Team',
              tag:
                team?.tag ??
                team?.short_name ??
                team?.team?.tag ??
                team?.team?.short_name ??
                '',
              logo_url:
                team?.logo_url ??
                team?.logo ??
                team?.team?.logo_url ??
                null,
              slot_number:
                team?.slot_number ??
                team?.slot ??
                team?.team?.slot_number ??
                null,
            }))
            .filter((team) => team.id)
            .sort((a, b) => {
              const slotA = Number(a?.slot_number || 0);
              const slotB = Number(b?.slot_number || 0);

              if (slotA > 0 && slotB > 0 && slotA !== slotB) {
                return slotA - slotB;
              }
              if (slotA > 0 && slotB === 0) return -1;
              if (slotA === 0 && slotB > 0) return 1;

              return String(a?.name || '').localeCompare(
                String(b?.name || '')
              );
            });

          setTeams(normalizedTeams);
          return normalizedTeams;
        } catch (err) {
          console.error('Failed to load tournament teams:', err);
          setTeams([]);
          return [];
        } finally {
          setTeamsLoading(false);
        }
      },
      [tournamentId]
    );

  /*
  |--------------------------------------------------------------------------
  | LOAD STANDINGS
  |--------------------------------------------------------------------------
  */

  const loadStandings =
    useCallback(
      async (teamOverride = null) => {
        if (!tournamentId) {
          setStandings([]);
          return [];
        }

        try {
          setStandingsLoading(true);

          const teamList = Array.isArray(teamOverride)
            ? teamOverride
            : teams;

          // The current backend standings contract is:
          // GET /api/standings?tournamentId=<uuid>
          // Keep this file self-contained; standings.service.js is not present.
          const data = await request(
            `/standings?tournamentId=${encodeURIComponent(tournamentId)}&_mwops_ts=${Date.now()}`
          );

          const raw =
            data?.standings ??
            data?.leaderboard ??
            data?.data ??
            data;

          const list =
            Array.isArray(raw)
              ? raw
              : Array.isArray(raw?.standings)
                ? raw.standings
                : Array.isArray(raw?.leaderboard)
                  ? raw.leaderboard
                  : Array.isArray(raw?.data)
                    ? raw.data
                    : [];

          const byTeam = new Map();

          list.filter(Boolean).forEach((row) => {
            const teamId =
              row?.team_id ??
              row?.teamId ??
              row?.team?.id ??
              row?.teams?.id;

            if (teamId) {
              byTeam.set(String(teamId), row);
            }
          });

          const merged = teamList.map((team, index) => {
            const teamId = team?.id ?? team?.team_id;
            const existing = teamId
              ? byTeam.get(String(teamId))
              : null;

            if (existing) {
              return {
                ...existing,
                team: existing?.team || existing?.teams || team,
                team_id: existing?.team_id || teamId,
                rank: existing?.rank ?? existing?.position ?? index + 1,
              };
            }

            return {
              id: `team-standing-${String(teamId || index)}`,
              tournament_id: tournamentId,
              team_id: teamId,
              team,
              team_name: team?.name || 'Unknown Team',
              short_name: team?.tag || team?.short_name || '',
              logo_url: team?.logo_url || null,
              matches_played: 0,
              matches: 0,
              wins: 0,
              losses: 0,
              draws: 0,
              kills: 0,
              total_kills: 0,
              placement_points: 0,
              total_placement_points: 0,
              kill_points: 0,
              total_points: 0,
              points: 0,
              rank: index + 1,
            };
          });

          const rosterIds = new Set(
            teamList
              .map((team) => team?.id ?? team?.team_id)
              .filter(Boolean)
              .map(String)
          );

          list.filter(Boolean).forEach((row) => {
            const teamId =
              row?.team_id ??
              row?.teamId ??
              row?.team?.id ??
              row?.teams?.id;

            if (teamId && !rosterIds.has(String(teamId))) {
              merged.push(row);
            }
          });

          merged.sort((a, b) => {
            const pointsA = Number(a?.total_points ?? a?.points ?? 0);
            const pointsB = Number(b?.total_points ?? b?.points ?? 0);
            if (pointsB !== pointsA) return pointsB - pointsA;

            const killsA = Number(a?.kills ?? a?.total_kills ?? 0);
            const killsB = Number(b?.kills ?? b?.total_kills ?? 0);
            if (killsB !== killsA) return killsB - killsA;

            return String(a?.team_name || a?.team?.name || '').localeCompare(
              String(b?.team_name || b?.team?.name || '')
            );
          });

          const ranked = merged.map((row, index) => ({
            ...row,
            rank: index + 1,
          }));

          setStandings(ranked);
          return ranked;
        } catch (err) {
          console.error('Failed to load tournament standings:', err);

          // Never turn a valid tournament roster into an empty standings page.
          const fallback = teamList.map((team, index) => ({
            id: `team-standing-${String(team?.id || index)}`,
            tournament_id: tournamentId,
            team_id: team?.id ?? team?.team_id,
            team,
            team_name: team?.name || 'Unknown Team',
            short_name: team?.tag || team?.short_name || '',
            logo_url: team?.logo_url || null,
            matches_played: 0,
            matches: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            kills: 0,
            total_kills: 0,
            placement_points: 0,
            kill_points: 0,
            total_points: 0,
            points: 0,
            rank: index + 1,
          }));

          setStandings(fallback);
          return fallback;
        } finally {
          setStandingsLoading(false);
        }
      },
      [tournamentId, teams]
    );

  /*
  |--------------------------------------------------------------------------
  | LOAD ALL DATA
  |--------------------------------------------------------------------------
  */

  const loadAll =
    useCallback(
      async () => {
        await Promise.all([
          loadTournament(),
          loadRounds(),
          loadMatches(),
        ]);

        /*
         * Standings depend on the tournament roster, so load teams
         * first. This removes the race that could produce an empty
         * standings state on the first render.
         */
        const loadedTeams =
          await loadTeams();

        await loadStandings(
          loadedTeams
        );
      },
      [
        loadTournament,
        loadRounds,
        loadMatches,
        loadTeams,
        loadStandings,
      ]
    );

  /*
  |--------------------------------------------------------------------------
  | INITIAL LOAD
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    loadAll();
    // The tournament ID is the intended lifecycle boundary for the
    // initial tournament workspace load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tournamentId,
  ]);

  /*
  |--------------------------------------------------------------------------
  | OPEN NEW ROUND
  |--------------------------------------------------------------------------
  */

  const handleNewRound =
    () => {
      setNewRoundName("");
      setNewRoundError("");
      setNewRoundOpen(true);
    };

  /*
  |--------------------------------------------------------------------------
  | CLOSE NEW ROUND
  |--------------------------------------------------------------------------
  */

  const handleCloseNewRound =
    () => {
      if (
        newRoundSaving
      ) {
        return;
      }

      setNewRoundOpen(
        false
      );

      setNewRoundName("");

      setNewRoundError("");
    };

  /*
  |--------------------------------------------------------------------------
  | CREATE ROUND
  |--------------------------------------------------------------------------
  */

  const handleCreateRound =
    async (event) => {
      event.preventDefault();

      const name =
        newRoundName.trim();

      if (!name) {
        setNewRoundError(
          "Round name is required."
        );

        return;
      }

      if (!tournamentId) {
        setNewRoundError(
          "Tournament ID is missing."
        );

        return;
      }

      try {
        setNewRoundSaving(
          true
        );

        setNewRoundError("");

        await request(
          `/tournaments/${encodeURIComponent(
            tournamentId
          )}/rounds`,
          {
            method: "POST",
            body: {
              name,
            },
          }
        );

        /*
        |--------------------------------------------------------------------------
        | Close modal after successful creation.
        |--------------------------------------------------------------------------
        */

        setNewRoundOpen(
          false
        );

        setNewRoundName("");

        /*
        |--------------------------------------------------------------------------
        | Reload actual rounds from backend.
        |--------------------------------------------------------------------------
        */

        await loadRounds();
      } catch (err) {
        console.error(
          "Failed to create tournament round:",
          err
        );

        setNewRoundError(
          err.message ||
            "Failed to create round."
        );
      } finally {
        setNewRoundSaving(
          false
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | TOURNAMENT ACTIONS
  |--------------------------------------------------------------------------
  */

  const handleOpenSettings =
    useCallback(() => {
      setActiveTab("settings");
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }, []);

  /*
  |--------------------------------------------------------------------------
  | SAVE TOURNAMENT SCORING SETTINGS
  |--------------------------------------------------------------------------
  |
  | scoring_config is the format already used by the tournament creation
  | flow. The backend must expose this field on PATCH /tournaments/:id.
  |
  */

  const handleSaveSettings =
    useCallback(
      async (scoringConfig) => {
        if (!tournamentId) {
          setError(
            "Tournament ID is missing."
          );

          return false;
        }

        try {
          setSettingsSaving(true);
          setError("");

          const data =
            await request(
              `/tournaments/${encodeURIComponent(
                tournamentId
              )}`,
              {
                method: "PATCH",
                body: {
                  name:
                    tournament?.name ||
                    "Tournament",
                  scoring_config:
                    scoringConfig,
                },
              }
            );

          const updatedTournament =
            data?.tournament ||
            data?.data ||
            data;

          if (
            updatedTournament &&
            typeof updatedTournament ===
              "object"
          ) {
            setTournament(
              (current) => ({
                ...current,
                ...updatedTournament,
                scoring_config:
                  updatedTournament?.scoring_config ??
                  scoringConfig,
              })
            );
          } else {
            setTournament(
              (current) => ({
                ...current,
                scoring_config:
                  scoringConfig,
              })
            );
          }

          showNotice(
            "Scoring settings saved."
          );

          return true;
        } catch (err) {
          console.error(
            "Failed to save tournament scoring settings:",
            err
          );

          setError(
            err?.message ||
              "Failed to save scoring settings."
          );

          return false;
        } finally {
          setSettingsSaving(false);
        }
      },
      [
        tournamentId,
        tournament?.name,
        showNotice,
      ]
    );

  const handleShareTournament =
    useCallback(async () => {
      const shareUrl =
        window.location.href;

      try {
        if (
          navigator.share
        ) {
          await navigator.share({
            title:
              tournament?.name ||
              "MWOPS Tournament",
            text:
              `View ${tournament?.name || "this tournament"} on MWOPS.`,
            url: shareUrl,
          });

          showNotice(
            "Tournament shared."
          );

          return;
        }

        if (
          navigator.clipboard &&
          window.isSecureContext
        ) {
          await navigator.clipboard.writeText(
            shareUrl
          );

          showNotice(
            "Tournament link copied."
          );

          return;
        }

        /*
         * Clipboard API may be unavailable in an embedded/HTTP
         * environment. Use the legacy selection method as fallback.
         */
        const textArea =
          document.createElement(
            "textarea"
          );

        textArea.value =
          shareUrl;

        textArea.setAttribute(
          "readonly",
          ""
        );

        textArea.style.position =
          "fixed";
        textArea.style.left =
          "-9999px";

        document.body.appendChild(
          textArea
        );

        textArea.select();

        const copied =
          document.execCommand(
            "copy"
          );

        document.body.removeChild(
          textArea
        );

        if (!copied) {
          throw new Error(
            "Clipboard access is unavailable."
          );
        }

        showNotice(
          "Tournament link copied."
        );
      } catch (err) {
        /*
         * navigator.share throws when the user closes the native share
         * sheet. Do not show an error in that case.
         */
        if (
          err?.name ===
          "AbortError"
        ) {
          return;
        }

        console.error(
          "Failed to share tournament:",
          err
        );

        showNotice(
          "Unable to share automatically. Copy the URL from your browser."
        );
      }
    }, [
      tournament?.name,
      showNotice,
    ]);

  const handleDownloadTournament =
    useCallback(() => {
      try {
        const exportPayload = {
          exported_at:
            new Date().toISOString(),
          tournament,
          rounds,
          matches,
          teams,
          standings,
        };

        const data =
          JSON.stringify(
            exportPayload,
            null,
            2
          );

        const blob =
          new Blob(
            [data],
            {
              type:
                "application/json;charset=utf-8",
            }
          );

        const url =
          URL.createObjectURL(
            blob
          );

        const link =
          document.createElement(
            "a"
          );

        const safeName =
          String(
            tournament?.name ||
              "tournament"
          )
            .trim()
            .replace(
              /[^a-z0-9]+/gi,
              "-"
            )
            .replace(
              /^-+|-+$/g,
              ""
            )
            .toLowerCase() ||
          "tournament";

        link.href =
          url;

        link.download =
          `${safeName}-mwops-export.json`;

        document.body.appendChild(
          link
        );

        link.click();

        document.body.removeChild(
          link
        );

        window.setTimeout(
          () =>
            URL.revokeObjectURL(
              url
            ),
          1000
        );

        showNotice(
          "Tournament export downloaded."
        );
      } catch (err) {
        console.error(
          "Failed to export tournament:",
          err
        );

        showNotice(
          "Unable to download tournament export."
        );
      }
    }, [
      tournament,
      rounds,
      matches,
      teams,
      standings,
      showNotice,
    ]);

  /*
  |--------------------------------------------------------------------------
  | ROUND ACTIONS
  |--------------------------------------------------------------------------
  */

  const handleViewMatches =
    (round) => {
      const query =
        new URLSearchParams();

      query.set(
        "tournament_id",
        tournamentId
      );

      if (
        round?.id
      ) {
        query.set(
          "round_id",
          round.id
        );
      }

      navigate(
        `/matches?${query.toString()}`
      );
    };

  const handleStandings =
    () => {
      setActiveTab(
        "standings"
      );
    };

  const handleAddMatch =
    (round) => {
      const query =
        new URLSearchParams();

      query.set(
        "tournament_id",
        tournamentId
      );

      if (
        round?.id
      ) {
        query.set(
          "round_id",
          round.id
        );
      }

      navigate(
        `/matches?${query.toString()}`
      );
    };

  /*
  |--------------------------------------------------------------------------
  | DELETE MATCH
  |--------------------------------------------------------------------------
  */

  const handleDeleteMatch = async (match) => {
    const id = match?.id || match?.match_id;

    if (!id) {
      setError("This match has no valid ID.");
      return;
    }

    const name = getMatchTitle(match, 0);
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) {
      return;
    }

    try {
      setDeletingMatchId(String(id));
      setError("");

      await request(`/matches/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      setMatches((current) =>
        current.filter(
          (item) => String(item?.id || item?.match_id) !== String(id)
        )
      );
    } catch (err) {
      console.error("Failed to delete match:", err);
      setError(err?.message || "Failed to delete match.");
    } finally {
      setDeletingMatchId(null);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | DELETE ROUND
  |--------------------------------------------------------------------------
  */

  const handleDeleteRound = async (round) => {
    const id = round?.id;

    if (!id) {
      setError("This round has no valid ID.");
      return;
    }

    const matchCount = matches.filter((match) => {
      const matchRoundId = getMatchRoundId(match);
      const matchRoundName = getMatchRoundName(match);
      return (
        (matchRoundId && String(matchRoundId) === String(id)) ||
        (matchRoundName && String(matchRoundName).trim().toLowerCase() === String(round?.name || "").trim().toLowerCase())
      );
    }).length;

    const warning = matchCount
      ? `Delete "${round?.name || "this round"}" and its ${matchCount} associated ${matchCount === 1 ? "match" : "matches"}? This cannot be undone.`
      : `Delete "${round?.name || "this round"}"? This cannot be undone.`;

    if (!window.confirm(warning)) {
      return;
    }

    try {
      setDeletingRoundId(String(id));
      setError("");

      await request(
        `/tournaments/${encodeURIComponent(tournamentId)}/rounds/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );

      setRounds((current) =>
        current.filter((item) => String(item?.id) !== String(id))
      );

      // Refresh matches because the round deletion may cascade its matches.
      await loadMatches();
    } catch (err) {
      console.error("Failed to delete round:", err);
      setError(err?.message || "Failed to delete round.");
    } finally {
      setDeletingRoundId(null);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | LOADING
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#070908] text-white">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-[#758079]">
            <Loader2
              size={24}
              className="animate-spin text-[#e7ad2e]"
            />

            Loading tournament
            control...
          </div>
        </div>
      </main>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | ERROR
  |--------------------------------------------------------------------------
  */

  if (
    error ||
    !tournament
  ) {
    return (
      <main className="min-h-screen bg-[#070908] px-6 py-10 text-white">
        <div className="flex min-h-[80vh] items-center justify-center">
          <div className="max-w-xl text-center">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#ff3b3b]/30 bg-[#ff3b3b]/10 text-[#ff5555]">
              <X
                size={26}
              />
            </div>

            <p className="mt-6 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#ff5555]">
              Tournament Error
            </p>

            <h1 className="mwops-display mt-2 text-4xl text-white">
              TOURNAMENT NOT AVAILABLE
            </h1>

            <p className="mt-4 text-sm leading-6 text-[#69736e]">
              {error ||
                "The requested tournament could not be found."}
            </p>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/tournaments"
                )
              }
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#e7ad2e] px-5 py-3 text-xs font-extrabold uppercase tracking-[0.08em] text-[#151107]"
            >
              <ArrowLeft
                size={15}
              />

              Back to Tournaments
            </button>
          </div>
        </div>
      </main>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | MAIN RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <main className="mwops-control-page min-h-screen bg-[#07090b] text-white">

      <style>{`
        .mwops-control-page {
          --mw-bg:#07090b;
          --mw-surface:#0d1115;
          --mw-surface-2:#11171c;
          --mw-line:rgba(255,255,255,.085);
          --mw-line-strong:rgba(255,255,255,.14);
          --mw-gold:#e7ad2e;
          --mw-gold-bright:#ffc94b;
          --mw-white:#f5f1e8;
          --mw-muted:#8d9499;
          --mw-dim:#5d666c;
          --mw-red:#ff4655;
        }
        .mwops-control-page::before {
          content:"";
          position:fixed;
          inset:0;
          pointer-events:none;
          z-index:0;
          background-image:
            linear-gradient(rgba(255,255,255,.012) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.012) 1px, transparent 1px);
          background-size:52px 52px;
          mask-image:linear-gradient(to bottom, rgba(0,0,0,.7), transparent 92%);
        }
        .mwops-control-topbar {
          display:none;
          position:sticky;
          top:0;
          z-index:40;
          border-bottom:1px solid var(--mw-line);
          background:rgba(7,9,11,.9);
          backdrop-filter:blur(20px);
        }
        .mwops-control-topbar::before {
          content:"";
          display:block;
          height:3px;
          background:linear-gradient(90deg, transparent, var(--mw-gold) 24%, var(--mw-gold-bright) 50%, var(--mw-gold) 76%, transparent);
        }
        .mwops-control-topbar-inner {
          min-height:76px;
          max-width:none;
          margin:0 auto;
          padding:0 28px;
          display:flex;
          align-items:center;
          gap:22px;
        }
        .mwops-control-brand {
          display:flex;
          align-items:center;
          gap:11px;
          min-width:max-content;
        }
        .mwops-control-brand-mark {
          width:36px;
          height:36px;
          display:grid;
          place-items:center;
          border:1px solid rgba(231,173,46,.42);
          border-radius:5px;
          background:rgba(231,173,46,.06);
          color:var(--mw-gold-bright);
          font-size:19px;
          font-weight:1000;
        }
        .mwops-control-brand-name {
          color:var(--mw-white);
          font-size:16px;
          font-weight:1000;
          letter-spacing:-.7px;
        }
        .mwops-control-brand-name span { color:var(--mw-gold); }
        .mwops-control-brand-sub {
          margin-top:2px;
          color:#596269;
          font-size:6px;
          font-weight:900;
          letter-spacing:1.7px;
          text-transform:uppercase;
        }
        .mwops-control-back {
          display:inline-flex;
          align-items:center;
          gap:7px;
          padding:9px 12px;
          border:1px solid var(--mw-line);
          border-radius:4px;
          color:#7f878c;
          font-size:7px;
          font-weight:950;
          letter-spacing:.7px;
          text-transform:uppercase;
          transition:.2s ease;
        }
        .mwops-control-back:hover {
          border-color:rgba(231,173,46,.4);
          color:var(--mw-gold-bright);
          background:rgba(231,173,46,.04);
        }
        .mwops-control-tabs {
          display:flex;
          align-items:center;
          gap:3px;
          margin-left:auto;
          overflow-x:auto;
          scrollbar-width:none;
        }
        .mwops-control-tabs::-webkit-scrollbar { display:none; }
        .mwops-control-tab {
          position:relative;
          min-height:38px;
          padding:0 13px;
          border:1px solid transparent;
          border-radius:4px;
          color:#70797f;
          background:transparent;
          font-size:7px;
          font-weight:950;
          letter-spacing:.8px;
          text-transform:uppercase;
          white-space:nowrap;
          transition:.2s ease;
        }
        .mwops-control-tab:hover { color:#eeeae2; background:rgba(255,255,255,.035); }
        .mwops-control-tab.active {
          color:#171207;
          background:var(--mw-gold);
          border-color:var(--mw-gold);
        }
        .mwops-control-status {
          display:flex;
          align-items:center;
          gap:7px;
          padding-left:10px;
          color:#687177;
          font-size:6px;
          font-weight:900;
          letter-spacing:1.2px;
          text-transform:uppercase;
          white-space:nowrap;
        }
        .mwops-control-status-dot {
          width:5px;
          height:5px;
          border-radius:50%;
          background:var(--mw-gold);
          box-shadow:0 0 10px rgba(231,173,46,.6);
        }
        .mwops-control-main {
          position:relative;
          z-index:1;
          max-width:1540px;
          margin:0 auto;
        }
        .mwops-control-hero {
          position:relative;
          min-height:245px;
          overflow:hidden;
          display:flex;
          align-items:flex-end;
          padding:30px 32px;
          border-bottom:1px solid var(--mw-line);
          background-position:center;
          background-size:cover;
          background-repeat:no-repeat;
        }
        .mwops-control-hero-grid {
          position:absolute;
          inset:0;
          background:
            linear-gradient(rgba(255,255,255,.022) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.022) 1px, transparent 1px);
          background-size:44px 44px;
          mask-image:linear-gradient(90deg, black, transparent 85%);
        }
        .mwops-control-hero::after {
          content:"";
          position:absolute;
          right:-80px;
          top:-160px;
          width:430px;
          height:430px;
          border:1px solid rgba(231,173,46,.12);
          border-radius:50%;
          box-shadow:0 0 0 28px rgba(231,173,46,.018), 0 0 0 56px rgba(231,173,46,.012);
        }
        .mwops-control-hero-copy {
          position:relative;
          z-index:2;
          max-width:780px;
        }
        .mwops-control-kicker {
          display:flex;
          align-items:center;
          gap:8px;
          color:var(--mw-gold);
          font-size:7px;
          font-weight:950;
          letter-spacing:2px;
          text-transform:uppercase;
        }
        .mwops-control-kicker span {
          width:20px;
          height:2px;
          background:var(--mw-gold);
        }
        .mwops-control-hero-title {
          margin:10px 0 0;
          color:var(--mw-white);
          font-size:clamp(38px,5vw,65px);
          line-height:.9;
          font-weight:1000;
          letter-spacing:-3px;
          text-transform:uppercase;
        }
        .mwops-control-hero-title span { color:var(--mw-gold-bright); }
        .mwops-control-hero-copy p {
          max-width:620px;
          margin-top:13px;
          color:#879096;
          font-size:9px;
          line-height:1.7;
        }
        .mwops-control-hero-mark {
          position:absolute;
          z-index:2;
          right:32px;
          bottom:28px;
          text-align:right;
        }
        .mwops-control-hero-game {
          color:#e4dfd5;
          font-size:9px;
          font-weight:950;
          letter-spacing:1.5px;
          text-transform:uppercase;
        }
        .mwops-control-hero-status {
          display:inline-flex;
          margin-top:8px;
          padding:5px 8px;
          border:1px solid rgba(231,173,46,.3);
          border-radius:3px;
          background:rgba(7,9,11,.65);
          color:var(--mw-gold-bright);
          font-size:5px;
          font-weight:950;
          letter-spacing:1px;
        }

        .mwops-control-shell {
          display:flex;
          min-height:100vh;
          position:relative;
          z-index:1;
        }
        .mwops-control-sidebar {
          position:sticky;
          top:0;
          width:248px;
          min-width:248px;
          height:100vh;
          display:flex;
          flex-direction:column;
          border-right:1px solid var(--mw-line);
          background:
            radial-gradient(circle at 10% 8%, rgba(231,173,46,.055), transparent 30%),
            #0b0f12;
          overflow:hidden;
        }
        .mwops-sidebar-brand {
          display:flex;
          align-items:center;
          gap:11px;
          padding:25px 22px 22px;
          border-bottom:1px solid var(--mw-line);
        }
        .mwops-sidebar-mark {
          width:38px;
          height:38px;
          display:grid;
          place-items:center;
          border:1px solid rgba(231,173,46,.45);
          border-radius:6px;
          background:rgba(231,173,46,.07);
          color:var(--mw-gold-bright);
          font-size:20px;
          font-weight:1000;
        }
        .mwops-sidebar-name {
          color:var(--mw-white);
          font-size:17px;
          line-height:1;
          font-weight:1000;
          letter-spacing:-.8px;
        }
        .mwops-sidebar-name span { color:var(--mw-gold); }
        .mwops-sidebar-sub {
          margin-top:5px;
          color:#596269;
          font-size:5.5px;
          font-weight:950;
          letter-spacing:1.45px;
        }
        .mwops-sidebar-back {
          margin:18px 16px 8px;
          padding:11px 12px;
          display:flex;
          align-items:center;
          gap:8px;
          border:1px solid var(--mw-line);
          border-radius:5px;
          background:rgba(255,255,255,.018);
          color:#7f878c;
          font-size:7px;
          font-weight:950;
          letter-spacing:.7px;
          text-transform:uppercase;
          transition:.2s ease;
        }
        .mwops-sidebar-back:hover {
          color:var(--mw-gold-bright);
          border-color:rgba(231,173,46,.38);
          background:rgba(231,173,46,.04);
        }
        .mwops-sidebar-section-label {
          padding:18px 22px 10px;
          color:#4e575d;
          font-size:6px;
          font-weight:950;
          letter-spacing:1.55px;
          text-transform:uppercase;
        }
        .mwops-sidebar-nav {
          display:flex;
          flex-direction:column;
          gap:2px;
        }
        .mwops-sidebar-item {
          position:relative;
          display:flex;
          align-items:center;
          gap:12px;
          width:100%;
          min-height:52px;
          padding:0 18px;
          border:0;
          background:transparent;
          color:#737b80;
          text-align:left;
          transition:.2s ease;
        }
        .mwops-sidebar-item:hover {
          background:rgba(255,255,255,.025);
          color:#eeeae2;
        }
        .mwops-sidebar-item.active {
          background:linear-gradient(90deg, rgba(231,173,46,.13), rgba(231,173,46,.025));
          color:var(--mw-white);
        }
        .mwops-sidebar-item-icon {
          width:34px;
          height:34px;
          display:grid;
          place-items:center;
          border:1px solid transparent;
          border-radius:7px;
          color:#626b71;
          transition:.2s ease;
        }
        .mwops-sidebar-item.active .mwops-sidebar-item-icon {
          border-color:rgba(231,173,46,.22);
          background:rgba(231,173,46,.09);
          color:var(--mw-gold-bright);
        }
        .mwops-sidebar-item:hover .mwops-sidebar-item-icon {
          color:var(--mw-gold-bright);
        }
        .mwops-sidebar-item-label {
          font-size:8px;
          font-weight:950;
          letter-spacing:.9px;
          text-transform:uppercase;
        }
        .mwops-sidebar-count {
          margin-left:auto;
          min-width:23px;
          padding:4px 6px;
          border-radius:3px;
          background:#151a1e;
          color:#687178;
          font-size:7px;
          font-weight:900;
          text-align:center;
        }
        .mwops-sidebar-active-line {
          position:absolute;
          left:0;
          top:11px;
          bottom:11px;
          width:2px;
          border-radius:0 3px 3px 0;
          background:var(--mw-gold);
          box-shadow:0 0 13px rgba(231,173,46,.6);
        }
        .mwops-sidebar-tournament {
          margin:20px 15px 0;
          border:1px solid var(--mw-line);
          border-radius:8px;
          background:#0d1216;
          overflow:hidden;
        }
        .mwops-sidebar-tournament-image {
          min-height:116px;
          display:flex;
          align-items:flex-end;
          padding:14px;
          background-position:center;
          background-size:cover;
        }
        .mwops-sidebar-tournament-copy span {
          display:block;
          color:var(--mw-gold);
          font-size:6px;
          font-weight:950;
          letter-spacing:1.25px;
          text-transform:uppercase;
        }
        .mwops-sidebar-tournament-copy strong {
          display:block;
          margin-top:5px;
          max-width:185px;
          overflow:hidden;
          color:#f3eee4;
          font-size:12px;
          font-weight:1000;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .mwops-sidebar-mini-stats {
          display:grid;
          grid-template-columns:1fr 1fr;
          border-top:1px solid var(--mw-line);
        }
        .mwops-sidebar-mini-stats div {
          padding:10px 12px;
        }
        .mwops-sidebar-mini-stats div + div {
          border-left:1px solid var(--mw-line);
        }
        .mwops-sidebar-mini-stats strong {
          display:block;
          color:#eeeae2;
          font-size:15px;
          font-weight:1000;
        }
        .mwops-sidebar-mini-stats span {
          display:block;
          margin-top:2px;
          color:#5c666c;
          font-size:5.5px;
          font-weight:900;
          letter-spacing:.9px;
          text-transform:uppercase;
        }
        .mwops-sidebar-footer {
          margin-top:auto;
          display:flex;
          align-items:center;
          gap:10px;
          margin:16px;
          padding:12px;
          border:1px solid rgba(231,173,46,.14);
          border-radius:7px;
          background:rgba(231,173,46,.035);
        }
        .mwops-sidebar-online-dot {
          width:6px;
          height:6px;
          flex:none;
          border-radius:50%;
          background:var(--mw-gold);
          box-shadow:0 0 10px rgba(231,173,46,.65);
        }
        .mwops-sidebar-footer strong {
          display:block;
          color:#b9b7ad;
          font-size:7px;
          font-weight:950;
          letter-spacing:.7px;
          text-transform:uppercase;
        }
        .mwops-sidebar-footer span:last-child {
          display:block;
          margin-top:3px;
          color:#4f595f;
          font-size:5.5px;
          line-height:1.4;
        }
        .mwops-control-content {
          min-width:0;
          flex:1;
        }
        @media (max-width:1100px) {
          .mwops-control-status { display:none; }
        }
        @media (max-width:760px) {
          .mwops-control-topbar-inner {
            min-height:112px;
            padding:12px 15px;
            flex-wrap:wrap;
            gap:10px;
          }
          .mwops-control-brand { flex:1; }
          .mwops-control-back { order:2; }
          .mwops-control-tabs {
            order:3;
            width:100%;
            margin-left:0;
          }
          .mwops-control-tab { flex:1; }
          .mwops-control-hero {
            min-height:260px;
            padding:25px 20px;
          }
          .mwops-control-hero-mark { display:none; }
        }

        /* ================================================================
           MWOPS PREMIUM SIGNATURE LAYER
           Refined broadcast-control aesthetic: graphite, gold, glass depth.
           ================================================================ */
        .mwops-control-page {
          --mw-bg:#06080a;
          --mw-surface:#0b0f13;
          --mw-surface-2:#10151a;
          --mw-surface-3:#151b20;
          --mw-line:rgba(255,255,255,.075);
          --mw-line-strong:rgba(255,255,255,.13);
          --mw-gold:#d9a52a;
          --mw-gold-bright:#f5c44b;
          --mw-gold-soft:rgba(217,165,42,.12);
          --mw-white:#f4f0e7;
          --mw-muted:#858d93;
          --mw-dim:#505960;
          --mw-red:#ff4655;
          font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        }

        .mwops-control-page::before {
          opacity:.65;
          background-size:64px 64px;
          background-image:
            linear-gradient(rgba(255,255,255,.014) 1px,transparent 1px),
            linear-gradient(90deg,rgba(255,255,255,.014) 1px,transparent 1px);
          mask-image:linear-gradient(to bottom,rgba(0,0,0,.8),transparent 88%);
        }

        .mwops-control-page::after {
          content:"";
          position:fixed;
          inset:0;
          z-index:0;
          pointer-events:none;
          background:
            radial-gradient(circle at 72% 8%,rgba(217,165,42,.045),transparent 25%),
            radial-gradient(circle at 12% 70%,rgba(255,255,255,.018),transparent 22%);
        }

        .mwops-control-shell {
          position:relative;
          z-index:2;
          background:
            linear-gradient(180deg,rgba(255,255,255,.012),transparent 22%),
            #07090b;
        }

        /* Sidebar */
        .mwops-control-sidebar {
          width:264px;
          min-width:264px;
          border-right:1px solid rgba(255,255,255,.08);
          background:
            linear-gradient(180deg,rgba(255,255,255,.018),transparent 20%),
            radial-gradient(circle at 20% 0%,rgba(217,165,42,.075),transparent 30%),
            #090d11;
          box-shadow:18px 0 70px rgba(0,0,0,.18);
        }

        .mwops-sidebar-brand {
          min-height:88px;
          padding:23px 21px;
          background:linear-gradient(180deg,rgba(255,255,255,.018),transparent);
        }

        .mwops-sidebar-mark,
        .mwops-control-brand-mark {
          position:relative;
          border-color:rgba(245,196,75,.42);
          background:
            linear-gradient(135deg,rgba(245,196,75,.12),rgba(245,196,75,.025));
          box-shadow:inset 0 0 22px rgba(217,165,42,.04),0 0 24px rgba(217,165,42,.05);
        }

        .mwops-sidebar-mark::after,
        .mwops-control-brand-mark::after {
          content:"";
          position:absolute;
          inset:5px;
          border:1px solid rgba(245,196,75,.08);
          pointer-events:none;
        }

        .mwops-sidebar-back {
          margin:19px 15px 7px;
          border-radius:7px;
          background:rgba(255,255,255,.018);
          backdrop-filter:blur(10px);
        }

        .mwops-sidebar-section-label {
          padding-top:22px;
          letter-spacing:1.8px;
        }

        .mwops-sidebar-nav {
          padding:0 9px;
        }

        .mwops-sidebar-item {
          min-height:54px;
          margin:2px 0;
          padding:0 12px;
          border:1px solid transparent;
          border-radius:8px;
        }

        .mwops-sidebar-item.active {
          border-color:rgba(217,165,42,.14);
          background:
            linear-gradient(90deg,rgba(217,165,42,.105),rgba(217,165,42,.025));
          box-shadow:inset 0 0 25px rgba(217,165,42,.025);
        }

        .mwops-sidebar-item.active .mwops-sidebar-item-icon {
          background:linear-gradient(145deg,rgba(245,196,75,.13),rgba(217,165,42,.035));
          border-color:rgba(245,196,75,.2);
          box-shadow:0 6px 22px rgba(217,165,42,.06);
        }

        .mwops-sidebar-active-line {
          left:-1px;
          top:13px;
          bottom:13px;
          width:2px;
          background:linear-gradient(180deg,transparent,var(--mw-gold-bright),transparent);
        }

        .mwops-sidebar-count {
          background:#11161b;
          border:1px solid rgba(255,255,255,.045);
        }

        .mwops-sidebar-tournament {
          margin:22px 15px 0;
          border-radius:10px;
          border-color:rgba(255,255,255,.09);
          box-shadow:0 15px 40px rgba(0,0,0,.18);
        }

        .mwops-sidebar-tournament-image {
          position:relative;
          min-height:128px;
          isolation:isolate;
        }

        .mwops-sidebar-tournament-image::after {
          content:"";
          position:absolute;
          inset:0;
          z-index:-1;
          background:linear-gradient(135deg,rgba(217,165,42,.13),transparent 55%);
        }

        .mwops-sidebar-mini-stats div {
          background:rgba(255,255,255,.008);
        }

        .mwops-sidebar-footer {
          border-color:rgba(217,165,42,.14);
          background:linear-gradient(135deg,rgba(217,165,42,.05),rgba(255,255,255,.012));
        }

        /* Top bar */
        .mwops-control-topbar {
          display:none;
          background:rgba(6,8,10,.82);
          border-bottom-color:rgba(255,255,255,.075);
          box-shadow:0 12px 40px rgba(0,0,0,.16);
        }

        .mwops-control-topbar::before {
          height:2px;
          opacity:.8;
          background:linear-gradient(90deg,transparent 4%,rgba(217,165,42,.55) 25%,var(--mw-gold-bright) 50%,rgba(217,165,42,.55) 75%,transparent 96%);
        }

        .mwops-control-topbar-inner {
          min-height:72px;
          padding:0 30px;
        }

        .mwops-control-tab {
          min-height:37px;
          border-radius:6px;
        }

        .mwops-control-tab.active {
          color:#141006;
          box-shadow:0 6px 22px rgba(217,165,42,.13);
        }

        /* Hero */
        .mwops-control-hero {
          min-height:300px;
          padding:38px 40px;
          border-bottom-color:rgba(255,255,255,.08);
          background-position:center 42%;
        }

        .mwops-control-hero::before {
          content:"";
          position:absolute;
          inset:0;
          background:
            linear-gradient(90deg,rgba(5,7,9,.35),transparent 55%),
            linear-gradient(0deg,rgba(5,7,9,.72),transparent 48%);
          pointer-events:none;
        }

        .mwops-control-hero::after {
          right:-100px;
          top:-210px;
          width:520px;
          height:520px;
          border-color:rgba(245,196,75,.10);
          box-shadow:
            0 0 0 36px rgba(245,196,75,.014),
            0 0 0 72px rgba(245,196,75,.009);
        }

        .mwops-control-hero-copy {
          max-width:820px;
          padding-left:3px;
        }

        .mwops-control-kicker {
          text-shadow:0 0 18px rgba(217,165,42,.15);
        }

        .mwops-control-hero-title {
          font-size:clamp(43px,5.2vw,72px);
          letter-spacing:-3.6px;
          text-shadow:0 10px 35px rgba(0,0,0,.4);
        }

        .mwops-control-hero-copy p {
          color:#a0a7ac;
          font-size:10px;
          max-width:660px;
        }

        .mwops-control-hero-mark {
          padding:13px 15px;
          border:1px solid rgba(255,255,255,.08);
          border-radius:8px;
          background:rgba(7,9,11,.48);
          backdrop-filter:blur(14px);
          box-shadow:0 15px 45px rgba(0,0,0,.2);
        }

        /* Main content cards */
        .mwops-rounds-page {
          background:
            linear-gradient(180deg,rgba(255,255,255,.009),transparent 35%);
        }

        .mwops-rounds-page > .border-b {
          background:
            radial-gradient(circle at 75% 0%,rgba(217,165,42,.035),transparent 28%),
            rgba(11,15,18,.94) !important;
        }

        .mwops-rounds-page section {
          position:relative;
        }

        .mwops-rounds-page article,
        .mwops-rounds-page .rounded-2xl,
        .mwops-rounds-page table {
          box-shadow:0 16px 55px rgba(0,0,0,.12);
        }

        .mwops-rounds-page article.group {
          border-color:rgba(255,255,255,.075) !important;
          background:
            linear-gradient(135deg,rgba(255,255,255,.018),transparent 38%),
            #0b0f13 !important;
          box-shadow:
            0 18px 55px rgba(0,0,0,.18),
            inset 0 1px 0 rgba(255,255,255,.018);
        }

        .mwops-rounds-page article.group:hover {
          border-color:rgba(245,196,75,.27) !important;
          transform:translateY(-2px);
          box-shadow:
            0 24px 70px rgba(0,0,0,.26),
            0 0 40px rgba(217,165,42,.035);
        }

        .mwops-rounds-page article.group > .relative.h-24 {
          height:112px;
        }

        .mwops-rounds-page article.group > .relative.h-24 img {
          filter:saturate(.82) contrast(1.08);
        }

        .mwops-rounds-page article.group > .relative.h-24::after {
          content:"";
          position:absolute;
          inset:0;
          pointer-events:none;
          background:
            linear-gradient(90deg,rgba(217,165,42,.08),transparent 45%),
            repeating-linear-gradient(90deg,transparent 0,transparent 44px,rgba(255,255,255,.018) 45px);
        }

        .mwops-rounds-page article h3 {
          letter-spacing:-1.1px;
        }

        /* Stats */
        .mwops-rounds-page .grid.lg\:grid-cols-3 > div {
          min-height:178px;
          border-color:rgba(255,255,255,.075) !important;
          background:
            linear-gradient(135deg,rgba(255,255,255,.018),transparent 45%),
            #0b0f13 !important;
          box-shadow:
            0 16px 48px rgba(0,0,0,.18),
            inset 0 1px 0 rgba(255,255,255,.02);
        }

        /* Buttons */
        .mwops-control-page button {
          transition:
            transform .2s ease,
            border-color .2s ease,
            background-color .2s ease,
            box-shadow .2s ease,
            color .2s ease;
        }

        .mwops-control-page button:active {
          transform:translateY(1px);
        }

        /* Gold premium surfaces */
        .mwops-control-page .bg-\[\#e7ad2e\] {
          box-shadow:0 8px 28px rgba(217,165,42,.12);
        }

        /* Remove visual green cast from the supplied version */
        .mwops-control-page .bg-\[\#0c1110\],
        .mwops-control-page .bg-\[\#0b0f0d\] {
          background-color:#0b0f13 !important;
        }

        /* Cleaner content rhythm */
        .mwops-control-main {
          background:linear-gradient(180deg,rgba(255,255,255,.005),transparent);
        }

        /* Mobile */
        @media (max-width:900px) {
          .mwops-control-sidebar {
            width:220px;
            min-width:220px;
          }
          .mwops-control-topbar-inner {
            padding:0 20px;
          }
          .mwops-control-hero {
            min-height:270px;
            padding:30px 26px;
          }
        }

        @media (max-width:760px) {
          .mwops-control-shell {
            display:block;
          }
          .mwops-control-sidebar {
            position:relative;
            width:100%;
            min-width:0;
            height:auto;
            min-height:0;
            border-right:0;
            border-bottom:1px solid var(--mw-line);
          }
          .mwops-sidebar-nav {
            display:grid;
            grid-template-columns:repeat(4,1fr);
            padding:6px 10px 12px;
          }
          .mwops-sidebar-item {
            min-height:46px;
            justify-content:center;
            padding:0 5px;
          }
          .mwops-sidebar-item-label {
            display:none;
          }
          .mwops-sidebar-count,
          .mwops-sidebar-back,
          .mwops-sidebar-tournament,
          .mwops-sidebar-footer,
          .mwops-sidebar-section-label {
            display:none;
          }
          .mwops-sidebar-item-icon {
            width:34px;
            height:34px;
          }
          .mwops-sidebar-brand {
            padding:15px 18px;
          }
          .mwops-control-hero {
            min-height:245px;
            padding:25px 20px;
          }
          .mwops-control-hero-title {
            letter-spacing:-2px;
          }
        }
      `}</style>

      <div className="mwops-control-shell">

        {notice && (
          <div className="pointer-events-none fixed right-6 top-6 z-[200]">
            <div className="flex items-center gap-3 rounded-xl border border-[#e7ad2e]/30 bg-[#0d1115]/95 px-4 py-3 text-xs font-extrabold text-white shadow-[0_20px_70px_rgba(0,0,0,.45)] backdrop-blur-xl">
              <span className="h-2 w-2 rounded-full bg-[#e7ad2e] shadow-[0_0_12px_rgba(231,173,46,.7)]" />
              {notice}
            </div>
          </div>
        )}

        <TournamentSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onBack={() => navigate("/tournaments")}
          tournament={tournament}
          roundsCount={rounds.length}
          matchesCount={matches.length}
        />

        <div className="mwops-control-content">

      {/* NEW ROUND MODAL */}

      <NewRoundModal
        open={
          newRoundOpen
        }
        name={
          newRoundName
        }
        setName={
          setNewRoundName
        }
        onClose={
          handleCloseNewRound
        }
        onSubmit={
          handleCreateRound
        }
        saving={
          newRoundSaving
        }
        error={
          newRoundError
        }
      />

      <div className="mwops-control-main">
        {activeTab ===
          "rounds" && (
          <RoundsPage
            tournament={
              tournament
            }
            rounds={
              rounds
            }
            matches={
              matches
            }
            loading={
              roundsLoading ||
              matchesLoading
            }
            onRefresh={
              async () => {
                await Promise.all([
                  loadRounds(),
                  loadMatches(),
                ]);
              }
            }
            onNewRound={
              handleNewRound
            }
            onViewMatches={
              handleViewMatches
            }
            onStandings={
              handleStandings
            }
            onAddMatch={
              handleAddMatch
            }
            onDeleteRound={
              handleDeleteRound
            }
            onDeleteMatch={
              handleDeleteMatch
            }
            deletingRoundId={
              deletingRoundId
            }
            deletingMatchId={
              deletingMatchId
            }
            onSettings={
              handleOpenSettings
            }
            onShare={
              handleShareTournament
            }
            onDownload={
              handleDownloadTournament
            }
          />
        )}

        {activeTab ===
          "teams" && (
          <TeamsPage
            teams={
              teams
            }
            loading={
              teamsLoading
            }
            onRefresh={
              loadTeams
            }
          />
        )}

        {activeTab ===
          "standings" && (
          <StandingsPage
            standings={
              standings
            }
            loading={
              standingsLoading
            }
            onRefresh={
              async () => {
                await loadTeams();
                await loadStandings();
              }
            }
          />
        )}

        {activeTab ===
          "settings" && (
          <SettingsPage
            tournament={
              tournament
            }
            roundsCount={
              rounds.length
            }
            teamsCount={
              teams.length
            }
            matchesCount={
              matches.length
            }
            onSave={
              handleSaveSettings
            }
            saving={
              settingsSaving
            }
          />
        )}
        </div>
        </div>
      </div>
    </main>
  );
}

export default TournamentDetail;