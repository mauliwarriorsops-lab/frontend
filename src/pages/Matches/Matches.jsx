/*
|--------------------------------------------------------------------------
| MWOPS MATCH OPERATIONS
|--------------------------------------------------------------------------
|
| Match Center + Quick Match Setup
|
| CURRENT MATCH ROSTER MODEL
|
| Step 1:
|   Match information
|   Tournament
|   Round
|   Map
|   Total slots
|   Match mode: LIVE / SCHEDULED
|
| Step 2:
|   Slot-based roster
|   Each slot can contain:
|     - Team name
|     - Team tag
|     - Optional team logo
|     - Players
|
| Step 3:
|   Review
|
| BACKEND PAYLOAD
|
| team_slots: [
|   {
|     slot: 1,
|     team_name: "Team Alpha",
|     team_tag: "ALP",
|     logo_url: null, // optional
|     players: [
|       { gamer_tag: "Player 1" },
|       { gamer_tag: "Player 2" }
|     ]
|   }
| ]
|
|--------------------------------------------------------------------------
*/

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Copy,
  FileSpreadsheet,
  Gamepad2,
  Layers3,
  Loader2,
  Map,
  Plus,
  Radio,
  Search,
  Shield,
  Trophy,
  Upload,
  Users,
  X,
  UserPlus,
  Trash2,
  CalendarDays,
} from "lucide-react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  getMatches,
  getMatch,
  createMatch,
} from "../../api/matches";

/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

const DEFAULT_TOTAL_SLOTS = 16;

const SLOT_OPTIONS = [
  4,
  8,
  12,
  16,
  20,
  24,
  32,
  48,
  64,
];

const MAP_OPTIONS = [
  {
    id: "erangel",
    name: "Erangel",
    short: "ER",
  },
  {
    id: "miramar",
    name: "Miramar",
    short: "MI",
  },
  {
    id: "sanhok",
    name: "Sanhok",
    short: "SA",
  },
  {
    id: "rondo",
    name: "Rondo",
    short: "RO",
  },
  {
    id: "custom",
    name: "Custom",
    short: "CU",
  },
];

/*
|--------------------------------------------------------------------------
| INITIAL FORM
|--------------------------------------------------------------------------
*/

const initialForm = {
  tournament_id: "",
  round_id: "",
  round: "",
  match_number: 1,
  game: "",
  map_name: "Erangel",
  total_slots: DEFAULT_TOTAL_SLOTS,
  starting_slot: 1,

  /*
  |--------------------------------------------------------------------------
  | MATCH MODE
  |--------------------------------------------------------------------------
  |
  | User explicitly chooses whether the match should be:
  |
  | live      -> starts immediately as LIVE
  | scheduled -> starts as SCHEDULED
  |
  */

  status: "scheduled",

  team_slots: [],
};

/*
|--------------------------------------------------------------------------
| API
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
  let response;

  try {
    response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        method:
          options.method || "GET",

        headers: {
          Accept:
            "application/json",

          ...(options.body !== undefined
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
  } catch {
    throw new Error(
      `Unable to reach MWOPS backend at ${API_BASE_URL}. Check that the backend is running and VITE_API_URL is correct.`
    );
  }

  let payload = null;

  try {
    payload =
      await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error =
      new Error(
        payload?.message ||
          payload?.error ||
          payload?.details ||
          `Request failed with status ${response.status}`
      );

    error.status =
      response.status;

    error.code =
      payload?.code;

    error.details =
      payload?.details;

    throw error;
  }

  return unwrapResponse(
    payload
  );
}

/*
|--------------------------------------------------------------------------
| NORMALIZATION
|--------------------------------------------------------------------------
*/

function normalizeStatus(
  status
) {
  const value = String(
    status || "scheduled"
  )
    .trim()
    .toLowerCase();

  if (
    value === "upcoming"
  ) {
    return "scheduled";
  }

  if (
    value === "in_progress" ||
    value === "in progress"
  ) {
    return "live";
  }

  if (
    value === "finished" ||
    value === "ended"
  ) {
    return "completed";
  }

  return value;
}

function normalizeTeam(
  team
) {
  if (!team) {
    return null;
  }

  return {
    ...team,

    id:
      team.id ||
      team.team_id ||
      null,

    name:
      team.name ||
      team.team_name ||
      team.teamName ||
      "Unnamed Team",

    tag:
      team.tag ||
      team.short_name ||
      team.shortName ||
      "",

    logo_url:
      team.logo_url ||
      team.logo ||
      team.team_logo ||
      team.teamLogo ||
      null,
  };
}

function getMatchNumber(
  match
) {
  const direct =
    Number(
      match?.match_number
    );

  if (
    Number.isFinite(
      direct
    ) &&
    direct > 0
  ) {
    return direct;
  }

  const found =
    String(
      match?.name || ""
    ).match(
      /(?:match|game)\s*#?\s*(\d+)/i
    );

  return found
    ? Number(found[1])
    : 0;
}

function getMatchTeams(
  match
) {
  if (
    Array.isArray(
      match?.teams
    )
  ) {
    return match.teams;
  }

  if (
    Array.isArray(
      match?.match_teams
    )
  ) {
    return match.match_teams
      .map(
        (item) =>
          normalizeTeam(
            item?.team ||
              item
          )
      )
      .filter(Boolean);
  }

  return [];
}

function getSlotTeams(
  match
) {
  if (
    !Array.isArray(
      match?.match_teams
    )
  ) {
    return [];
  }

  return match.match_teams
    .map(
      (item) => ({
        slot:
          Number(
            item?.slot
          ) || 0,

        team:
          normalizeTeam(
            item?.team ||
              item
          ),

        players:
          Array.isArray(
            item?.match_team_players
          )
            ? item.match_team_players.map(
                (entry) =>
                  entry?.player ||
                  entry
              )
            : [],
      })
    )
    .filter(
      (item) =>
        item.team
    )
    .sort(
      (a, b) =>
        a.slot - b.slot
    );
}

function getTeamName(
  team
) {
  if (!team) {
    return "TBD";
  }

  if (
    typeof team ===
    "string"
  ) {
    return team;
  }

  return (
    team.name ||
    team.team_name ||
    team.teamName ||
    "TBD"
  );
}

function getTeamTag(
  team
) {
  if (!team) {
    return "";
  }

  return (
    team.tag ||
    team.short_name ||
    team.shortName ||
    ""
  );
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
    normalizeStatus(
      status
    );

  if (
    normalized === "live"
  ) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-[#ff3b3b]/30 bg-[#ff3b3b]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#ff6666]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff3b3b]" />
        Live
      </span>
    );
  }

  if (
    normalized ===
    "completed"
  ) {
    return (
      <span className="inline-flex items-center rounded-full border border-[#30353a] bg-[#17191b] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#8f969c]">
        Completed
      </span>
    );
  }

  if (
    normalized === "paused"
  ) {
    return (
      <span className="inline-flex items-center rounded-full border border-[#f2b632]/30 bg-[#f2b632]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#f2b632]">
        Paused
      </span>
    );
  }

  if (
    normalized ===
    "cancelled"
  ) {
    return (
      <span className="inline-flex items-center rounded-full border border-[#ff3b3b]/20 bg-[#ff3b3b]/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#ff6666]">
        Cancelled
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#f2b632]/25 bg-[#f2b632]/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#c99b36]">
      <CalendarDays size={12} />
      Scheduled
    </span>
  );
}

/*
|--------------------------------------------------------------------------
| WIZARD PROGRESS
|--------------------------------------------------------------------------
*/

function WizardProgress({
  step,
}) {
  const steps = [
    {
      number: 1,
      label: "Match Info",
    },
    {
      number: 2,
      label: "Teams",
    },
    {
      number: 3,
      label: "Review",
    },
  ];

  return (
    <div className="border-b border-[#252a2e] bg-[#080a0b] px-6 py-5 lg:px-8">
      <div className="mx-auto flex max-w-4xl items-center">
        {steps.map(
          (
            item,
            index
          ) => {
            const active =
              step ===
              item.number;

            const complete =
              step >
              item.number;

            return (
              <div
                key={
                  item.number
                }
                className="flex min-w-0 flex-1 items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-black ${
                      complete
                        ? "border-[#f2b632] bg-[#f2b632] text-[#050607]"
                        : active
                          ? "border-[#f2b632] bg-[#f2b632]/10 text-[#f2b632]"
                          : "border-[#30363a] bg-[#111315] text-[#596066]"
                    }`}
                  >
                    {complete ? (
                      <Check
                        size={15}
                      />
                    ) : (
                      item.number
                    )}
                  </div>

                  <span
                    className={`hidden truncate text-[10px] font-black uppercase tracking-[0.14em] sm:block ${
                      active ||
                      complete
                        ? "text-white"
                        : "text-[#555b60]"
                    }`}
                  >
                    {
                      item.label
                    }
                  </span>
                </div>

                {index <
                  steps.length -
                    1 && (
                  <div
                    className={`mx-3 h-px flex-1 ${
                      complete
                        ? "bg-[#f2b632]/50"
                        : "bg-[#252a2e]"
                    }`}
                  />
                )}
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| COMMON UI
|--------------------------------------------------------------------------
*/

function WizardSectionHeader({
  eyebrow,
  title,
  description,
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f2b632]">
        {eyebrow}
      </p>

      <h2 className="mt-2 text-3xl font-black uppercase tracking-[-0.03em] text-white sm:text-4xl">
        {title}
      </h2>

      {description && (
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#727a80]">
          {description}
        </p>
      )}
    </div>
  );
}

function FieldLabel({
  children,
  optional = false,
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <label className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7d858a]">
        {children}
      </label>

      {optional && (
        <span className="text-[9px] uppercase tracking-wider text-[#454b50]">
          Optional
        </span>
      )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| MATCH MODE SELECTOR
|--------------------------------------------------------------------------
|
| Controller explicitly chooses:
|
| LIVE      -> status = live
| SCHEDULED -> status = scheduled
|
|--------------------------------------------------------------------------
*/

function MatchModeSelector({
  value,
  onChange,
}) {
  const isLive =
    normalizeStatus(
      value
    ) === "live";

  const isScheduled =
    normalizeStatus(
      value
    ) === "scheduled";

  return (
    <div>
      <FieldLabel>
        Match Status
      </FieldLabel>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* LIVE */}

        <button
          type="button"
          onClick={() =>
            onChange("live")
          }
          className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition ${
            isLive
              ? "border-[#ff3b3b]/60 bg-[#ff3b3b]/10 shadow-[0_0_35px_rgba(255,59,59,0.08)]"
              : "border-[#252a2e] bg-[#0b0d0f] hover:border-[#ff3b3b]/40"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                isLive
                  ? "bg-[#ff3b3b] text-white"
                  : "bg-[#171a1d] text-[#777e84] group-hover:text-[#ff6666]"
              }`}
            >
              <Radio
                size={21}
              />
            </div>

            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                isLive
                  ? "border-[#ff3b3b] bg-[#ff3b3b]"
                  : "border-[#3a4146] bg-transparent"
              }`}
            >
              {isLive && (
                <span className="h-2 w-2 rounded-full bg-white" />
              )}
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-black uppercase tracking-wide ${
                  isLive
                    ? "text-[#ff6666]"
                    : "text-white"
                }`}
              >
                Live Now
              </span>

              {isLive && (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff3b3b]" />
              )}
            </div>

            <p className="mt-2 text-xs leading-5 text-[#697278]">
              Create the match directly in the
              Live section. Use this when the
              match is ready to go on air.
            </p>
          </div>
        </button>

        {/* SCHEDULED */}

        <button
          type="button"
          onClick={() =>
            onChange(
              "scheduled"
            )
          }
          className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition ${
            isScheduled
              ? "border-[#f2b632]/60 bg-[#f2b632]/10 shadow-[0_0_35px_rgba(242,182,50,0.06)]"
              : "border-[#252a2e] bg-[#0b0d0f] hover:border-[#f2b632]/40"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                isScheduled
                  ? "bg-[#f2b632] text-[#050607]"
                  : "bg-[#171a1d] text-[#777e84] group-hover:text-[#f2b632]"
              }`}
            >
              <CalendarDays
                size={21}
              />
            </div>

            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                isScheduled
                  ? "border-[#f2b632] bg-[#f2b632]"
                  : "border-[#3a4146] bg-transparent"
              }`}
            >
              {isScheduled && (
                <span className="h-2 w-2 rounded-full bg-[#050607]" />
              )}
            </div>
          </div>

          <div className="mt-5">
            <span
              className={`text-sm font-black uppercase tracking-wide ${
                isScheduled
                  ? "text-[#f2b632]"
                  : "text-white"
              }`}
            >
              Scheduled
            </span>

            <p className="mt-2 text-xs leading-5 text-[#697278]">
              Create the match in the Scheduled
              section. Start it later from Match
              Control when you're ready.
            </p>
          </div>
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#252a2e] bg-[#0b0d0f] px-4 py-3">
        {isLive ? (
          <>
            <Radio
              size={14}
              className="text-[#ff3b3b]"
            />

            <p className="text-[10px] font-bold uppercase tracking-wider text-[#777e84]">
              This match will be created as{" "}
              <span className="text-[#ff6666]">
                LIVE
              </span>
            </p>
          </>
        ) : (
          <>
            <CalendarDays
              size={14}
              className="text-[#f2b632]"
            />

            <p className="text-[10px] font-bold uppercase tracking-wider text-[#777e84]">
              This match will be created as{" "}
              <span className="text-[#f2b632]">
                SCHEDULED
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| MAP SELECTOR
|--------------------------------------------------------------------------
*/

function MapSelector({
  value,
  onChange,
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {MAP_OPTIONS.map(
        (map) => {
          const active =
            value ===
            map.name;

          return (
            <button
              key={map.id}
              type="button"
              onClick={() =>
                onChange(
                  map.name
                )
              }
              className={`relative overflow-hidden rounded-xl border p-4 text-left transition ${
                active
                  ? "border-[#f2b632] bg-[#f2b632]/10"
                  : "border-[#252a2e] bg-[#0b0d0f] hover:border-[#555b60]"
              }`}
            >
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-lg text-xs font-black ${
                  active
                    ? "bg-[#f2b632] text-[#050607]"
                    : "bg-[#171a1d] text-[#737b81]"
                }`}
              >
                {
                  map.short
                }
              </div>

              <p
                className={`mt-3 text-sm font-black ${
                  active
                    ? "text-[#f2b632]"
                    : "text-white"
                }`}
              >
                {
                  map.name
                }
              </p>

              {active && (
                <Check
                  size={15}
                  className="absolute right-3 top-3 text-[#f2b632]"
                />
              )}
            </button>
          );
        }
      )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| SLOT COUNTER
|--------------------------------------------------------------------------
*/

function SlotCounter({
  value,
  onChange,
}) {
  return (
    <div className="flex items-center overflow-hidden rounded-xl border border-[#252a2e] bg-[#0b0d0f]">
      <button
        type="button"
        onClick={() =>
          onChange(
            Math.max(
              1,
              Number(value) - 1
            )
          )
        }
        className="flex h-14 w-14 items-center justify-center text-xl text-[#737b81] transition hover:bg-[#171a1d] hover:text-white"
      >
        −
      </button>

      <div className="flex h-14 min-w-[90px] flex-1 items-center justify-center border-x border-[#252a2e]">
        <span className="text-xl font-black text-white">
          {value}
        </span>
      </div>

      <button
        type="button"
        onClick={() =>
          onChange(
            Number(value) + 1
          )
        }
        className="flex h-14 w-14 items-center justify-center text-xl text-[#737b81] transition hover:bg-[#171a1d] hover:text-white"
      >
        +
      </button>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| STEP 1
|--------------------------------------------------------------------------
*/

function MatchInfoStep({
  form,
  setForm,
  tournaments,
  rounds,
  roundsLoading,
  suggestedMatchNumber,
}) {
  const maxEndingSlot =
    Number(
      form.starting_slot
    ) +
    Number(
      form.total_slots
    ) -
    1;

  function update(
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  function changeTournament(
    tournamentId
  ) {
    setForm(
      (current) => ({
        ...current,
        tournament_id:
          tournamentId,
        round_id: "",
        round: "",
      })
    );
  }

  function changeRound(
    roundId
  ) {
    const round =
      rounds.find(
        (item) =>
          String(
            item.id
          ) ===
          String(
            roundId
          )
      );

    setForm(
      (current) => ({
        ...current,
        round_id:
          roundId,
        round:
          round?.name ||
          round?.round_name ||
          round?.title ||
          "",
      })
    );
  }

  return (
    <div className="space-y-8">
      <WizardSectionHeader
        eyebrow="Step 01 / 03"
        title="Match Info"
        description="Configure the match structure and decide whether this match should be live immediately or remain scheduled."
      />

      {/* MATCH MODE */}

      <MatchModeSelector
        value={
          form.status
        }
        onChange={(value) =>
          update(
            "status",
            value
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <FieldLabel>
            Match Number
          </FieldLabel>

          <div className="flex items-center overflow-hidden rounded-xl border border-[#252a2e] bg-[#0b0d0f]">
            <button
              type="button"
              onClick={() =>
                update(
                  "match_number",
                  Math.max(
                    1,
                    Number(
                      form.match_number
                    ) - 1
                  )
                )
              }
              className="flex h-14 w-14 items-center justify-center text-xl text-[#737b81] hover:bg-[#171a1d] hover:text-white"
            >
              −
            </button>

            <input
              type="number"
              min="1"
              value={
                form.match_number
              }
              onChange={(event) =>
                update(
                  "match_number",
                  Math.max(
                    1,
                    Number(
                      event.target
                        .value ||
                        1
                    )
                  )
                )
              }
              className="h-14 flex-1 border-x border-[#252a2e] bg-transparent text-center text-xl font-black text-white outline-none"
            />

            <button
              type="button"
              onClick={() =>
                update(
                  "match_number",
                  Number(
                    form.match_number
                  ) + 1
                )
              }
              className="flex h-14 w-14 items-center justify-center text-xl text-[#737b81] hover:bg-[#171a1d] hover:text-white"
            >
              +
            </button>
          </div>

          <p className="mt-2 text-[10px] text-[#555d63]">
            Suggested next match:{" "}
            <span className="font-bold text-[#f2b632]">
              #{suggestedMatchNumber}
            </span>
          </p>
        </div>

        <div>
          <FieldLabel>
            Tournament
          </FieldLabel>

          <select
            value={
              form.tournament_id
            }
            onChange={(event) =>
              changeTournament(
                event.target
                  .value
              )
            }
            className="h-14 w-full rounded-xl border border-[#252a2e] bg-[#0b0d0f] px-4 text-sm font-bold text-white outline-none focus:border-[#f2b632]/60"
          >
            <option value="">
              Select Tournament
            </option>

            {tournaments.map(
              (tournament) => (
                <option
                  key={
                    tournament.id
                  }
                  value={
                    tournament.id
                  }
                >
                  {
                    tournament.name
                  }
                </option>
              )
            )}
          </select>
        </div>

        <div>
          <FieldLabel>
            Tournament Round
          </FieldLabel>

          <select
            value={
              form.round_id
            }
            onChange={(event) =>
              changeRound(
                event.target
                  .value
              )
            }
            disabled={
              !form.tournament_id ||
              roundsLoading
            }
            className="h-14 w-full rounded-xl border border-[#252a2e] bg-[#0b0d0f] px-4 text-sm font-bold text-white outline-none disabled:opacity-40"
          >
            <option value="">
              {!form.tournament_id
                ? "Select tournament first"
                : roundsLoading
                  ? "Loading rounds..."
                  : rounds.length ===
                      0
                    ? "No rounds available"
                    : "Select Round"}
            </option>

            {rounds.map(
              (round) => (
                <option
                  key={
                    round.id
                  }
                  value={
                    round.id
                  }
                >
                  {round.name ||
                    round.round_name ||
                    round.title ||
                    "Unnamed Round"}
                </option>
              )
            )}
          </select>

          {form.round && (
            <p className="mt-2 text-[10px] text-[#555d63]">
              Selected:{" "}
              <span className="font-bold text-[#f2b632]">
                {form.round}
              </span>
            </p>
          )}
        </div>

        <div>
          <FieldLabel>
            Total Slots
          </FieldLabel>

          <select
            value={
              form.total_slots
            }
            onChange={(event) =>
              update(
                "total_slots",
                Number(
                  event.target
                    .value
                )
              )
            }
            className="h-14 w-full rounded-xl border border-[#252a2e] bg-[#0b0d0f] px-4 text-sm font-bold text-white outline-none"
          >
            {SLOT_OPTIONS.map(
              (slots) => (
                <option
                  key={slots}
                  value={
                    slots
                  }
                >
                  {slots} Slots
                </option>
              )
            )}
          </select>
        </div>

        <div className="lg:col-span-2">
          <FieldLabel
            optional
          >
            Game
          </FieldLabel>

          <input
            value={
              form.game
            }
            onChange={(event) =>
              update(
                "game",
                event.target
                  .value
              )
            }
            placeholder="BGMI / PUBG Mobile"
            className="h-14 w-full rounded-xl border border-[#252a2e] bg-[#0b0d0f] px-4 text-sm font-semibold text-white outline-none placeholder:text-[#41484d] focus:border-[#f2b632]/50"
          />
        </div>
      </div>

      <div>
        <FieldLabel>
          Battle Map
        </FieldLabel>

        <MapSelector
          value={
            form.map_name
          }
          onChange={(value) =>
            update(
              "map_name",
              value
            )
          }
        />
      </div>

      <div>
        <FieldLabel>
          Starting Slot Number
        </FieldLabel>

        <SlotCounter
          value={
            form.starting_slot
          }
          onChange={(value) =>
            update(
              "starting_slot",
              value
            )
          }
        />

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#252a2e] bg-[#0b0d0f] px-4 py-3">
          <Layers3
            size={15}
            className="text-[#f2b632]"
          />

          <p className="text-xs text-[#727a80]">
            Slots will run from{" "}
            <span className="font-black text-white">
              {
                form.starting_slot
              }
            </span>{" "}
            to{" "}
            <span className="font-black text-[#f2b632]">
              {
                maxEndingSlot
              }
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| TEAM / PLAYER HELPERS
|--------------------------------------------------------------------------
*/

function createEmptySlot(
  slot
) {
  return {
    slot,
    team_name: "",
    team_tag: "",
    logo_url: null,
    players: [],
  };
}

function normalizePlayer(
  player
) {
  if (!player) {
    return {
      gamer_tag: "",
    };
  }

  return {
    id:
      player.id ||
      player.player_id ||
      null,

    gamer_tag:
      player.gamer_tag ||
      player.name ||
      player.username ||
      "",
  };
}

function normalizeSlot(
  slot
) {
  return {
    slot:
      Number(
        slot?.slot
      ) || 1,

    team_name:
      slot?.team_name ||
      slot?.team?.name ||
      "",

    team_tag:
      slot?.team_tag ||
      slot?.team?.short_name ||
      slot?.team?.tag ||
      "",

    logo_url:
      slot?.logo_url ||
      slot?.team?.logo_url ||
      slot?.team?.logo ||
      slot?.team?.team_logo ||
      null,

    players:
      Array.isArray(
        slot?.players
      )
        ? slot.players.map(
            normalizePlayer
          )
        : [],
  };
}

/*
|--------------------------------------------------------------------------
| OPTIONAL TEAM LOGO
|--------------------------------------------------------------------------
|
| Logos are stored on the match-specific slot as logo_url.
| The field is optional. A missing logo is always represented as null.
|
| We resize local image files before converting them to a data URL so
| the match payload stays reasonably small and the logo can be rendered
| directly by the broadcast overlay without requiring a separate upload
| endpoint.
|--------------------------------------------------------------------------
*/

const MAX_LOGO_DIMENSION = 512;
const MAX_LOGO_DATA_URL_LENGTH = 700000;

function readTeamLogoFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    if (!file.type?.startsWith("image/")) {
      reject(
        new Error(
          "Please choose a valid image file for the team logo."
        )
      );
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      reject(
        new Error(
          "Unable to read the selected team logo."
        )
      );
    };

    reader.onload = () => {
      const source = String(
        reader.result || ""
      );

      const image = new Image();

      image.onerror = () => {
        reject(
          new Error(
            "Unable to process the selected team logo."
          )
        );
      };

      image.onload = () => {
        try {
          const width =
            Number(image.naturalWidth) ||
            Number(image.width) ||
            1;

          const height =
            Number(image.naturalHeight) ||
            Number(image.height) ||
            1;

          const scale = Math.min(
            1,
            MAX_LOGO_DIMENSION / width,
            MAX_LOGO_DIMENSION / height
          );

          const canvas =
            document.createElement("canvas");

          canvas.width = Math.max(
            1,
            Math.round(width * scale)
          );

          canvas.height = Math.max(
            1,
            Math.round(height * scale)
          );

          const context =
            canvas.getContext("2d");

          if (!context) {
            resolve(source);
            return;
          }

          context.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
          );

          context.drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height
          );

          const optimized =
            canvas.toDataURL(
              "image/png"
            );

          if (
            optimized.length >
            MAX_LOGO_DATA_URL_LENGTH
          ) {
            const jpeg =
              canvas.toDataURL(
                "image/jpeg",
                0.82
              );

            resolve(
              jpeg.length <
                optimized.length
                ? jpeg
                : optimized
            );
            return;
          }

          resolve(optimized);
        } catch {
          resolve(source);
        }
      };

      image.src = source;
    };

    reader.readAsDataURL(file);
  });
}

function TeamLogoPreview({
  src,
  tag,
  size = "md",
}) {
  const [failed, setFailed] =
    useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const initials =
    String(
      tag || "TEAM"
    )
      .trim()
      .slice(0, 3)
      .toUpperCase() || "TM";

  const dimensions =
    size === "lg"
      ? "h-20 w-20 rounded-2xl text-lg"
      : "h-12 w-12 rounded-xl text-xs";

  if (!src || failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center border border-[#30363a] bg-[#171a1d] font-black text-[#f2b632] ${dimensions}`}
        title={
          src
            ? "Logo unavailable"
            : "No team logo"
        }
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      onError={() =>
        setFailed(true)
      }
      className={`shrink-0 border border-[#30363a] bg-[#070809] object-contain p-1 ${dimensions}`}
    />
  );
}

/*
|--------------------------------------------------------------------------
| TEAM SLOT CARD
|--------------------------------------------------------------------------
*/

function TeamSlotCard({
  slot,
  onAdd,
  onRemove,
}) {
  const occupied =
    Boolean(
      slot.team_name?.trim()
    );

  return (
    <div
      className={`relative rounded-2xl border p-4 transition ${
        occupied
          ? "border-[#f2b632]/30 bg-[#f2b632]/5"
          : "border-[#252a2e] bg-[#0b0d0f]"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-black ${
            occupied
              ? "bg-[#f2b632] text-[#050607]"
              : "bg-[#171a1d] text-[#626a70]"
          }`}
        >
          {String(
            slot.slot
          ).padStart(
            2,
            "0"
          )}
        </div>

        <div className="min-w-0 flex-1">
          {occupied ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <TeamLogoPreview
                    src={slot.logo_url}
                    tag={slot.team_tag}
                  />

                  <div className="min-w-0">
                    <p className="truncate text-sm font-black uppercase text-white">
                      {
                        slot.team_name
                      }
                    </p>

                    <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#f2b632]">
                      {slot.team_tag ||
                        "NO TAG"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onRemove(
                      slot.slot
                    )
                  }
                  className="rounded-lg p-2 text-[#555d63] hover:bg-[#ff3b3b]/10 hover:text-[#ff6666]"
                  title="Clear slot"
                >
                  <Trash2
                    size={15}
                  />
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-[#252a2e] bg-[#070809] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Users
                    size={14}
                    className="text-[#f2b632]"
                  />

                  <span className="text-[10px] font-black uppercase tracking-wider text-[#737b81]">
                    {
                      slot.players
                        .length
                    }{" "}
                    Players
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onAdd(
                      slot.slot
                    )
                  }
                  className="text-[10px] font-black uppercase tracking-wider text-[#f2b632] hover:text-white"
                >
                  Edit Slot
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() =>
                onAdd(
                  slot.slot
                )
              }
              className="flex min-h-[82px] w-full flex-col items-start justify-center text-left"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#555d63]">
                Slot{" "}
                {String(
                  slot.slot
                ).padStart(
                  2,
                  "0"
                )}
              </p>

              <div className="mt-3 inline-flex items-center gap-2 text-sm font-black uppercase text-[#737b81] transition hover:text-[#f2b632]">
                <Plus
                  size={16}
                />
                Add Team
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| TEAM SLOT MODAL
|--------------------------------------------------------------------------
*/

function TeamSlotModal({
  open,
  slotNumber,
  initialSlot,
  onClose,
  onSave,
}) {
  const [
    teamName,
    setTeamName,
  ] = useState("");

  const [
    teamTag,
    setTeamTag,
  ] = useState("");

  const [
    logoUrl,
    setLogoUrl,
  ] = useState(null);

  const [
    logoLoading,
    setLogoLoading,
  ] = useState(false);

  const [
    logoError,
    setLogoError,
  ] = useState("");

  const [
    players,
    setPlayers,
  ] = useState([]);

  const [
    newPlayer,
    setNewPlayer,
  ] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setTeamName(
      initialSlot?.team_name ||
        ""
    );

    setTeamTag(
      initialSlot?.team_tag ||
        ""
    );

    setLogoUrl(
      initialSlot?.logo_url ||
        null
    );

    setLogoError("");
    setLogoLoading(false);

    setPlayers(
      Array.isArray(
        initialSlot?.players
      )
        ? initialSlot.players.map(
            normalizePlayer
          )
        : []
    );

    setNewPlayer("");
  }, [
    open,
    initialSlot,
  ]);

  if (!open) {
    return null;
  }

  async function handleLogoChange(
    event
  ) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      setLogoError("");
      setLogoLoading(true);

      const dataUrl =
        await readTeamLogoFile(
          file
        );

      setLogoUrl(
        dataUrl || null
      );
    } catch (error) {
      setLogoUrl(null);
      setLogoError(
        error?.message ||
          "Unable to add this logo."
      );
    } finally {
      setLogoLoading(false);
    }
  }

  function addPlayer() {
    const value =
      newPlayer.trim();

    if (!value) {
      return;
    }

    setPlayers(
      (current) => [
        ...current,
        {
          gamer_tag:
            value,
        },
      ]
    );

    setNewPlayer("");
  }

  function removePlayer(
    index
  ) {
    setPlayers(
      (current) =>
        current.filter(
          (
            _,
            playerIndex
          ) =>
            playerIndex !==
            index
        )
    );
  }

  function save() {
    if (
      !teamName.trim()
    ) {
      return;
    }

    onSave({
      slot:
        Number(
          slotNumber
        ),

      team_name:
        teamName.trim(),

      team_tag:
        teamTag.trim(),

      logo_url:
        logoUrl || null,

      players:
        players
          .map(
            normalizePlayer
          )
          .filter(
            (player) =>
              player.gamer_tag.trim()
          ),
    });
  }

  return (
    <Overlay>
      <ModalShell
        icon={Users}
        title={`Slot ${String(
          slotNumber
        ).padStart(
          2,
          "0"
        )}`}
        eyebrow="Match Roster"
        onClose={onClose}
      >
        <div className="space-y-6">
          <div>
            <FieldLabel>
              Team Name
            </FieldLabel>

            <input
              autoFocus
              value={
                teamName
              }
              onChange={(event) =>
                setTeamName(
                  event.target
                    .value
                )
              }
              placeholder="Enter team name"
              className="h-13 w-full rounded-xl border border-[#252a2e] bg-[#070809] px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-[#41484d] focus:border-[#f2b632]/50"
            />
          </div>

          <div>
            <FieldLabel
              optional
            >
              Team Tag
            </FieldLabel>

            <input
              value={
                teamTag
              }
              onChange={(event) =>
                setTeamTag(
                  event.target
                    .value
                )
              }
              placeholder="Example: SOUL"
              maxLength={12}
              className="h-13 w-full rounded-xl border border-[#252a2e] bg-[#070809] px-4 py-3 text-sm font-bold uppercase text-white outline-none placeholder:text-[#41484d] focus:border-[#f2b632]/50"
            />
          </div>

          <div>
            <FieldLabel optional>
              Team Logo
            </FieldLabel>

            <div className="flex items-center gap-4 rounded-xl border border-[#252a2e] bg-[#070809] p-4">
              <TeamLogoPreview
                src={logoUrl}
                tag={teamTag}
                size="lg"
              />

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white">
                  {logoUrl
                    ? "Team logo added"
                    : "No logo added"}
                </p>

                <p className="mt-1 text-[10px] leading-5 text-[#555d63]">
                  Optional. PNG, JPG, WEBP or another
                  browser-supported image can be used.
                  If no logo is added, the team will still
                  work normally.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#f2b632]/30 bg-[#f2b632]/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#f2b632] hover:bg-[#f2b632]/15">
                    {logoLoading ? (
                      <Loader2
                        size={13}
                        className="animate-spin"
                      />
                    ) : (
                      <Upload size={13} />
                    )}

                    {logoLoading
                      ? "Processing..."
                      : logoUrl
                        ? "Change Logo"
                        : "Add Logo"}

                    <input
                      type="file"
                      accept="image/*"
                      onChange={
                        handleLogoChange
                      }
                      disabled={logoLoading}
                      className="hidden"
                    />
                  </label>

                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoUrl(null);
                        setLogoError("");
                      }}
                      disabled={logoLoading}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#252a2e] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#737b81] hover:border-[#ff3b3b]/30 hover:text-[#ff6666]"
                    >
                      <Trash2 size={13} />
                      Remove
                    </button>
                  )}
                </div>

                {logoError && (
                  <p className="mt-2 text-[10px] font-bold text-[#ff6666]">
                    {logoError}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#f2b632]">
                  Players
                </p>

                <p className="mt-1 text-xs text-[#555d63]">
                  Match-specific player lineup
                </p>
              </div>

              <span className="text-[10px] font-black uppercase tracking-wider text-[#697278]">
                {
                  players.length
                }{" "}
                Added
              </span>
            </div>

            <div className="space-y-2">
              {players.map(
                (
                  player,
                  index
                ) => (
                  <div
                    key={`${player.gamer_tag}-${index}`}
                    className="flex items-center gap-3 rounded-xl border border-[#252a2e] bg-[#070809] px-3 py-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#171a1d] font-mono text-[10px] font-black text-[#f2b632]">
                      {String(
                        index + 1
                      ).padStart(
                        2,
                        "0"
                      )}
                    </div>

                    <p className="min-w-0 flex-1 truncate text-sm font-bold text-white">
                      {
                        player.gamer_tag
                      }
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        removePlayer(
                          index
                        )
                      }
                      className="rounded-lg p-2 text-[#555d63] hover:bg-[#ff3b3b]/10 hover:text-[#ff6666]"
                    >
                      <X
                        size={14}
                      />
                    </button>
                  </div>
                )
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={
                  newPlayer
                }
                onChange={(event) =>
                  setNewPlayer(
                    event.target
                      .value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    event.preventDefault();
                    addPlayer();
                  }
                }}
                placeholder="Enter gamer tag"
                className="h-11 flex-1 rounded-xl border border-[#252a2e] bg-[#070809] px-4 text-sm font-semibold text-white outline-none placeholder:text-[#41484d]"
              />

              <button
                type="button"
                onClick={
                  addPlayer
                }
                disabled={
                  !newPlayer.trim()
                }
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#f2b632]/30 bg-[#f2b632]/10 px-4 text-xs font-black uppercase tracking-wider text-[#f2b632] disabled:opacity-30"
              >
                <UserPlus
                  size={15}
                />
                Add
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[#252a2e] bg-[#070809] px-4 py-3">
            <p className="text-xs leading-5 text-[#697278]">
              This roster belongs to this match
              only. The same team can be used in
              another match with a different player
              lineup.
            </p>
          </div>

          <ModalActions
            onCancel={
              onClose
            }
            onConfirm={
              save
            }
            confirmLabel="Save Slot"
            disabled={
              !teamName.trim()
            }
          />
        </div>
      </ModalShell>
    </Overlay>
  );
}

/*
|--------------------------------------------------------------------------
| IMPORT SOURCE CARD
|--------------------------------------------------------------------------
*/

function TeamSourceCard({
  icon: Icon,
  title,
  description,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-[#252a2e] bg-[#0b0d0f] p-5 text-left transition hover:border-[#f2b632]/50"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2b632]/10 text-[#f2b632]">
          <Icon
            size={20}
          />
        </div>

        <ChevronRight
          size={17}
          className="text-[#42484d] transition group-hover:translate-x-1 group-hover:text-white"
        />
      </div>

      <h3 className="mt-5 text-sm font-black uppercase tracking-wide text-white">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-5 text-[#626a70]">
        {description}
      </p>
    </button>
  );
}

/*
|--------------------------------------------------------------------------
| STEP 2
|--------------------------------------------------------------------------
*/

function TeamsStep({
  form,
  setForm,
  onAddSlot,
  onPaste,
  onCsv,
  onCopy,
}) {
  const filledSlots =
    form.team_slots.filter(
      (slot) =>
        slot.team_name?.trim()
    ).length;

  const slots =
    Array.from(
      {
        length:
          Number(
            form.total_slots
          ),
      },
      (_, index) =>
        Number(
          form.starting_slot
        ) + index
    );

  function removeSlot(
    slotNumber
  ) {
    setForm(
      (current) => ({
        ...current,

        team_slots:
          current.team_slots.filter(
            (slot) =>
              Number(
                slot.slot
              ) !==
              Number(
                slotNumber
              )
          ),
      })
    );
  }

  return (
    <div className="space-y-8">
      <WizardSectionHeader
        eyebrow="Step 02 / 03"
        title="Add Teams"
        description="Assign a team and its match-specific player lineup to any slot. Empty slots are allowed."
      />

      <div className="flex flex-col justify-between gap-5 rounded-2xl border border-[#252a2e] bg-[#0b0d0f] p-5 md:flex-row md:items-center">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#f2b632]">
            Slot Assignment
          </p>

          <p className="mt-2 text-2xl font-black text-white">
            {filledSlots}

            <span className="mx-2 text-[#41484d]">
              /
            </span>

            {
              form.total_slots
            }

            <span className="ml-2 text-sm font-bold text-[#646d73]">
              slots filled
            </span>
          </p>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-[#191d20] md:w-72">
          <div
            className="h-full rounded-full bg-[#f2b632] transition-all"
            style={{
              width: `${Math.min(
                100,
                (filledSlots /
                  Number(
                    form.total_slots
                  )) *
                  100
              )}%`,
            }}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <TeamSourceCard
          icon={
            ClipboardPaste
          }
          title="Paste From List"
          description="Quickly fill consecutive team slots"
          onClick={onPaste}
        />

        <TeamSourceCard
          icon={
            FileSpreadsheet
          }
          title="CSV Upload"
          description="Import teams and optional players"
          onClick={onCsv}
        />

        <TeamSourceCard
          icon={Copy}
          title="Copy From Match"
          description="Copy a previous match roster"
          onClick={onCopy}
        />

        <TeamSourceCard
          icon={Plus}
          title="Manual Entry"
          description="Add a team directly to a slot"
          onClick={() =>
            onAddSlot(
              slots.find(
                (slot) =>
                  !form.team_slots.some(
                    (item) =>
                      Number(
                        item.slot
                      ) ===
                      Number(
                        slot
                      )
                  )
              ) ||
                slots[0]
            )
          }
        />
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#697278]">
              Match Slots
            </p>

            <p className="mt-1 text-xs text-[#555d63]">
              Click an empty slot to assign a team.
            </p>
          </div>

          <span className="rounded-full border border-[#252a2e] bg-[#0b0d0f] px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-[#697278]">
            {
              form.total_slots
            }{" "}
            Slots
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {slots.map(
            (slotNumber) => {
              const existing =
                form.team_slots.find(
                  (item) =>
                    Number(
                      item.slot
                    ) ===
                    Number(
                      slotNumber
                    )
                );

              return (
                <TeamSlotCard
                  key={
                    slotNumber
                  }
                  slot={
                    existing ||
                    createEmptySlot(
                      slotNumber
                    )
                  }
                  onAdd={
                    onAddSlot
                  }
                  onRemove={
                    removeSlot
                  }
                />
              );
            }
          )}
        </div>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| PASTE MODAL
|--------------------------------------------------------------------------
*/

function PasteTeamsModal({
  open,
  onClose,
  onProcess,
}) {
  const [
    value,
    setValue,
  ] = useState("");

  if (!open) {
    return null;
  }

  return (
    <Overlay>
      <ModalShell
        icon={
          ClipboardPaste
        }
        title="Paste Team List"
        eyebrow="Quick Assignment"
        onClose={onClose}
      >
        <p className="text-xs leading-5 text-[#697278]">
          One team per line. Teams will be assigned
          to the next available slots.
        </p>

        <div className="mt-3 rounded-xl border border-[#252a2e] bg-[#070809] p-4 font-mono text-xs leading-6 text-[#858d92]">
          Soul
          <br />
          GodLike
          <br />
          Entity
        </div>

        <textarea
          value={value}
          onChange={(event) =>
            setValue(
              event.target
                .value
            )
          }
          placeholder={`Soul
GodLike
Entity`}
          className="mt-4 min-h-[220px] w-full resize-none rounded-xl border border-[#252a2e] bg-[#070809] p-4 text-sm font-semibold text-white outline-none placeholder:text-[#41484d]"
        />

        <ModalActions
          onCancel={
            onClose
          }
          onConfirm={() => {
            onProcess(
              value
            );
            setValue("");
          }}
          confirmLabel="Process"
          disabled={
            !value.trim()
          }
        />
      </ModalShell>
    </Overlay>
  );
}

/*
|--------------------------------------------------------------------------
| CSV MODAL
|--------------------------------------------------------------------------
*/

function CsvTeamsModal({
  open,
  onClose,
  onImport,
}) {
  const [
    fileName,
    setFileName,
  ] = useState("");

  const [
    rows,
    setRows,
  ] = useState("");

  if (!open) {
    return null;
  }

  function handleFile(
    event
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setFileName(
      file.name
    );

    const reader =
      new FileReader();

    reader.onload = () =>
      setRows(
        String(
          reader.result ||
            ""
        )
      );

    reader.readAsText(
      file
    );
  }

  return (
    <Overlay>
      <ModalShell
        icon={
          FileSpreadsheet
        }
        title="CSV Import"
        eyebrow="Match Roster"
        onClose={onClose}
      >
        <div className="rounded-xl border border-[#252a2e] bg-[#070809] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#697278]">
            Supported Format
          </p>

          <p className="mt-3 font-mono text-xs leading-6 text-[#858d92]">
            Team Name, Tag, Player 1, Player 2,
            Player 3, Player 4
            <br />
            Soul, SOUL, Mortal, Aman, Viper, Ronak
            <br />
            Entity, ENT, PlayerA, PlayerB, PlayerC,
            PlayerD
          </p>
        </div>

        <label className="mt-4 flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-[#30363a] bg-[#070809] px-5 py-8 text-sm font-bold text-[#737b81] hover:border-[#f2b632]/50 hover:text-white">
          <Upload
            size={19}
            className="text-[#f2b632]"
          />

          {fileName ||
            "Choose CSV File"}

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={
              handleFile
            }
            className="hidden"
          />
        </label>

        <textarea
          value={rows}
          onChange={(event) =>
            setRows(
              event.target
                .value
            )
          }
          placeholder="Or paste CSV content here..."
          className="mt-4 min-h-[180px] w-full resize-none rounded-xl border border-[#252a2e] bg-[#070809] p-4 font-mono text-xs text-white outline-none"
        />

        <ModalActions
          onCancel={
            onClose
          }
          onConfirm={() =>
            onImport(
              rows
            )
          }
          confirmLabel="Import"
          disabled={
            !rows.trim()
          }
        />
      </ModalShell>
    </Overlay>
  );
}

/*
|--------------------------------------------------------------------------
| COPY MATCH MODAL
|--------------------------------------------------------------------------
*/

function CopyMatchModal({
  open,
  onClose,
  matches,
  onCopy,
}) {
  const [
    selectedId,
    setSelectedId,
  ] = useState("");

  const [
    loadingId,
    setLoadingId,
  ] = useState("");

  if (!open) {
    return null;
  }

  const sourceMatches =
    matches.filter(
      (match) =>
        getMatchTeams(
          match
        ).length > 0 ||
        getSlotTeams(
          match
        ).length > 0
    );

  async function copy() {
    if (!selectedId) {
      return;
    }

    try {
      setLoadingId(
        selectedId
      );

      let match =
        matches.find(
          (item) =>
            String(
              item.id
            ) ===
            String(
              selectedId
            )
        );

      try {
        const full =
          await getMatch(
            selectedId
          );

        if (full) {
          match =
            full;
        }
      } catch (error) {
        console.warn(
          "MWOPS - Could not load complete source match:",
          error
        );
      }

      onCopy(
        match
      );
    } finally {
      setLoadingId("");
    }
  }

  return (
    <Overlay>
      <ModalShell
        icon={Copy}
        title="Copy From Match"
        eyebrow="Reuse Existing Roster"
        onClose={onClose}
      >
        {sourceMatches.length ===
        0 ? (
          <div className="rounded-xl border border-dashed border-[#30363a] px-5 py-10 text-center">
            <Users
              size={25}
              className="mx-auto text-[#454c51]"
            />

            <p className="mt-3 text-sm font-bold text-[#697278]">
              No matches with assigned teams
            </p>
          </div>
        ) : (
          <div className="max-h-[350px] space-y-2 overflow-y-auto">
            {sourceMatches.map(
              (match) => {
                const active =
                  String(
                    selectedId
                  ) ===
                  String(
                    match.id
                  );

                const roster =
                  getSlotTeams(
                    match
                  );

                const count =
                  roster.length ||
                  getMatchTeams(
                    match
                  ).length;

                return (
                  <button
                    key={
                      match.id
                    }
                    type="button"
                    onClick={() =>
                      setSelectedId(
                        match.id
                      )
                    }
                    className={`w-full rounded-xl border p-4 text-left ${
                      active
                        ? "border-[#f2b632]/50 bg-[#f2b632]/10"
                        : "border-[#252a2e] bg-[#0b0d0f]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-black text-white">
                          {match.name ||
                            "Match"}
                        </p>

                        <p className="mt-1 text-xs text-[#626a70]">
                          {count} assigned
                          slots
                        </p>
                      </div>

                      {active && (
                        <Check
                          size={18}
                          className="text-[#f2b632]"
                        />
                      )}
                    </div>
                  </button>
                );
              }
            )}
          </div>
        )}

        <ModalActions
          onCancel={
            onClose
          }
          onConfirm={
            copy
          }
          confirmLabel={
            loadingId
              ? "Loading..."
              : "Copy Roster"
          }
          disabled={
            !selectedId ||
            Boolean(
              loadingId
            )
          }
        />
      </ModalShell>
    </Overlay>
  );
}

/*
|--------------------------------------------------------------------------
| COMMON MODAL
|--------------------------------------------------------------------------
*/

function Overlay({
  children,
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      {children}
    </div>
  );
}

function ModalShell({
  icon: Icon,
  title,
  eyebrow,
  onClose,
  children,
}) {
  return (
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#30363a] bg-[#0b0d0f] shadow-[0_30px_120px_rgba(0,0,0,0.7)]">
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#252a2e] bg-[#0b0d0f] px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2b632]/10 text-[#f2b632]">
            <Icon
              size={19}
            />
          </div>

          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#f2b632]">
              {eyebrow}
            </p>

            <h2 className="mt-1 text-lg font-black text-white">
              {title}
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-[#697278] hover:bg-[#171a1d] hover:text-white"
        >
          <X
            size={18}
          />
        </button>
      </div>

      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel,
  disabled,
}) {
  return (
    <div className="mt-6 flex justify-end gap-3">
      <button
        type="button"
        onClick={
          onCancel
        }
        className="rounded-xl border border-[#252a2e] px-5 py-3 text-xs font-black uppercase tracking-wider text-[#747d83] hover:border-[#555b60] hover:text-white"
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={
          onConfirm
        }
        disabled={
          disabled
        }
        className="rounded-xl bg-[#f2b632] px-5 py-3 text-xs font-black uppercase tracking-wider text-[#050607] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {confirmLabel}
      </button>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| REVIEW
|--------------------------------------------------------------------------
*/

function ReviewStat({
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-[#252a2e] bg-[#0b0d0f] p-5">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#555d63]">
        {label}
      </p>

      <p className="mt-3 truncate text-lg font-black text-white">
        {value}
      </p>
    </div>
  );
}

function ReviewStep({
  form,
  tournament,
  onRemoveSlot,
}) {
  const endingSlot =
    Number(
      form.starting_slot
    ) +
    Number(
      form.total_slots
    ) -
    1;

  const assigned =
    form.team_slots
      .filter(
        (slot) =>
          slot.team_name?.trim()
      )
      .sort(
        (a, b) =>
          Number(a.slot) -
          Number(b.slot)
      );

  const isLive =
    normalizeStatus(
      form.status
    ) === "live";

  return (
    <div className="space-y-8">
      <WizardSectionHeader
        eyebrow="Step 03 / 03"
        title="Review Match"
        description="Verify the match configuration and slot roster before creating the match."
      />

      {/* STATUS REVIEW */}

      <div
        className={`rounded-2xl border p-5 ${
          isLive
            ? "border-[#ff3b3b]/30 bg-[#ff3b3b]/5"
            : "border-[#f2b632]/25 bg-[#f2b632]/5"
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${
              isLive
                ? "bg-[#ff3b3b] text-white"
                : "bg-[#f2b632] text-[#050607]"
            }`}
          >
            {isLive ? (
              <Radio
                size={19}
              />
            ) : (
              <CalendarDays
                size={19}
              />
            )}
          </div>

          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#697278]">
              Creation Status
            </p>

            <div className="mt-1 flex items-center gap-2">
              <p
                className={`text-lg font-black uppercase ${
                  isLive
                    ? "text-[#ff6666]"
                    : "text-[#f2b632]"
                }`}
              >
                {isLive
                  ? "Live Now"
                  : "Scheduled"}
              </p>

              {isLive && (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff3b3b]" />
              )}
            </div>

            <p className="mt-1 text-xs text-[#697278]">
              {isLive
                ? "This match will immediately appear in the Live section."
                : "This match will appear in the Scheduled section until started."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <ReviewStat
          label="Match"
          value={`#${form.match_number}`}
        />

        <ReviewStat
          label="Game"
          value={
            form.game ||
            tournament?.game ||
            "Not specified"
          }
        />

        <ReviewStat
          label="Map"
          value={
            form.map_name
          }
        />

        <ReviewStat
          label="Slots"
          value={`${form.total_slots}`}
        />

        <ReviewStat
          label="Assigned"
          value={`${assigned.length}`}
        />
      </div>

      <div className="rounded-2xl border border-[#252a2e] bg-[#0b0d0f] p-6">
        <div className="flex items-center gap-3">
          <Trophy
            size={18}
            className="text-[#f2b632]"
          />

          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#f2b632]">
            Competition
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-[#555d63]">
              Tournament
            </p>

            <p className="mt-2 text-sm font-black text-white">
              {tournament?.name ||
                "Not selected"}
            </p>
          </div>

          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-[#555d63]">
              Round
            </p>

            <p className="mt-2 text-sm font-black text-white">
              {form.round ||
                "Not selected"}
            </p>
          </div>

          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-[#555d63]">
              Slot Range
            </p>

            <p className="mt-2 text-sm font-black text-white">
              {form.starting_slot}
              {" — "}
              {endingSlot}
            </p>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#f2b632]">
              Assigned Roster
            </p>

            <p className="mt-1 text-xs text-[#555d63]">
              Empty slots will remain unassigned.
            </p>
          </div>

          <span className="rounded-full border border-[#f2b632]/20 bg-[#f2b632]/5 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-[#f2b632]">
            {assigned.length} Teams
          </span>
        </div>

        {assigned.length ===
        0 ? (
          <div className="rounded-2xl border border-dashed border-[#f2b632]/30 bg-[#f2b632]/5 px-6 py-10 text-center">
            <Users
              size={25}
              className="mx-auto text-[#f2b632]"
            />

            <p className="mt-3 text-sm font-bold text-[#f2b632]">
              No teams assigned
            </p>

            <p className="mt-2 text-xs text-[#697278]">
              You can still go back and assign
              teams to individual slots.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {assigned.map(
              (slot) => (
                <div
                  key={
                    slot.slot
                  }
                  className="rounded-xl border border-[#252a2e] bg-[#0b0d0f] p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#171a1d] font-mono text-xs font-black text-[#f2b632]">
                      {String(
                        slot.slot
                      ).padStart(
                        2,
                        "0"
                      )}
                    </div>

                    <TeamLogoPreview
                      src={slot.logo_url}
                      tag={slot.team_tag}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-black uppercase text-white">
                            {
                              slot.team_name
                            }
                          </p>

                          <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-[#f2b632]">
                            {slot.team_tag ||
                              "NO TAG"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            onRemoveSlot(
                              slot.slot
                            )
                          }
                          className="rounded-lg p-2 text-[#555d63] hover:bg-[#ff3b3b]/10 hover:text-[#ff6666]"
                        >
                          <X
                            size={14}
                          />
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {slot.players
                          .length ===
                        0 ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#555d63]">
                            No players added
                          </span>
                        ) : (
                          slot.players.map(
                            (
                              player,
                              index
                            ) => (
                              <span
                                key={`${player.gamer_tag}-${index}`}
                                className="rounded-lg border border-[#252a2e] bg-[#070809] px-3 py-1.5 text-[10px] font-bold text-[#92979d]"
                              >
                                {
                                  player.gamer_tag
                                }
                              </span>
                            )
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| QUICK MATCH SETUP
|--------------------------------------------------------------------------
*/

function QuickMatchSetup({
  open,
  onClose,
  onCreated,
  tournaments,
  matches,
  initialTournamentId,
  initialRoundId,
}) {
  const [
    step,
    setStep,
  ] = useState(1);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    rounds,
    setRounds,
  ] = useState([]);

  const [
    roundsLoading,
    setRoundsLoading,
  ] = useState(false);

  const [
    sourceModal,
    setSourceModal,
  ] = useState("");

  const [
    slotModal,
    setSlotModal,
  ] = useState({
    open: false,
    slot: null,
  });

  const [
    form,
    setForm,
  ] = useState(
    initialForm
  );

  /*
  |--------------------------------------------------------------------------
  | RESET
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!open) {
      return;
    }

    const highest =
      matches.reduce(
        (
          max,
          match
        ) =>
          Math.max(
            max,
            getMatchNumber(
              match
            )
          ),
        0
      );

    setStep(1);
    setSaving(false);
    setError("");

    setForm({
      ...initialForm,

      tournament_id:
        initialTournamentId ||
        "",

      round_id:
        initialRoundId ||
        "",

      match_number:
        highest + 1,

      /*
      |--------------------------------------------------------------------------
      | Always default new matches to scheduled.
      | Controller can explicitly switch to LIVE.
      |--------------------------------------------------------------------------
      */

      status: "scheduled",

      team_slots: [],
    });

    setSlotModal({
      open: false,
      slot: null,
    });
  }, [
    open,
    initialTournamentId,
    initialRoundId,
  ]);

  /*
  |--------------------------------------------------------------------------
  | LOAD ROUNDS
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      !open ||
      !form.tournament_id
    ) {
      setRounds([]);
      return;
    }

    let cancelled =
      false;

    async function loadRounds() {
      try {
        setRoundsLoading(
          true
        );

        const response =
          await request(
            `/tournaments/${encodeURIComponent(
              form.tournament_id
            )}/rounds`
          );

        const list =
          Array.isArray(
            response
          )
            ? response
            : Array.isArray(
                  response?.data
                )
              ? response.data
              : [];

        if (
          cancelled
        ) {
          return;
        }

        setRounds(
          list
        );

        if (
          form.round_id
        ) {
          const selected =
            list.find(
              (round) =>
                String(
                  round.id
                ) ===
                String(
                  form.round_id
                )
            );

          if (
            selected
          ) {
            setForm(
              (current) => ({
                ...current,
                round:
                  selected.name ||
                  selected.round_name ||
                  selected.title ||
                  "",
              })
            );
          }
        }
      } catch (err) {
        if (
          !cancelled
        ) {
          setRounds([]);
          setError(
            err?.message ||
              "Unable to load tournament rounds."
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setRoundsLoading(
            false
          );
        }
      }
    }

    loadRounds();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    form.tournament_id,
  ]);

  const selectedTournament =
    tournaments.find(
      (item) =>
        String(
          item.id
        ) ===
        String(
          form.tournament_id
        )
    );

  /*
  |--------------------------------------------------------------------------
  | SLOT MODAL
  |--------------------------------------------------------------------------
  */

  function openSlot(
    slotNumber
  ) {
    const existing =
      form.team_slots.find(
        (slot) =>
          Number(
            slot.slot
          ) ===
          Number(
            slotNumber
          )
      );

    setSlotModal({
      open: true,
      slot:
        existing ||
        createEmptySlot(
          slotNumber
        ),
    });
  }

  function saveSlot(
    slot
  ) {
    setForm(
      (current) => {
        const remaining =
          current.team_slots.filter(
            (item) =>
              Number(
                item.slot
              ) !==
              Number(
                slot.slot
              )
          );

        return {
          ...current,

          team_slots: [
            ...remaining,
            normalizeSlot(
              slot
            ),
          ].sort(
            (a, b) =>
              Number(
                a.slot
              ) -
              Number(
                b.slot
              )
          ),
        };
      }
    );

    setSlotModal({
      open: false,
      slot: null,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | NEXT
  |--------------------------------------------------------------------------
  */

  function nextStep() {
    setError("");

    if (
      step === 1
    ) {
      if (
        !form.tournament_id
      ) {
        setError(
          "Please select a tournament."
        );
        return;
      }

      if (
        !form.round_id
      ) {
        setError(
          "Please select a tournament round."
        );
        return;
      }

      if (
        !form.match_number ||
        Number(
          form.match_number
        ) < 1
      ) {
        setError(
          "Please enter a valid match number."
        );
        return;
      }

      const selectedRound =
        rounds.find(
          (round) =>
            String(
              round.id
            ) ===
            String(
              form.round_id
            )
        );

      if (
        !selectedRound
      ) {
        setError(
          "Selected tournament round could not be found."
        );
        return;
      }

      /*
      |--------------------------------------------------------------------------
      | Validate explicit match mode
      |--------------------------------------------------------------------------
      */

      const selectedStatus =
        normalizeStatus(
          form.status
        );

      if (
        selectedStatus !==
          "live" &&
        selectedStatus !==
          "scheduled"
      ) {
        setError(
          "Please choose whether this match should be Live or Scheduled."
        );
        return;
      }

      setForm(
        (current) => ({
          ...current,
          status:
            selectedStatus,
          round:
            selectedRound.name ||
            selectedRound.round_name ||
            selectedRound.title ||
            "",
        })
      );

      setStep(2);
      return;
    }

    if (
      step === 2
    ) {
      /*
      |--------------------------------------------------------------------------
      | Teams are optional.
      |
      | Empty slots are allowed.
      |--------------------------------------------------------------------------
      */

      setStep(3);
    }
  }

  function previousStep() {
    setError("");

    setStep(
      (current) =>
        Math.max(
          1,
          current - 1
        )
    );
  }

  /*
  |--------------------------------------------------------------------------
  | PASTE
  |--------------------------------------------------------------------------
  */

  function processPaste(
    value
  ) {
    const lines =
      String(
        value || ""
      )
        .split(/\r?\n/)
        .map(
          (line) =>
            line
              .replace(
                /^\s*\d+\s*[\.\-:]\s*/,
                ""
              )
              .trim()
        )
        .filter(Boolean);

    if (
      lines.length ===
      0
    ) {
      return;
    }

    const slotNumbers =
      Array.from(
        {
          length:
            Number(
              form.total_slots
            ),
        },
        (_, index) =>
          Number(
            form.starting_slot
          ) + index
      );

    const existing =
      [...form.team_slots];

    lines.forEach(
      (
        line,
        index
      ) => {
        if (
          !slotNumbers[
            index
          ]
        ) {
          return;
        }

        let name =
          line;

        let tag = "";

        const parts =
          line
            .split(",")
            .map(
              (item) =>
                item.trim()
            );

        if (
          parts.length >
          1
        ) {
          name =
            parts[0];

          tag =
            parts[1];
        }

        const slot =
          slotNumbers[
            index
          ];

        const item = {
          slot,
          team_name:
            name,
          team_tag:
            tag,
          logo_url: null,
          players: [],
        };

        const position =
          existing.findIndex(
            (entry) =>
              Number(
                entry.slot
              ) ===
              Number(
                slot
              )
          );

        if (
          position ===
          -1
        ) {
          existing.push(
            item
          );
        } else {
          existing[
            position
          ] = item;
        }
      }
    );

    setForm(
      (current) => ({
        ...current,

        team_slots:
          existing
            .filter(
              (slot) =>
                slot.slot >=
                  Number(
                    current.starting_slot
                  ) &&
                slot.slot <
                  Number(
                    current.starting_slot
                  ) +
                    Number(
                      current.total_slots
                    )
            )
            .sort(
              (a, b) =>
                Number(
                  a.slot
                ) -
                Number(
                  b.slot
                )
            ),
      })
    );

    setSourceModal("");
  }

  /*
  |--------------------------------------------------------------------------
  | CSV
  |--------------------------------------------------------------------------
  */

  function importCsv(
    value
  ) {
    const lines =
      String(
        value || ""
      )
        .split(/\r?\n/)
        .map(
          (line) =>
            line.trim()
        )
        .filter(Boolean);

    if (
      lines.length ===
      0
    ) {
      return;
    }

    const header =
      lines[0]
        .toLowerCase();

    const start =
      header.includes(
        "team"
      )
        ? 1
        : 0;

    const slotNumbers =
      Array.from(
        {
          length:
            Number(
              form.total_slots
            ),
        },
        (_, index) =>
          Number(
            form.starting_slot
          ) + index
      );

    const imported =
      lines
        .slice(start)
        .map(
          (line) =>
            line
              .split(",")
              .map(
                (value) =>
                  value
                    .trim()
                    .replace(
                      /^"|"$/g,
                      ""
                    )
              )
        )
        .filter(
          (parts) =>
            parts[0]
        );

    const teamSlots =
      imported
        .slice(
          0,
          slotNumbers.length
        )
        .map(
          (
            parts,
            index
          ) => ({
            slot:
              slotNumbers[
                index
              ],

            team_name:
              parts[0] || "",

            team_tag:
              parts[1] || "",

            logo_url: null,

            players:
              parts
                .slice(
                  2
                )
                .filter(
                  Boolean
                )
                .map(
                  (
                    gamerTag
                  ) => ({
                    gamer_tag:
                      gamerTag,
                  })
                ),
          })
        );

    setForm(
      (current) => ({
        ...current,
        team_slots:
          teamSlots,
      })
    );

    setSourceModal("");
  }

  /*
  |--------------------------------------------------------------------------
  | COPY MATCH
  |--------------------------------------------------------------------------
  */

  function copyFromMatch(
    match
  ) {
    if (!match) {
      return;
    }

    const source =
      getSlotTeams(
        match
      );

    let copied =
      source;

    if (
      copied.length ===
      0
    ) {
      copied =
        getMatchTeams(
          match
        ).map(
          (
            team,
            index
          ) => ({
            slot:
              Number(
                form.starting_slot
              ) + index,

            team_name:
              getTeamName(
                team
              ),

            team_tag:
              getTeamTag(
                team
              ),

            logo_url:
              team?.logo_url ||
              team?.logo ||
              team?.team_logo ||
              null,

            players: [],
          })
        );
    }

    const max =
      Number(
        form.total_slots
      );

    const copiedSlots =
      copied
        .slice(
          0,
          max
        )
        .map(
          (
            item,
            index
          ) => ({
            slot:
              Number(
                form.starting_slot
              ) +
              index,

            team_name:
              getTeamName(
                item.team ||
                  item
              ),

            team_tag:
              getTeamTag(
                item.team ||
                  item
              ),

            logo_url:
              item?.logo_url ||
              item?.team?.logo_url ||
              item?.team?.logo ||
              item?.team?.team_logo ||
              null,

            players:
              Array.isArray(
                item.players
              )
                ? item.players.map(
                    normalizePlayer
                  )
                : [],
          })
        );

    setForm(
      (current) => ({
        ...current,
        team_slots:
          copiedSlots,
      })
    );

    setSourceModal("");
  }

  /*
  |--------------------------------------------------------------------------
  | CREATE
  |--------------------------------------------------------------------------
  */

  async function submitMatch() {
    if (saving) {
      return;
    }

    setError("");

    if (
      !form.tournament_id
    ) {
      setError(
        "Tournament ID is required."
      );
      setStep(1);
      return;
    }

    if (
      !form.round_id
    ) {
      setError(
        "Tournament round is required."
      );
      setStep(1);
      return;
    }

    const selectedRound =
      rounds.find(
        (round) =>
          String(
            round.id
          ) ===
          String(
            form.round_id
          )
      );

    if (
      !selectedRound
    ) {
      setError(
        "The selected tournament round no longer exists."
      );
      setStep(1);
      return;
    }

    const roundName =
      selectedRound.name ||
      selectedRound.round_name ||
      selectedRound.title ||
      form.round;

    if (!roundName) {
      setError(
        "Selected tournament round has no valid name."
      );
      setStep(1);
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | VALIDATE MATCH STATUS
    |--------------------------------------------------------------------------
    */

    const selectedStatus =
      normalizeStatus(
        form.status
      );

    if (
      selectedStatus !==
        "live" &&
      selectedStatus !==
        "scheduled"
    ) {
      setError(
        "Please choose Live or Scheduled before creating the match."
      );
      setStep(1);
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | BUILD SLOT PAYLOAD
    |--------------------------------------------------------------------------
    |
    | Empty slots are intentionally omitted.
    |
    */

    const teamSlots =
      form.team_slots
        .filter(
          (slot) =>
            slot?.team_name?.trim()
        )
        .map(
          (slot) => ({
            slot:
              Number(
                slot.slot
              ),

            team_name:
              slot.team_name.trim(),

            team_tag:
              slot.team_tag?.trim() ||
              "",

            logo_url:
              slot.logo_url ||
              null,

            players:
              Array.isArray(
                slot.players
              )
                ? slot.players
                    .map(
                      normalizePlayer
                    )
                    .filter(
                      (player) =>
                        player.gamer_tag.trim()
                    )
                    .map(
                      (player) => ({
                        ...(player.id
                          ? {
                              player_id:
                                player.id,
                            }
                          : {}),
                        gamer_tag:
                          player.gamer_tag.trim(),
                      })
                    )
                : [],
          })
        );

    /*
    |--------------------------------------------------------------------------
    | Validate duplicate slots
    |--------------------------------------------------------------------------
    */

    const slotIds =
      teamSlots.map(
        (item) =>
          item.slot
      );

    if (
      new Set(
        slotIds
      ).size !==
      slotIds.length
    ) {
      setError(
        "Duplicate slot assignments detected."
      );
      setStep(2);
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | FINAL CREATE PAYLOAD
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    |
    | The user's Live / Scheduled selection is
    | now sent directly to the backend.
    |
    */

    const payload = {
      tournament_id:
        form.tournament_id,

      round_id:
        form.round_id,

      name:
        `Match #${Number(
          form.match_number
        )}`,

      game:
        form.game?.trim() ||
        selectedTournament?.game ||
        null,

      map:
        form.map_name ||
        null,

      /*
      |--------------------------------------------------------------------------
      | USER SELECTED STATUS
      |--------------------------------------------------------------------------
      */

      status:
        selectedStatus,

      /*
      |--------------------------------------------------------------------------
      | Scheduled matches do not have a
      | scheduled timestamp yet because the
      | current UI does not collect a date/time.
      |
      | The distinction is status-driven.
      |--------------------------------------------------------------------------
      */

      scheduled_at:
        null,

      team_slots:
        teamSlots,
    };

    console.log(
      "MWOPS - CREATE MATCH PAYLOAD:",
      payload
    );

    try {
      setSaving(true);

      const created =
        await createMatch(
          payload
        );

      console.log(
        "MWOPS - CREATE MATCH RESPONSE:",
        created
      );

      if (
        !created?.id
      ) {
        throw new Error(
          "The backend returned success but no match ID."
        );
      }

      await onCreated(
        created
      );

      onClose();
    } catch (err) {
      console.error(
        "MWOPS - CREATE MATCH FAILED:",
        err
      );

      let message =
        err?.message ||
        "Unable to create match.";

      if (
        err?.code
      ) {
        message += ` [${err.code}]`;
      }

      if (
        err?.details
      ) {
        message += ` ${err.details}`;
      }

      setError(
        message
      );

      setStep(3);
    } finally {
      setSaving(false);
    }
  }

  function close() {
    if (saving) {
      return;
    }

    onClose();
  }

  if (!open) {
    return null;
  }

  const isLive =
    normalizeStatus(
      form.status
    ) === "live";

  return (
    <Overlay>
      <div className="flex h-[94vh] w-full max-w-[1250px] flex-col overflow-hidden rounded-2xl border border-[#30363a] bg-[#070809] shadow-[0_30px_140px_rgba(0,0,0,0.8)]">

        {/* HEADER */}

        <div className="flex shrink-0 items-center justify-between border-b border-[#252a2e] bg-[#090b0c] px-6 py-5 lg:px-8">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                isLive
                  ? "bg-[#ff3b3b]/10 text-[#ff5555]"
                  : "bg-[#f2b632]/10 text-[#f2b632]"
              }`}
            >
              {isLive ? (
                <Radio
                  size={20}
                />
              ) : (
                <CalendarDays
                  size={20}
                />
              )}
            </div>

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#f2b632]">
                Match Operations
              </p>

              <h2 className="mt-1 text-xl font-black uppercase text-white">
                Quick Match Setup
              </h2>

              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`text-[9px] font-black uppercase tracking-[0.16em] ${
                    isLive
                      ? "text-[#ff6666]"
                      : "text-[#f2b632]"
                  }`}
                >
                  {isLive
                    ? "Creating Live Match"
                    : "Creating Scheduled Match"}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={close}
            disabled={
              saving
            }
            className="rounded-xl p-2 text-[#646d73] hover:bg-[#171a1d] hover:text-white disabled:opacity-40"
          >
            <X
              size={20}
            />
          </button>
        </div>

        <WizardProgress
          step={step}
        />

        {/* BODY */}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8 lg:py-10">

            {error && (
              <div className="mb-7 rounded-xl border border-[#ff3b3b]/30 bg-[#ff3b3b]/10 px-4 py-4 text-sm leading-6 text-[#ff7777]">
                <div className="flex items-start gap-3">
                  <Shield
                    size={17}
                    className="mt-0.5 shrink-0"
                  />

                  <div className="min-w-0">
                    <p className="font-black uppercase tracking-wider">
                      Match creation error
                    </p>

                    <p className="mt-1">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step ===
              1 && (
              <MatchInfoStep
                form={
                  form
                }
                setForm={
                  setForm
                }
                tournaments={
                  tournaments
                }
                rounds={
                  rounds
                }
                roundsLoading={
                  roundsLoading
                }
                suggestedMatchNumber={
                  Math.max(
                    0,
                    ...matches.map(
                      getMatchNumber
                    )
                  ) + 1
                }
              />
            )}

            {step ===
              2 && (
              <TeamsStep
                form={
                  form
                }
                setForm={
                  setForm
                }
                onAddSlot={
                  openSlot
                }
                onPaste={() =>
                  setSourceModal(
                    "paste"
                  )
                }
                onCsv={() =>
                  setSourceModal(
                    "csv"
                  )
                }
                onCopy={() =>
                  setSourceModal(
                    "copy"
                  )
                }
              />
            )}

            {step ===
              3 && (
              <ReviewStep
                form={
                  form
                }
                tournament={
                  selectedTournament
                }
                onRemoveSlot={(
                  slotNumber
                ) => {
                  setForm(
                    (current) => ({
                      ...current,

                      team_slots:
                        current.team_slots.filter(
                          (slot) =>
                            Number(
                              slot.slot
                            ) !==
                            Number(
                              slotNumber
                            )
                        ),
                    })
                  );
                }}
              />
            )}
          </div>
        </div>

        {/* FOOTER */}

        <div className="shrink-0 border-t border-[#252a2e] bg-[#090b0c] px-6 py-4 lg:px-8">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">

            <button
              type="button"
              onClick={
                step === 1
                  ? close
                  : previousStep
              }
              disabled={
                saving
              }
              className="inline-flex items-center gap-2 rounded-xl border border-[#252a2e] bg-[#111315] px-5 py-3 text-xs font-black uppercase tracking-wider text-[#737b81] hover:border-[#555b60] hover:text-white disabled:opacity-40"
            >
              {step ===
              1 ? (
                <>
                  <X
                    size={15}
                  />
                  Cancel
                </>
              ) : (
                <>
                  <ChevronLeft
                    size={15}
                  />
                  Back
                </>
              )}
            </button>

            <div className="hidden text-[9px] font-black uppercase tracking-[0.18em] text-[#454c51] sm:block">
              Step {step} of 3
            </div>

            {step <
            3 ? (
              <button
                type="button"
                onClick={
                  nextStep
                }
                className="inline-flex items-center gap-2 rounded-xl bg-[#f2b632] px-6 py-3 text-xs font-black uppercase tracking-wider text-[#050607] hover:bg-[#ffc94d]"
              >
                Next Step
                <ChevronRight
                  size={15}
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={
                  submitMatch
                }
                disabled={
                  saving
                }
                className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-xs font-black uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-50 ${
                  isLive
                    ? "bg-[#ff3b3b] text-white hover:bg-[#ff5252]"
                    : "bg-[#f2b632] text-[#050607] hover:bg-[#ffc94d]"
                }`}
              >
                {saving ? (
                  <Loader2
                    size={15}
                    className="animate-spin"
                  />
                ) : isLive ? (
                  <Radio
                    size={15}
                  />
                ) : (
                  <CalendarDays
                    size={15}
                  />
                )}

                {saving
                  ? "Creating Match..."
                  : isLive
                    ? "Create Live Match"
                    : "Schedule Match"}
              </button>
            )}
          </div>
        </div>
      </div>

      <TeamSlotModal
        open={
          slotModal.open
        }
        slotNumber={
          slotModal.slot
            ?.slot
        }
        initialSlot={
          slotModal.slot
        }
        onClose={() =>
          setSlotModal({
            open: false,
            slot: null,
          })
        }
        onSave={
          saveSlot
        }
      />

      <PasteTeamsModal
        open={
          sourceModal ===
          "paste"
        }
        onClose={() =>
          setSourceModal(
            ""
          )
        }
        onProcess={
          processPaste
        }
      />

      <CsvTeamsModal
        open={
          sourceModal ===
          "csv"
        }
        onClose={() =>
          setSourceModal(
            ""
          )
        }
        onImport={
          importCsv
        }
      />

      <CopyMatchModal
        open={
          sourceModal ===
          "copy"
        }
        onClose={() =>
          setSourceModal(
            ""
          )
        }
        matches={
          matches
        }
        onCopy={
          copyFromMatch
        }
      />
    </Overlay>
  );
}

/*
|--------------------------------------------------------------------------
| MATCH VISUALS
|--------------------------------------------------------------------------
*/

const MATCH_VISUALS = {
  "PUBG Mobile": "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1600&q=85",
  BGMI: "https://images.unsplash.com/photo-1560253023-3ec5d502959f?auto=format&fit=crop&w=1600&q=85",
  "Free Fire": "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1600&q=85",
  Valorant: "https://images.unsplash.com/photo-1547394765-185e1e68f34e?auto=format&fit=crop&w=1600&q=85",
  "Call of Duty Mobile": "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=1600&q=85",
  default: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1600&q=85",
};

function getMatchVisual(match, tournaments = []) {
  const game =
    match?.game ||
    tournaments.find(
      (item) => String(item.id) === String(match?.tournament_id)
    )?.game ||
    "";

  return MATCH_VISUALS[String(game).trim()] || MATCH_VISUALS.default;
}

function getMatchImagePosition(match) {
  return normalizeStatus(match?.status) === "live"
    ? "center"
    : "center 38%";
}

/*
|--------------------------------------------------------------------------
| MATCH DISPLAY HELPERS
|--------------------------------------------------------------------------
*/

function getTeamDisplay(
  match,
  position
) {
  const slotTeams =
    getSlotTeams(
      match
    );

  if (
    slotTeams[position]
      ?.team
  ) {
    return getTeamName(
      slotTeams[position]
        .team
    );
  }

  const teams =
    getMatchTeams(
      match
    );

  if (
    teams[position]
  ) {
    return getTeamName(
      teams[position]
    );
  }

  return "TBD";
}

function getTournamentName(
  match,
  tournaments
) {
  if (
    match?.tournaments
      ?.name
  ) {
    return match.tournaments
      .name;
  }

  if (
    match?.tournament
      ?.name
  ) {
    return match.tournament
      .name;
  }

  const tournament =
    tournaments.find(
      (item) =>
        String(
          item.id
        ) ===
        String(
          match?.tournament_id
        )
    );

  return (
    tournament?.name ||
    "Unknown Tournament"
  );
}

/*
|--------------------------------------------------------------------------
| MATCH PAGE
|--------------------------------------------------------------------------
*/

function Matches() {
  const navigate =
    useNavigate();

  const [
    searchParams,
  ] = useSearchParams();

  const [
    matches,
    setMatches,
  ] = useState([]);

  const [
    tournaments,
    setTournaments,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [
    error,
    setError,
  ] = useState("");

  const [
    notice,
    setNotice,
  ] = useState("");

  const [
    quickSetupOpen,
    setQuickSetupOpen,
  ] = useState(false);

  const urlTournamentId =
    searchParams.get(
      "tournament_id"
    );

  const urlRoundId =
    searchParams.get(
      "round_id"
    );

  /*
  |--------------------------------------------------------------------------
  | NOTICE
  |--------------------------------------------------------------------------
  */

  function showNotice(
    message
  ) {
    setNotice(
      message
    );

    window.clearTimeout(
      showNotice.timer
    );

    showNotice.timer =
      window.setTimeout(
        () =>
          setNotice(""),
        2600
      );
  }

  /*
  |--------------------------------------------------------------------------
  | LOAD TOURNAMENTS
  |--------------------------------------------------------------------------
  */

  async function loadTournaments() {
    const data =
      await request(
        "/tournaments"
      );

    const raw =
      Array.isArray(
        data
      )
        ? data
        : Array.isArray(
              data?.data
            )
          ? data.data
          : Array.isArray(
                data?.tournaments
              )
            ? data.tournaments
            : [];

    setTournaments(
      raw
    );
  }

  /*
  |--------------------------------------------------------------------------
  | LOAD
  |--------------------------------------------------------------------------
  */

  async function loadData() {
    try {
      setLoading(
        true
      );

      setError("");

      const [
        matchesData,
      ] =
        await Promise.all([
          getMatches(),
          loadTournaments(),
        ]);

      setMatches(
        Array.isArray(
          matchesData
        )
          ? matchesData
          : []
      );
    } catch (err) {
      console.error(
        "MWOPS - Failed to load matches:",
        err
      );

      setError(
        err?.message ||
          "Unable to load matches."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  /*
  |--------------------------------------------------------------------------
  | FILTER
  |--------------------------------------------------------------------------
  */

  const filteredMatches =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return matches.filter(
        (match) => {
          const matchesSearch =
            !query ||
            [
              match?.name,
              match?.game,
              match?.map,
              match?.round,
              match?.status,
              match?.tournament_name,
              match?.tournaments
                ?.name,
              match?.tournament
                ?.name,
            ]
              .filter(Boolean)
              .some(
                (value) =>
                  String(
                    value
                  )
                    .toLowerCase()
                    .includes(
                      query
                    )
              );

          const matchesStatus =
            statusFilter ===
              "all" ||
            normalizeStatus(
              match?.status
            ) ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      matches,
      search,
      statusFilter,
    ]);

  /*
  |--------------------------------------------------------------------------
  | CREATED
  |--------------------------------------------------------------------------
  */

  async function handleCreatedMatch(
    createdMatch
  ) {
    try {
      await loadData();

      const status =
        normalizeStatus(
          createdMatch?.status
        );

      showNotice(
        status === "live"
          ? "Live match created successfully."
          : "Match scheduled successfully."
      );
    } catch (err) {
      console.error(
        "MWOPS - Failed to refresh match registry:",
        err
      );

      showNotice(
        "Match created successfully. Refresh the registry if required."
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | CONTROL ROOM
  |--------------------------------------------------------------------------
  */

  function openControlRoom(
    match
  ) {
    if (!match?.id) {
      setError(
        "This match does not have a valid ID."
      );
      return;
    }

    navigate(
      `/control-room?matchId=${encodeURIComponent(
        match.id
      )}`
    );
  }

  /*
  |--------------------------------------------------------------------------
  | REFRESH
  |--------------------------------------------------------------------------
  */

  async function handleRefresh() {
    if (
      refreshing
    ) {
      return;
    }

    try {
      setRefreshing(
        true
      );

      await loadData();

      showNotice(
        "Match registry refreshed."
      );
    } finally {
      setRefreshing(
        false
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | DELETE MATCH
  |--------------------------------------------------------------------------
  */

  async function handleDeleteMatch(match) {
    if (!match?.id) {
      setError("This match does not have a valid ID.");
      return;
    }

    const matchName =
      match.name ||
      `Match #${getMatchNumber(match) || ""}`.trim();

    const confirmed = window.confirm(
      `Delete ${matchName}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setError("");
      setNotice(`Deleting ${matchName}...`);

      await request(
        `/matches/${encodeURIComponent(match.id)}`,
        { method: "DELETE" }
      );

      setMatches((current) =>
        current.filter(
          (item) => String(item.id) !== String(match.id)
        )
      );

      showNotice(`${matchName} deleted successfully.`);
    } catch (err) {
      console.error("MWOPS - Failed to delete match:", err);
      setNotice("");
      setError(err?.message || "Unable to delete this match.");
    }
  }

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <main className="min-h-screen bg-[#050607] text-[#f5f5f0]">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(242,182,50,0.06),transparent_30%)]">

        <header className="border-b border-[#252a2e] bg-[#050607]/95">
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-5 px-6 py-5 lg:px-10">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f2b632]">
                MWOPS
              </p>

              <h1 className="mt-1 text-2xl font-black uppercase tracking-tight">
                Matches
              </h1>
            </div>

            <button
              type="button"
              onClick={() =>
                setQuickSetupOpen(
                  true
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-[#f2b632] px-5 py-3 text-sm font-extrabold text-[#050607] hover:bg-[#ffc94d]"
            >
              <Plus
                size={17}
              />
              Create Match
            </button>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1600px] px-6 py-8 lg:px-10 lg:py-10">

          <section className="mb-8">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#92979d]">
                  Match Operations
                </p>

                <h2 className="mt-2 text-5xl font-black uppercase leading-none tracking-[-0.04em] md:text-6xl">
                  Match Center
                </h2>

                <p className="mt-4 max-w-2xl text-sm leading-6 text-[#92979d] md:text-base">
                  Schedule, monitor and control
                  every competitive match running
                  through MWOPS.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-[#252a2e] bg-[#0b0d0f] px-4 py-3">
                <Gamepad2
                  size={17}
                  className="text-[#f2b632]"
                />

                <span className="text-sm font-semibold">
                  {matches.length
                    .toString()
                    .padStart(
                      2,
                      "0"
                    )}{" "}
                  Matches
                </span>
              </div>
            </div>
          </section>

          {notice && (
            <div className="mb-6 rounded-xl border border-[#f2b632]/25 bg-[#f2b632]/10 px-4 py-3 text-sm font-bold text-[#f2b632]">
              {notice}
            </div>
          )}

          {error && (
            <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-[#ff3b3b]/30 bg-[#ff3b3b]/10 px-4 py-3 text-sm text-[#ff7777]">
              <span>
                {error}
              </span>

              <button
                type="button"
                onClick={() =>
                  setError("")
                }
                className="text-xs font-bold uppercase tracking-wider hover:text-white"
              >
                Dismiss
              </button>
            </div>
          )}

          <section className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                "all",
                "live",
                "scheduled",
                "completed",
                "paused",
                "cancelled",
              ].map(
                (filter) => (
                  <button
                    key={
                      filter
                    }
                    type="button"
                    onClick={() =>
                      setStatusFilter(
                        filter
                      )
                    }
                    className={`rounded-lg border px-4 py-2 text-xs font-black uppercase tracking-wider ${
                      statusFilter ===
                      filter
                        ? "border-[#f2b632] bg-[#f2b632] text-[#050607]"
                        : "border-[#252a2e] bg-[#0b0d0f] text-[#92979d] hover:border-[#555b60] hover:text-white"
                    }`}
                  >
                    {
                      filter
                    }
                  </button>
                )
              )}
            </div>

            <div className="flex w-full gap-2 lg:w-auto">
              <div className="relative w-full lg:w-80">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555b60]"
                />

                <input
                  value={
                    search
                  }
                  onChange={(event) =>
                    setSearch(
                      event.target
                        .value
                    )
                  }
                  placeholder="Search matches..."
                  className="w-full rounded-lg border border-[#252a2e] bg-[#0b0d0f] py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-[#555b60]"
                />
              </div>

              <button
                type="button"
                onClick={
                  handleRefresh
                }
                disabled={
                  refreshing
                }
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#252a2e] bg-[#0b0d0f] text-[#737b81] hover:text-white disabled:opacity-40"
                title="Refresh"
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  className={
                    refreshing
                      ? "animate-spin"
                      : ""
                  }
                >
                  <path
                    d="M20 11a8.1 8.1 0 0 0-14.9-4M4 5v5h5M4 13a8.1 8.1 0 0 0 14.9 4M20 19v-5h-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#252a2e] bg-[#0b0d0f]">
            <div className="border-b border-[#252a2e] px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#92979d]">
                Match Registry
              </p>
            </div>

            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <div className="text-center">
                  <Loader2
                    size={30}
                    className="mx-auto animate-spin text-[#f2b632]"
                  />

                  <p className="mt-4 text-sm text-[#6f7479]">
                    Loading matches...
                  </p>
                </div>
              </div>
            ) : filteredMatches.length ===
              0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
                <Trophy
                  size={34}
                  className="mb-4 text-[#3d4247]"
                />

                <h3 className="text-lg font-bold">
                  No matches found
                </h3>

                <p className="mt-2 max-w-md text-sm text-[#6f7479]">
                  There are no matches matching
                  your current filters.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setQuickSetupOpen(
                      true
                    )
                  }
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#f2b632] px-5 py-3 text-xs font-black uppercase tracking-wider text-[#050607]"
                >
                  <Plus
                    size={15}
                  />
                  Create First Match
                </button>
              </div>
            ) : (
              <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-2">
                {filteredMatches.map(
                  (
                    match,
                    index
                  ) => {
                    const status =
                      normalizeStatus(
                        match.status
                      );

                    const assignedSlots =
                      getSlotTeams(
                        match
                      ).length;

                    const totalTeams =
                      match.teams_count ??
                      assignedSlots;

                    return (
                      <article
                        key={
                          match.id ||
                          `${index}-${match.name}`
                        }
                        className="group relative overflow-hidden border border-[#252a2e] bg-[#0b0d0f] transition duration-300 hover:-translate-y-0.5 hover:border-[#f2b632]/35 hover:shadow-[0_18px_60px_rgba(0,0,0,0.35)]"
                      >
                        {/* CINEMATIC MATCH IMAGE */}

                        <div className="relative h-32 overflow-hidden sm:h-36 lg:h-40">
                          <img
                            src={getMatchVisual(match, tournaments)}
                            alt=""
                            className="h-full w-full object-cover opacity-45 transition duration-700 group-hover:scale-[1.035] group-hover:opacity-55"
                            style={{
                              objectPosition:
                                getMatchImagePosition(match),
                            }}
                          />

                          <div className="absolute inset-0 bg-gradient-to-r from-[#050607] via-[#050607]/75 to-[#050607]/20" />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d0f] via-transparent to-[#050607]/30" />

                          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 sm:p-5">
                            <div className="flex items-center gap-2">
                              <span className="border border-white/10 bg-black/45 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#d6d8d5] backdrop-blur-sm">
                                MATCH {String(getMatchNumber(match) || index + 1).padStart(2, "0")}
                              </span>

                              {match.map && (
                                <span className="hidden border border-white/10 bg-black/45 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#9da2a5] backdrop-blur-sm sm:inline-flex">
                                  {match.map}
                                </span>
                              )}
                            </div>

                            <StatusBadge status={match.status} />
                          </div>

                          <div className="absolute bottom-4 left-4 right-4 sm:bottom-5 sm:left-5 sm:right-5">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#f2b632]">
                              {getTournamentName(match, tournaments)}
                            </p>

                            <h3 className="mt-1 text-xl font-black uppercase tracking-[-0.02em] text-white sm:text-2xl">
                              {match.name || `Match ${index + 1}`}
                            </h3>
                          </div>
                        </div>

                        {/* MATCH INFORMATION */}

                        <div className="p-4 sm:p-5">
                          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#555d63]">
                                  Round
                                </p>

                                <p className="text-xs font-bold uppercase tracking-wider text-[#9da2a5]">
                                  {match.round || "Unassigned"}
                                </p>

                                <span className="h-1 w-1 rounded-full bg-[#353a3e]" />

                                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#555d63]">
                                  Game
                                </p>

                                <p className="text-xs font-bold text-[#9da2a5]">
                                  {match.game || "Not specified"}
                                </p>
                              </div>

                            </div>

                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                              <div className="flex items-center gap-2 border border-[#252a2e] bg-[#070809] px-3 py-2.5">
                                <Users size={14} className="text-[#f2b632]" />
                                <span className="text-[10px] font-black uppercase tracking-wider text-[#8c9297]">
                                  {totalTeams} Teams
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => openControlRoom(match)}
                                disabled={!match.id}
                                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                                  status === "live"
                                    ? "bg-[#f2b632] text-[#050607] hover:bg-[#ffc94d]"
                                    : "border border-[#f2b632]/25 bg-[#111315] text-white hover:border-[#f2b632]/60 hover:text-[#f2b632]"
                                } disabled:cursor-not-allowed disabled:opacity-40`}
                              >
                                {status === "live" ? (
                                  <>
                                    <Radio size={14} />
                                    Live Control
                                  </>
                                ) : (
                                  <>
                                    Control Room
                                    <ChevronRight size={14} />
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteMatch(match)}
                                disabled={!match.id}
                                title="Delete match"
                                className="inline-flex h-10 w-10 items-center justify-center border border-[#ff3b3b]/20 bg-[#ff3b3b]/5 text-[#ff6666] transition hover:border-[#ff3b3b]/50 hover:bg-[#ff3b3b]/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>

          <section className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#252a2e] pt-5 text-xs text-[#555b60]">
            <p>
              MWOPS Match Operations
            </p>

            <p className="font-bold uppercase tracking-[0.18em]">
              Live Production Platform
            </p>
          </section>
        </div>
      </div>

      <QuickMatchSetup
        open={
          quickSetupOpen
        }
        onClose={() =>
          setQuickSetupOpen(
            false
          )
        }
        onCreated={
          handleCreatedMatch
        }
        tournaments={
          tournaments
        }
        matches={
          matches
        }
        initialTournamentId={
          urlTournamentId ||
          ""
        }
        initialRoundId={
          urlRoundId ||
          ""
        }
      />
    </main>
  );
}

export default Matches;