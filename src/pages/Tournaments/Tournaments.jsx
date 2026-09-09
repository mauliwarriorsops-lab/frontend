/*
|--------------------------------------------------------------------------
| MWOPS TOURNAMENTS PAGE
|--------------------------------------------------------------------------
|
| Tournament listing + tournament creation.
|
| TOURNAMENT CREATION RULES
|--------------------------------------------------------------------------
|
| - BGMI is the only supported game.
| - Tournament description has been removed.
|
| CURRENT SUPABASE TOURNAMENT SCHEMA
|--------------------------------------------------------------------------
|
| tournaments
| - id
| - name
| - game
| - status
| - description
| - start_date
| - end_date
| - created_at
| - updated_at
|
| MWOPS UI RULE
|--------------------------------------------------------------------------
|
| Dates are intentionally NOT shown or collected anywhere.
|
| We do NOT send unsupported columns such as:
|
| - season
| - teams
| - matches
| - game_mode
| - scoring_config
| - start_date
| - end_date
|
| Description is also no longer collected or sent from this page.
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
  ChevronRight,
  Gamepad2,
  Plus,
  Search,
  Trophy,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  createTournament,
  getTournaments,
} from "../../api/tournaments";

/*
|--------------------------------------------------------------------------
| STATUS OPTIONS
|--------------------------------------------------------------------------
*/

const STATUS_OPTIONS = [
  "ALL",
  "LIVE",
  "ONGOING",
  "UPCOMING",
  "COMPLETED",
];

/*
|--------------------------------------------------------------------------
| GAME
|--------------------------------------------------------------------------
|
| BGMI is the only supported game.
|
| The previous multi-game selection has intentionally been removed.
|--------------------------------------------------------------------------
*/

const BGMI_GAME = {
  id: "BGMI",
  name: "BGMI",
  description: "Battle Royale",
};

/*
|--------------------------------------------------------------------------
| GAME VISUALS
|--------------------------------------------------------------------------
|
| BGMI is the only tournament game supported by MWOPS.
|--------------------------------------------------------------------------
*/

const GAME_VISUALS = {
  BGMI:
    "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1400&q=85",

  DEFAULT:
    "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1400&q=85",
};

function getTournamentVisual(game) {
  const normalized = String(game || "").trim();

  return (
    GAME_VISUALS[normalized] ||
    GAME_VISUALS.DEFAULT
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
  const normalizedStatus =
    String(
      status || "UPCOMING"
    ).toUpperCase();

  const styles = {
    LIVE: {
      wrapper:
        "border-[#ff3b3b]/30 bg-[#ff3b3b]/10 text-[#ff5555]",
      dot: "bg-[#ff3b3b]",
    },

    ONGOING: {
      wrapper:
        "border-[#35d98a]/30 bg-[#35d98a]/10 text-[#35d98a]",
      dot: "bg-[#35d98a]",
    },

    UPCOMING: {
      wrapper:
        "border-[#f2b632]/30 bg-[#f2b632]/10 text-[#f2b632]",
      dot: "bg-[#f2b632]",
    },

    COMPLETED: {
      wrapper:
        "border-[#6f7479]/30 bg-[#6f7479]/10 text-[#92979d]",
      dot: "bg-[#92979d]",
    },

    DRAFT: {
      wrapper:
        "border-[#6f7479]/30 bg-[#6f7479]/10 text-[#92979d]",
      dot: "bg-[#92979d]",
    },
  };

  const style =
    styles[normalizedStatus] ||
    styles.UPCOMING;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] ${style.wrapper}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
      />

      {normalizedStatus}
    </span>
  );
}

/*
|--------------------------------------------------------------------------
| GAME CARD
|--------------------------------------------------------------------------
|
| Kept as a reusable visual component.
|
| Since BGMI is the only supported game, only one card is rendered.
|--------------------------------------------------------------------------
*/

function GameCard({
  game,
  selected,
  disabled,
  onClick,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group relative w-full max-w-sm rounded-xl border p-4 text-left transition ${
        selected
          ? "border-[#f2b632] bg-[#f2b632]/10"
          : "border-[#252a2e] bg-[#050607] hover:border-[#555b60] hover:bg-[#0d0f11]"
      } ${
        disabled
          ? "cursor-not-allowed opacity-50"
          : ""
      }`}
    >
      {selected && (
        <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#f2b632] text-[#050607]">
          <Check
            size={12}
            strokeWidth={3}
          />
        </div>
      )}

      <div
        className={`flex h-11 w-11 items-center justify-center rounded-lg border ${
          selected
            ? "border-[#f2b632]/40 bg-[#f2b632]/10 text-[#f2b632]"
            : "border-[#252a2e] bg-[#0d0f11] text-[#92979d] group-hover:text-white"
        }`}
      >
        <Gamepad2 size={20} />
      </div>

      <p
        className={`mt-4 text-sm font-extrabold ${
          selected
            ? "text-[#f2b632]"
            : "text-white"
        }`}
      >
        {game.name}
      </p>

      <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#6f7479]">
        {game.description}
      </p>
    </button>
  );
}

/*
|--------------------------------------------------------------------------
| WIZARD STEP INDICATOR
|--------------------------------------------------------------------------
*/

function WizardSteps({
  currentStep,
}) {
  const steps = [
    {
      number: 1,
      title: "Tournament",
      subtitle: "Identity",
    },
    {
      number: 2,
      title: "Configuration",
      subtitle: "Setup",
    },
    {
      number: 3,
      title: "Review",
      subtitle: "Launch",
    },
  ];

  return (
    <div className="border-b border-[#252a2e] px-6 py-5">
      <div className="flex items-center justify-between">
        {steps.map(
          (step, index) => {
            const active =
              currentStep ===
              step.number;

            const completed =
              currentStep >
              step.number;

            return (
              <div
                key={step.number}
                className="flex flex-1 items-center"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-extrabold transition ${
                      active
                        ? "border-[#f2b632] bg-[#f2b632] text-[#050607]"
                        : completed
                          ? "border-[#f2b632] bg-[#f2b632]/10 text-[#f2b632]"
                          : "border-[#30353a] bg-[#101214] text-[#6f7479]"
                    }`}
                  >
                    {completed ? (
                      <Check size={15} />
                    ) : (
                      step.number
                    )}
                  </div>

                  <div className="hidden sm:block">
                    <p
                      className={`text-xs font-bold ${
                        active ||
                        completed
                          ? "text-white"
                          : "text-[#6f7479]"
                      }`}
                    >
                      {step.title}
                    </p>

                    <p className="mt-0.5 text-[10px] text-[#6f7479]">
                      {step.subtitle}
                    </p>
                  </div>
                </div>

                {index <
                  steps.length -
                    1 && (
                  <div
                    className={`mx-3 h-px flex-1 ${
                      currentStep >
                      step.number
                        ? "bg-[#f2b632]/60"
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
| CREATE TOURNAMENT MODAL
|--------------------------------------------------------------------------
*/

function CreateTournamentModal({
  onClose,
  onCreate,
  creating,
}) {
  const [step, setStep] =
    useState(1);

  const [name, setName] =
    useState("");

  /*
  |--------------------------------------------------------------------------
  | BGMI ONLY
  |--------------------------------------------------------------------------
  */

  const game = BGMI_GAME.id;

  const [status, setStatus] =
    useState("upcoming");

  const [localError, setLocalError] =
    useState("");

  /*
  |--------------------------------------------------------------------------
  | VALIDATE
  |--------------------------------------------------------------------------
  */

  const validateStep = () => {
    setLocalError("");

    if (step === 1) {
      if (!name.trim()) {
        setLocalError(
          "Tournament name is required."
        );

        return false;
      }
    }

    if (step === 2) {
      if (!status) {
        setLocalError(
          "Please select a tournament status."
        );

        return false;
      }
    }

    return true;
  };

  /*
  |--------------------------------------------------------------------------
  | NEXT
  |--------------------------------------------------------------------------
  */

  const handleNext = () => {
    if (!validateStep()) {
      return;
    }

    setStep(
      (current) =>
        Math.min(
          current + 1,
          3
        )
    );
  };

  /*
  |--------------------------------------------------------------------------
  | BACK
  |--------------------------------------------------------------------------
  */

  const handleBack = () => {
    setLocalError("");

    setStep(
      (current) =>
        Math.max(
          current - 1,
          1
        )
    );
  };

  /*
  |--------------------------------------------------------------------------
  | CREATE
  |--------------------------------------------------------------------------
  */

  const handleLaunch =
    async () => {
      if (!validateStep()) {
        return;
      }

      /*
       * Only send the fields required by the
       * current tournament creation flow.
       *
       * BGMI is always enforced here.
       *
       * Description is intentionally NOT sent.
       */

      await onCreate({
        name: name.trim(),
        game: "BGMI",
        status,
      });
    };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#252a2e] bg-[#0b0d0f] shadow-2xl">

        {/* HEADER */}

        <div className="flex items-center justify-between border-b border-[#252a2e] px-6 py-5">
          <div>
            <p className="mwops-label text-xs text-[#f2b632]">
              Competition Management
            </p>

            <h2 className="mwops-display mt-1 text-2xl sm:text-3xl">
              Create Tournament
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="rounded-lg p-2 text-[#92979d] transition hover:bg-[#151719] hover:text-white disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {/* STEPS */}

        <WizardSteps
          currentStep={step}
        />

        {/* CONTENT */}

        <div className="min-h-0 flex-1 overflow-y-auto">

          {/* STEP 1 */}

          {step === 1 && (
            <div className="space-y-7 p-6 sm:p-8">
              <div>
                <p className="mwops-label text-xs text-[#f2b632]">
                  Step 01
                </p>

                <h3 className="mwops-display mt-2 text-3xl">
                  Tournament Identity
                </h3>

                <p className="mt-2 max-w-xl text-sm leading-6 text-[#6f7479]">
                  Set the basic identity for
                  your BGMI competition.
                </p>
              </div>

              {/* NAME */}

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-[#92979d]">
                  Tournament Name
                </label>

                <input
                  autoFocus
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="Enter tournament name"
                  disabled={creating}
                  className="w-full rounded-xl border border-[#252a2e] bg-[#050607] px-4 py-4 text-sm text-white outline-none transition placeholder:text-[#4f5458] focus:border-[#f2b632]"
                />
              </div>

              {/* GAME */}

              <div>
                <label className="mb-3 block text-xs font-bold uppercase tracking-[0.12em] text-[#92979d]">
                  Game
                </label>

                <GameCard
                  game={BGMI_GAME}
                  selected
                  disabled={creating}
                  onClick={() => {}}
                />

                <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-[#555d62]">
                  MWOPS currently supports BGMI
                  competitions only.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2 */}

          {step === 2 && (
            <div className="space-y-7 p-6 sm:p-8">
              <div>
                <p className="mwops-label text-xs text-[#f2b632]">
                  Step 02
                </p>

                <h3 className="mwops-display mt-2 text-3xl">
                  Tournament Configuration
                </h3>

                <p className="mt-2 max-w-xl text-sm leading-6 text-[#6f7479]">
                  Set the initial operational
                  status for this competition.
                </p>
              </div>

              {/* STATUS */}

              <div>
                <label className="mb-3 block text-xs font-bold uppercase tracking-[0.12em] text-[#92979d]">
                  Initial Status
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      value:
                        "draft",
                      label:
                        "Draft",
                      description:
                        "Prepare the tournament before making it active.",
                    },
                    {
                      value:
                        "upcoming",
                      label:
                        "Upcoming",
                      description:
                        "Tournament is configured and ready for operations.",
                    },
                  ].map(
                    (option) => {
                      const selected =
                        status ===
                        option.value;

                      return (
                        <button
                          key={
                            option.value
                          }
                          type="button"
                          disabled={
                            creating
                          }
                          onClick={() =>
                            setStatus(
                              option.value
                            )
                          }
                          className={`rounded-xl border p-5 text-left transition ${
                            selected
                              ? "border-[#f2b632] bg-[#f2b632]/10"
                              : "border-[#252a2e] bg-[#050607] hover:border-[#555b60]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p
                              className={`text-sm font-extrabold ${
                                selected
                                  ? "text-[#f2b632]"
                                  : "text-white"
                              }`}
                            >
                              {
                                option.label
                              }
                            </p>

                            {selected && (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f2b632] text-[#050607]">
                                <Check
                                  size={
                                    12
                                  }
                                  strokeWidth={
                                    3
                                  }
                                />
                              </div>
                            )}
                          </div>

                          <p className="mt-2 text-xs leading-5 text-[#6f7479]">
                            {
                              option.description
                            }
                          </p>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* NOTICE */}

              <div className="rounded-xl border border-[#f2b632]/20 bg-[#f2b632]/5 p-5">
                <div className="flex items-start gap-3">
                  <Trophy
                    size={18}
                    className="mt-0.5 shrink-0 text-[#f2b632]"
                  />

                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#f2b632]">
                      Configure After Creation
                    </p>

                    <p className="mt-2 text-sm leading-6 text-[#92979d]">
                      Teams, rounds, matches,
                      standings and scoring
                      will be managed from the
                      tournament workspace after
                      the tournament is created.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 */}

          {step === 3 && (
            <div className="space-y-7 p-6 sm:p-8">
              <div>
                <p className="mwops-label text-xs text-[#f2b632]">
                  Step 03
                </p>

                <h3 className="mwops-display mt-2 text-3xl">
                  Review & Launch
                </h3>

                <p className="mt-2 max-w-xl text-sm leading-6 text-[#6f7479]">
                  Review the tournament before
                  creating it in MWOPS.
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-[#252a2e] bg-[#050607]">
                <div className="border-b border-[#252a2e] px-5 py-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6f7479]">
                    Tournament
                  </p>

                  <h4 className="mwops-display mt-2 text-3xl text-white">
                    {name ||
                      "Untitled Tournament"}
                  </h4>
                </div>

                <div className="grid gap-px bg-[#252a2e] sm:grid-cols-2">
                  <div className="bg-[#050607] p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6f7479]">
                      Game
                    </p>

                    <p className="mt-2 text-sm font-extrabold text-white">
                      BGMI
                    </p>
                  </div>

                  <div className="bg-[#050607] p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6f7479]">
                      Status
                    </p>

                    <div className="mt-2">
                      <StatusBadge
                        status={
                          status
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#f2b632]/30 bg-[#f2b632]/5 p-5">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f2b632] text-[#050607]">
                    <Trophy
                      size={18}
                    />
                  </div>

                  <div>
                    <p className="text-sm font-extrabold text-white">
                      Ready to create
                    </p>

                    <p className="mt-1 text-xs leading-5 text-[#92979d]">
                      After creation, MWOPS will
                      take you into the tournament
                      management workflow.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ERROR */}

          {localError && (
            <div className="mx-6 mb-6 rounded-xl border border-[#ff3b3b]/30 bg-[#ff3b3b]/10 px-4 py-3 text-sm text-[#ff7777] sm:mx-8">
              {localError}
            </div>
          )}
        </div>

        {/* FOOTER */}

        <div className="flex items-center justify-between gap-3 border-t border-[#252a2e] bg-[#080a0b] px-6 py-4 sm:px-8">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={
                  handleBack
                }
                disabled={
                  creating
                }
                className="inline-flex items-center gap-2 rounded-lg border border-[#252a2e] px-4 py-3 text-sm font-bold text-[#92979d] transition hover:border-[#555b60] hover:text-white disabled:opacity-50"
              >
                <ChevronRight
                  size={16}
                  className="rotate-180"
                />

                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="rounded-lg border border-[#252a2e] px-4 py-3 text-sm font-bold text-[#92979d] transition hover:border-[#555b60] hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={
                  handleNext
                }
                disabled={
                  creating
                }
                className="inline-flex items-center gap-2 rounded-lg bg-[#f2b632] px-5 py-3 text-sm font-extrabold text-[#050607] transition hover:bg-[#ffc94d] disabled:opacity-60"
              >
                Continue

                <ChevronRight
                  size={16}
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={
                  handleLaunch
                }
                disabled={
                  creating
                }
                className="inline-flex items-center gap-2 rounded-lg bg-[#f2b632] px-5 py-3 text-sm font-extrabold text-[#050607] transition hover:bg-[#ffc94d] disabled:opacity-60"
              >
                {creating ? (
                  "Creating..."
                ) : (
                  <>
                    <Trophy
                      size={16}
                    />

                    Create Tournament
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| TOURNAMENT CARD
|--------------------------------------------------------------------------
*/

function TournamentCard({
  tournament,
  onManage,
}) {
  const status = String(
    tournament.status || "UPCOMING"
  ).toUpperCase();

  const statusClass =
    status.toLowerCase();

  const image =
    getTournamentVisual(
      tournament.game
    );

  return (
    <article className="mwops-card">
      <div
        className="mwops-card-visual"
        style={{
          backgroundImage: `url("${image}")`,
        }}
      >
        <div className="mwops-card-image-overlay" />
        <div className="mwops-card-image-grid" />
        <div className="mwops-card-line" />

        <div className="mwops-card-top">
          <div className="mwops-game">
            {tournament.game ||
              "BGMI"}
          </div>

          <div
            className={`mwops-status ${statusClass}`}
          >
            <span className="mwops-status-dot" />
            {status}
          </div>
        </div>

        <div className="mwops-card-index">
          MWOPS / COMPETITION
        </div>

        <h2 className="mwops-card-title">
          {tournament.name ||
            "Untitled Tournament"}
        </h2>
      </div>

      <div className="mwops-card-body">
        <div className="mwops-card-info">
          <strong>
            Tournament Workspace
          </strong>

          <span>
            Manage teams, rounds, matches,
            standings and tournament operations.
          </span>
        </div>

        <button
          type="button"
          onClick={() =>
            onManage(tournament)
          }
          disabled={!tournament.id}
          className="mwops-manage"
        >
          <span>
            Manage Tournament
          </span>

          <ChevronRight size={14} />
        </button>
      </div>
    </article>
  );
}

/*
|--------------------------------------------------------------------------
| TOURNAMENTS PAGE
|--------------------------------------------------------------------------
*/

function Tournaments() {
  const navigate =
    useNavigate();

  const [tournaments, setTournaments] =
    useState([]);

  const [activeFilter, setActiveFilter] =
    useState("ALL");

  const [searchQuery, setSearchQuery] =
    useState("");

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [creating, setCreating] =
    useState(false);

  const [error, setError] =
    useState("");

  /*
  |--------------------------------------------------------------------------
  | LOAD TOURNAMENTS
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let cancelled = false;

    async function loadTournaments() {
      try {
        setLoading(true);
        setError("");

        const data =
          await getTournaments({
            status:
              activeFilter,
            search:
              searchQuery,
          });

        if (!cancelled) {
          setTournaments(
            Array.isArray(data)
              ? data
              : []
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.error(
            "Failed to load tournaments:",
            err
          );

          setError(
            err.message ||
              "Failed to load tournaments."
          );

          setTournaments([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTournaments();

    return () => {
      cancelled = true;
    };
  }, [
    activeFilter,
    searchQuery,
  ]);

  /*
  |--------------------------------------------------------------------------
  | CREATE TOURNAMENT
  |--------------------------------------------------------------------------
  */

  const handleCreateTournament =
    async (payload) => {
      try {
        setCreating(true);
        setError("");

        /*
         * The modal already guarantees BGMI
         * and does not include description.
         */

        const created =
          await createTournament(
            payload
          );

        if (created) {
          setTournaments(
            (current) => [
              created,
              ...current,
            ]
          );
        }

        setShowCreateModal(
          false
        );
      } catch (err) {
        console.error(
          "Failed to create tournament:",
          err
        );

        setError(
          err.message ||
            "Failed to create tournament."
        );
      } finally {
        setCreating(false);
      }
    };

  /*
  |--------------------------------------------------------------------------
  | MANAGE TOURNAMENT
  |--------------------------------------------------------------------------
  |
  | /tournaments/:tournamentId
  |
  |--------------------------------------------------------------------------
  */

  const handleManageTournament =
    (tournament) => {
      if (!tournament?.id) {
        setError(
          "Tournament ID is missing. Cannot open tournament workspace."
        );

        return;
      }

      navigate(
        `/tournaments/${encodeURIComponent(
          tournament.id
        )}`
      );
    };

  /*
  |--------------------------------------------------------------------------
  | LOCAL FILTER
  |--------------------------------------------------------------------------
  */

  const visibleTournaments =
    useMemo(() => {
      const search =
        searchQuery
          .trim()
          .toLowerCase();

      return tournaments.filter(
        (tournament) => {
          const status =
            String(
              tournament.status ||
                ""
            ).toUpperCase();

          if (
            activeFilter !==
              "ALL" &&
            status !==
              activeFilter
          ) {
            return false;
          }

          if (!search) {
            return true;
          }

          return (
            String(
              tournament.name ||
                ""
            )
              .toLowerCase()
              .includes(search) ||
            String(
              tournament.game ||
                ""
            )
              .toLowerCase()
              .includes(search)
          );
        }
      );
    }, [
      tournaments,
      activeFilter,
      searchQuery,
    ]);

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <>
      <style>{`
        .mwops-tournaments-page {
          --mw-bg:#07090b;
          --mw-surface:#0d1115;
          --mw-surface-2:#11171c;
          --mw-surface-3:#161d23;
          --mw-line:rgba(255,255,255,.085);
          --mw-line-strong:rgba(255,255,255,.14);
          --mw-gold:#e7ad2e;
          --mw-gold-bright:#ffc94b;
          --mw-gold-soft:rgba(231,173,46,.11);
          --mw-white:#f5f1e8;
          --mw-muted:#8d9499;
          --mw-dim:#5d666c;
          --mw-green:#3ed38a;
          --mw-red:#ff4655;
          min-height:100vh;
          position:relative;
          overflow:hidden;
          background:
            radial-gradient(circle at 76% 4%, rgba(231,173,46,.08), transparent 27%),
            radial-gradient(circle at 12% 30%, rgba(255,255,255,.025), transparent 25%),
            var(--mw-bg);
          color:var(--mw-white);
        }

        .mwops-tournaments-page,
        .mwops-tournaments-page * {
          box-sizing:border-box;
        }

        .mwops-tournaments-page::before {
          content:"";
          position:fixed;
          inset:0;
          pointer-events:none;
          z-index:0;
          background-image:
            linear-gradient(rgba(255,255,255,.014) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.014) 1px, transparent 1px);
          background-size:52px 52px;
          mask-image:linear-gradient(to bottom, rgba(0,0,0,.7), transparent 88%);
        }

        .mwops-page-shell {
          position:relative;
          z-index:1;
          min-height:100vh;
        }

        .mwops-topline {
          height:3px;
          width:100%;
          background:linear-gradient(
            90deg,
            transparent 0%,
            var(--mw-gold) 20%,
            var(--mw-gold-bright) 50%,
            var(--mw-gold) 80%,
            transparent 100%
          );
          box-shadow:0 0 24px rgba(231,173,46,.18);
        }

        .mwops-page-header {
          position:relative;
          z-index:10;
          border-bottom:1px solid var(--mw-line);
          background:rgba(7,9,11,.88);
          backdrop-filter:blur(18px);
        }

        .mwops-header-inner {
          width:100%;
          max-width:1480px;
          min-height:76px;
          margin:0 auto;
          padding:0 30px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:28px;
        }

        .mwops-brand-lockup {
          display:flex;
          align-items:center;
          gap:12px;
          min-width:220px;
        }

        .mwops-brand-mark {
          width:38px;
          height:38px;
          flex:none;
          display:grid;
          place-items:center;
          border:1px solid rgba(231,173,46,.46);
          border-radius:6px;
          background:linear-gradient(145deg,#17140b,#0c0e10);
          color:var(--mw-gold-bright);
          font-size:21px;
          font-weight:1000;
          box-shadow:
            inset 0 0 18px rgba(231,173,46,.04),
            0 0 22px rgba(231,173,46,.06);
        }

        .mwops-brand-name {
          color:var(--mw-white);
          font-size:18px;
          line-height:1;
          font-weight:1000;
          letter-spacing:-.8px;
        }

        .mwops-brand-name span {
          color:var(--mw-gold);
        }

        .mwops-brand-sub {
          margin-top:4px;
          color:#697177;
          font-size:6px;
          line-height:1;
          font-weight:900;
          letter-spacing:1.8px;
          text-transform:uppercase;
        }

        .mwops-header-context {
          display:flex;
          align-items:center;
          gap:9px;
          color:#737c82;
          font-size:7px;
          font-weight:900;
          letter-spacing:1.8px;
          text-transform:uppercase;
        }

        .mwops-header-context::before {
          content:"";
          width:5px;
          height:5px;
          border-radius:50%;
          background:var(--mw-green);
          box-shadow:0 0 12px rgba(62,211,138,.65);
        }

        .mwops-create-button {
          min-height:39px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:8px;
          padding:0 16px;
          border:1px solid var(--mw-gold);
          border-radius:4px;
          background:var(--mw-gold);
          color:#171207;
          font-size:8px;
          font-weight:1000;
          letter-spacing:.65px;
          text-transform:uppercase;
          box-shadow:0 9px 28px rgba(231,173,46,.12);
          transition:transform .2s ease, background .2s ease, box-shadow .2s ease;
        }

        .mwops-create-button:hover {
          transform:translateY(-1px);
          background:var(--mw-gold-bright);
          box-shadow:0 13px 32px rgba(231,173,46,.2);
        }

        .mwops-content {
          width:100%;
          max-width:1480px;
          margin:0 auto;
          padding:28px 30px 48px;
        }

        .mwops-hero {
          position:relative;
          min-height:300px;
          overflow:hidden;
          display:flex;
          align-items:flex-end;
          padding:34px;
          border:1px solid var(--mw-line);
          border-radius:7px;
          background:
            linear-gradient(90deg,rgba(5,8,10,.98) 0%,rgba(5,8,10,.91) 38%,rgba(5,8,10,.68) 66%,rgba(5,8,10,.78) 100%),
            linear-gradient(135deg,rgba(231,173,46,.12),transparent 44%),
            url("https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1800&q=88")
            center/cover no-repeat;
          box-shadow:
            0 24px 70px rgba(0,0,0,.25),
            inset 0 0 80px rgba(0,0,0,.2);
        }

        .mwops-hero::before {
          content:"";
          position:absolute;
          inset:0;
          background:
            linear-gradient(115deg,transparent 0 54%,rgba(231,173,46,.06) 54.2%,transparent 54.5%),
            linear-gradient(90deg,transparent 0 72%,rgba(255,255,255,.025) 72%,transparent 72.2%);
          pointer-events:none;
        }

        .mwops-hero::after {
          content:"";
          position:absolute;
          width:420px;
          height:420px;
          right:-90px;
          top:-165px;
          border:1px solid rgba(231,173,46,.13);
          border-radius:50%;
          box-shadow:
            0 0 0 35px rgba(231,173,46,.025),
            0 0 0 70px rgba(231,173,46,.016);
          pointer-events:none;
        }

        .mwops-hero-copy {
          position:relative;
          z-index:2;
          max-width:780px;
        }

        .mwops-kicker {
          display:flex;
          align-items:center;
          gap:9px;
          color:var(--mw-gold);
          font-size:8px;
          font-weight:1000;
          letter-spacing:2.3px;
          text-transform:uppercase;
        }

        .mwops-kicker::before {
          content:"";
          width:22px;
          height:2px;
          background:var(--mw-gold);
          box-shadow:0 0 12px rgba(231,173,46,.45);
        }

        .mwops-hero-title {
          margin:12px 0 0;
          color:#f7f3eb;
          font-size:clamp(48px,6.1vw,78px);
          line-height:.87;
          font-weight:1000;
          letter-spacing:-4.5px;
          text-transform:uppercase;
        }

        .mwops-hero-title span {
          display:block;
          color:var(--mw-gold-bright);
          text-shadow:0 0 35px rgba(231,173,46,.08);
        }

        .mwops-hero-copy p {
          max-width:650px;
          margin:17px 0 0;
          color:#899197;
          font-size:10px;
          line-height:1.75;
        }

        .mwops-hero-meta {
          position:absolute;
          z-index:2;
          right:32px;
          bottom:30px;
          min-width:140px;
          text-align:right;
        }

        .mwops-hero-meta-label {
          color:#687177;
          font-size:7px;
          font-weight:900;
          letter-spacing:1.8px;
          text-transform:uppercase;
        }

        .mwops-hero-meta-value {
          margin-top:5px;
          color:#eee9df;
          font-size:13px;
          font-weight:1000;
          letter-spacing:1px;
          text-transform:uppercase;
        }

        .mwops-hero-meta-line {
          width:38px;
          height:2px;
          margin:9px 0 0 auto;
          background:var(--mw-gold);
        }

        .mwops-toolbar {
          margin-top:14px;
          padding:10px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:14px;
          border:1px solid var(--mw-line);
          border-radius:6px;
          background:rgba(13,17,21,.9);
          box-shadow:0 12px 32px rgba(0,0,0,.12);
        }

        .mwops-filters {
          display:flex;
          flex-wrap:wrap;
          gap:4px;
        }

        .mwops-filter {
          min-height:34px;
          padding:0 13px;
          border:1px solid transparent;
          border-radius:4px;
          background:transparent;
          color:#7d868c;
          font-size:7px;
          font-weight:1000;
          letter-spacing:.8px;
          text-transform:uppercase;
          transition:.2s ease;
        }

        .mwops-filter:hover {
          color:#f0ece4;
          background:rgba(255,255,255,.035);
        }

        .mwops-filter.active {
          color:#161107;
          background:var(--mw-gold);
          box-shadow:0 6px 18px rgba(231,173,46,.12);
        }

        .mwops-search {
          width:min(310px,100%);
          height:36px;
          flex:none;
          display:flex;
          align-items:center;
          gap:9px;
          padding:0 12px;
          border:1px solid var(--mw-line);
          border-radius:4px;
          background:#070a0c;
          color:#69737a;
          transition:.2s ease;
        }

        .mwops-search:focus-within {
          border-color:rgba(231,173,46,.48);
          box-shadow:0 0 0 3px rgba(231,173,46,.035);
        }

        .mwops-search input {
          width:100%;
          min-width:0;
          border:0;
          outline:0;
          background:transparent;
          color:#eeeae2;
          font-size:9px;
        }

        .mwops-search input::placeholder {
          color:#4f585e;
        }

        .mwops-section-head {
          margin:27px 0 12px;
          display:flex;
          align-items:center;
          justify-content:space-between;
        }

        .mwops-section-title-wrap {
          display:flex;
          align-items:center;
          gap:10px;
        }

        .mwops-section-marker {
          width:3px;
          height:20px;
          background:var(--mw-gold);
          box-shadow:0 0 13px rgba(231,173,46,.28);
        }

        .mwops-section-title {
          margin:0;
          color:#e9e5dc;
          font-size:14px;
          line-height:1;
          font-weight:1000;
          letter-spacing:.1px;
          text-transform:uppercase;
        }

        .mwops-count {
          color:#5e676d;
          font-size:7px;
          font-weight:900;
          letter-spacing:1px;
          text-transform:uppercase;
        }

        .mwops-tournament-grid {
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:14px;
        }

        .mwops-card {
          position:relative;
          min-width:0;
          overflow:hidden;
          border:1px solid var(--mw-line);
          border-radius:7px;
          background:linear-gradient(145deg,#11171c,#0a0e11);
          box-shadow:0 14px 38px rgba(0,0,0,.17);
          transition:transform .22s ease, border-color .22s ease, box-shadow .22s ease;
        }

        .mwops-card:hover {
          transform:translateY(-4px);
          border-color:rgba(231,173,46,.46);
          box-shadow:0 22px 52px rgba(0,0,0,.28);
        }

        .mwops-card-visual {
          position:relative;
          height:205px;
          overflow:hidden;
          background-color:#10161b;
          background-position:center;
          background-size:cover;
          transition:background-size .35s ease;
        }

        .mwops-card:hover .mwops-card-visual {
          background-size:108%;
        }

        .mwops-card-image-overlay {
          position:absolute;
          inset:0;
          background:
            linear-gradient(180deg,rgba(5,8,10,.28) 0%,rgba(5,8,10,.4) 40%,rgba(5,8,10,.96) 100%),
            linear-gradient(90deg,rgba(5,8,10,.62),transparent 55%);
        }

        .mwops-card-image-grid {
          position:absolute;
          inset:0;
          opacity:.4;
          background-image:
            linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),
            linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);
          background-size:28px 28px;
          mask-image:linear-gradient(to bottom,rgba(0,0,0,.75),transparent 80%);
        }

        .mwops-card-line {
          position:absolute;
          z-index:4;
          left:0;
          top:0;
          bottom:0;
          width:3px;
          background:var(--mw-gold);
          box-shadow:0 0 16px rgba(231,173,46,.45);
        }

        .mwops-card-top {
          position:absolute;
          z-index:5;
          top:14px;
          left:16px;
          right:16px;
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:10px;
        }

        .mwops-game {
          padding-top:2px;
          color:var(--mw-gold-bright);
          font-size:7px;
          font-weight:1000;
          letter-spacing:1.5px;
          text-transform:uppercase;
          text-shadow:0 1px 10px rgba(0,0,0,.7);
        }

        .mwops-status {
          display:inline-flex;
          align-items:center;
          gap:6px;
          padding:5px 8px;
          border:1px solid rgba(231,173,46,.3);
          border-radius:3px;
          background:rgba(6,9,11,.72);
          color:var(--mw-gold-bright);
          font-size:6px;
          font-weight:1000;
          letter-spacing:1px;
          text-transform:uppercase;
          backdrop-filter:blur(8px);
        }

        .mwops-status-dot {
          width:5px;
          height:5px;
          border-radius:50%;
          background:currentColor;
          box-shadow:0 0 7px currentColor;
        }

        .mwops-status.live {
          color:#ff6572;
          border-color:rgba(255,70,85,.35);
          background:rgba(255,70,85,.09);
        }

        .mwops-status.ongoing {
          color:var(--mw-green);
          border-color:rgba(62,211,138,.28);
          background:rgba(62,211,138,.07);
        }

        .mwops-status.completed,
        .mwops-status.draft {
          color:#8b9297;
          border-color:rgba(255,255,255,.1);
          background:rgba(255,255,255,.035);
        }

        .mwops-card-index {
          position:absolute;
          z-index:4;
          left:16px;
          bottom:56px;
          color:rgba(245,241,232,.48);
          font-size:5px;
          font-weight:900;
          letter-spacing:1.5px;
          text-transform:uppercase;
        }

        .mwops-card-title {
          position:absolute;
          z-index:5;
          left:16px;
          right:16px;
          bottom:16px;
          margin:0;
          color:#f5f1e8;
          font-size:24px;
          line-height:.94;
          font-weight:1000;
          letter-spacing:-1px;
          text-transform:uppercase;
          text-shadow:0 2px 16px rgba(0,0,0,.7);
        }

        .mwops-card-body {
          padding:14px;
          background:linear-gradient(180deg,#10161a,#0c1013);
        }

        .mwops-card-info {
          min-height:62px;
          padding:11px 12px;
          display:flex;
          flex-direction:column;
          gap:4px;
          border:1px solid rgba(255,255,255,.065);
          border-radius:4px;
          background:#080b0d;
          color:#697278;
          font-size:8px;
          line-height:1.55;
        }

        .mwops-card-info strong {
          color:#c8c5bd;
          font-size:8px;
          font-weight:900;
          text-transform:uppercase;
          letter-spacing:.3px;
        }

        .mwops-card-info span {
          color:#687177;
        }

        .mwops-manage {
          width:100%;
          min-height:39px;
          margin-top:10px;
          padding:0 12px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          border:1px solid rgba(231,173,46,.34);
          border-radius:4px;
          background:rgba(231,173,46,.045);
          color:var(--mw-gold-bright);
          font-size:7px;
          font-weight:1000;
          letter-spacing:.7px;
          text-transform:uppercase;
          transition:.2s ease;
        }

        .mwops-manage:hover {
          border-color:var(--mw-gold);
          background:var(--mw-gold);
          color:#151107;
        }

        .mwops-create-card {
          min-height:350px;
          padding:28px;
          position:relative;
          overflow:hidden;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          border:1px dashed rgba(255,255,255,.15);
          border-radius:7px;
          background:
            radial-gradient(circle at 50% 35%,rgba(231,173,46,.055),transparent 30%),
            linear-gradient(145deg,rgba(255,255,255,.018),rgba(255,255,255,.006));
          color:#858d92;
          text-align:center;
          transition:.22s ease;
        }

        .mwops-create-card::before {
          content:"";
          position:absolute;
          inset:14px;
          border:1px solid rgba(255,255,255,.035);
          border-radius:5px;
          pointer-events:none;
        }

        .mwops-create-card:hover {
          transform:translateY(-4px);
          border-color:rgba(231,173,46,.5);
          background:
            radial-gradient(circle at 50% 35%,rgba(231,173,46,.095),transparent 30%),
            rgba(231,173,46,.018);
          color:var(--mw-gold);
        }

        .mwops-create-icon {
          position:relative;
          z-index:1;
          width:58px;
          height:58px;
          display:grid;
          place-items:center;
          border:1px solid rgba(255,255,255,.14);
          border-radius:50%;
          background:#0c1013;
          box-shadow:0 10px 25px rgba(0,0,0,.25);
        }

        .mwops-create-card:hover .mwops-create-icon {
          border-color:var(--mw-gold);
          box-shadow:0 0 28px rgba(231,173,46,.12);
        }

        .mwops-create-title {
          position:relative;
          z-index:1;
          margin:16px 0 0;
          color:#dedad1;
          font-size:14px;
          font-weight:1000;
          letter-spacing:.1px;
          text-transform:uppercase;
        }

        .mwops-create-copy {
          position:relative;
          z-index:1;
          max-width:250px;
          margin:8px 0 0;
          color:#626b71;
          font-size:8px;
          line-height:1.65;
        }

        .mwops-empty {
          min-height:360px;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          padding:30px;
          border:1px solid var(--mw-line);
          border-radius:7px;
          background:
            radial-gradient(circle at center,rgba(231,173,46,.035),transparent 34%),
            #0c1013;
          text-align:center;
        }

        .mwops-empty h3 {
          margin:14px 0 0;
          color:#eeeae2;
          font-size:24px;
          font-weight:1000;
          text-transform:uppercase;
        }

        .mwops-empty p {
          margin:7px 0 0;
          color:#626b71;
          font-size:9px;
        }

        .mwops-footer {
          margin-top:30px;
          padding-top:16px;
          display:flex;
          justify-content:space-between;
          gap:15px;
          border-top:1px solid var(--mw-line);
          color:#4f585e;
          font-size:6px;
          font-weight:900;
          letter-spacing:1.3px;
          text-transform:uppercase;
        }

        .mwops-tournaments-page .mwops-display {
          font-family:inherit;
          font-weight:1000;
          letter-spacing:-.8px;
          text-transform:uppercase;
        }

        .mwops-tournaments-page .mwops-label {
          font-size:8px;
          font-weight:900;
          letter-spacing:1.4px;
          text-transform:uppercase;
        }

        @media (max-width:1120px) {
          .mwops-tournament-grid {
            grid-template-columns:repeat(2,minmax(0,1fr));
          }

          .mwops-hero-meta {
            display:none;
          }
        }

        @media (max-width:760px) {
          .mwops-header-inner {
            min-height:68px;
            padding:0 15px;
          }

          .mwops-brand-lockup {
            min-width:0;
          }

          .mwops-brand-sub,
          .mwops-header-context {
            display:none;
          }

          .mwops-create-button {
            min-height:36px;
            padding:0 11px;
            font-size:7px;
          }

          .mwops-content {
            padding:15px 13px 34px;
          }

          .mwops-hero {
            min-height:300px;
            padding:24px 21px;
          }

          .mwops-hero-title {
            font-size:42px;
            letter-spacing:-2.8px;
          }

          .mwops-hero-copy p {
            font-size:9px;
          }

          .mwops-toolbar {
            align-items:stretch;
            flex-direction:column;
          }

          .mwops-filters {
            overflow-x:auto;
            flex-wrap:nowrap;
            padding-bottom:2px;
            scrollbar-width:none;
          }

          .mwops-filters::-webkit-scrollbar {
            display:none;
          }

          .mwops-filter {
            flex:none;
          }

          .mwops-search {
            width:100%;
          }

          .mwops-tournament-grid {
            grid-template-columns:1fr;
          }

          .mwops-card-visual {
            height:220px;
          }

          .mwops-create-card {
            min-height:300px;
          }

          .mwops-footer {
            flex-direction:column;
            align-items:flex-start;
          }
        }
      `}</style>

      <main className="mwops-tournaments-page">
        <div className="mwops-page-shell">

          {/* HEADER */}

          <div className="mwops-topline" />

          <header className="mwops-page-header">
            <div className="mwops-header-inner">

              <div className="mwops-brand-lockup">
                <div className="mwops-brand-mark">
                  M
                </div>

                <div>
                  <div className="mwops-brand-name">
                    MW<span>O</span>PS
                  </div>

                  <div className="mwops-brand-sub">
                    Match Warfare Operations
                  </div>
                </div>
              </div>

              <div className="mwops-header-context">
                Competition Operations
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowCreateModal(
                    true
                  )
                }
                className="mwops-create-button"
              >
                <Plus size={14} />
                Create Tournament
              </button>
            </div>
          </header>

          {/* CONTENT */}

          <div className="mwops-content">

            {/* HERO */}

            <section className="mwops-hero">
              <div className="mwops-hero-copy">

                <div className="mwops-kicker">
                  Competition Management
                </div>

                <h1 className="mwops-hero-title">
                  Your{" "}
                  <span>
                    Tournaments
                  </span>
                </h1>

                <p>
                  Create, manage and monitor
                  every competition running
                  through the MWOPS esports
                  operation. Tournament
                  workspaces keep teams,
                  matches, rounds and live
                  production organized in one
                  place.
                </p>
              </div>

              <div className="mwops-hero-meta">
                <div className="mwops-hero-meta-label">
                  Active Workspace
                </div>

                <div className="mwops-hero-meta-value">
                  {String(
                    tournaments.length
                  ).padStart(2, "0")}{" "}
                  Events
                </div>

                <div className="mwops-hero-meta-line" />
              </div>
            </section>

            {/* ERROR */}

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

            {/* FILTERS */}

            <section className="mwops-toolbar">
              <div className="mwops-filters">
                {STATUS_OPTIONS.map(
                  (status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() =>
                        setActiveFilter(
                          status
                        )
                      }
                      className={`mwops-filter ${
                        activeFilter ===
                        status
                          ? "active"
                          : ""
                      }`}
                    >
                      {status}
                    </button>
                  )
                )}
              </div>

              <label className="mwops-search">
                <Search size={14} />

                <input
                  value={
                    searchQuery
                  }
                  onChange={(
                    event
                  ) =>
                    setSearchQuery(
                      event.target
                        .value
                    )
                  }
                  placeholder="Search tournaments..."
                />
              </label>
            </section>

            <div className="mwops-section-head">
              <div className="mwops-section-title-wrap">
                <div className="mwops-section-marker" />

                <h2 className="mwops-section-title">
                  Competition Roster
                </h2>

                <span className="mwops-count">
                  {
                    visibleTournaments.length
                  }{" "}
                  shown
                </span>
              </div>
            </div>

            {/* TOURNAMENT GRID */}

            {loading ? (
              <section className="mwops-tournament-grid">
                {[1, 2, 3].map(
                  (item) => (
                    <div
                      key={item}
                      className="h-[292px] animate-pulse rounded-md border border-[#252a2e] bg-[#0b0d0f]"
                    />
                  )
                )}
              </section>
            ) : visibleTournaments.length >
              0 ? (
              <section className="mwops-tournament-grid">

                {visibleTournaments.map(
                  (tournament) => (
                    <TournamentCard
                      key={
                        tournament.id
                      }
                      tournament={
                        tournament
                      }
                      onManage={
                        handleManageTournament
                      }
                    />
                  )
                )}

                {/* CREATE CARD */}

                <button
                  type="button"
                  onClick={() =>
                    setShowCreateModal(
                      true
                    )
                  }
                  className="mwops-create-card"
                >
                  <div className="mwops-create-icon">
                    <Plus size={26} />
                  </div>

                  <h3 className="mwops-create-title">
                    Create Tournament
                  </h3>

                  <p className="mwops-create-copy">
                    Set up a new BGMI
                    competition and
                    continue configuring
                    it from the tournament
                    workspace.
                  </p>
                </button>
              </section>
            ) : (
              <section className="mwops-empty">

                <Trophy
                  size={38}
                  className="text-[#f2b632]"
                />

                <h3 className="mwops-display mt-5 text-3xl">
                  No Tournaments Found
                </h3>

                <p className="mt-2 text-sm text-[#6f7479]">
                  There are currently no
                  tournaments matching your
                  filters.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter(
                      "ALL"
                    );

                    setSearchQuery(
                      ""
                    );

                    setShowCreateModal(
                      true
                    );
                  }}
                  className="mt-6 rounded-lg border border-[#f2b632]/60 px-5 py-3 text-sm font-bold text-[#f2b632] transition hover:bg-[#f2b632] hover:text-[#050607]"
                >
                  Create Tournament
                </button>
              </section>
            )}

            {/* FOOTER */}

            <section className="mwops-footer">
              <p>
                MWOPS Competition Management
              </p>

              <p className="mwops-label">
                Operations Platform
              </p>
            </section>
          </div>
        </div>

        {/* CREATE MODAL */}

        {showCreateModal && (
          <CreateTournamentModal
            onClose={() =>
              setShowCreateModal(
                false
              )
            }
            onCreate={
              handleCreateTournament
            }
            creating={
              creating
            }
          />
        )}
      </main>
    </>
  );
}

export default Tournaments;