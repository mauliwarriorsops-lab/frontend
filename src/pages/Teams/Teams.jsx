import {
  Check,
  CirclePlus,
  Copy,
  Grid3X3,
  Pencil,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  createPlayer,
  deletePlayer,
  getPlayers,
} from "../../api/teams.js";


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function unwrapResponse(response) {
  if (!response) {
    return null;
  }

  if (
    response?.data?.data !== undefined
  ) {
    return response.data.data;
  }

  if (
    response?.data !== undefined
  ) {
    return response.data;
  }

  return response;
}


function getTeamId(team) {
  return (
    team?.id ||
    team?.team_id ||
    null
  );
}


function getTeamName(team) {
  return (
    typeof team?.name === "string"
      ? team.name
      : typeof team?.team_name === "string"
        ? team.team_name
        : "Unnamed Team"
  );
}


function getTeamStatus(team) {
  const value = String(
    team?.status ||
    team?.state ||
    "active"
  ).toLowerCase();

  if (
    value === "inactive" ||
    value === "disabled" ||
    value === "archived"
  ) {
    return "inactive";
  }

  return "active";
}


function getTeamRoster(team) {
  if (
    Array.isArray(team?.players)
  ) {
    return team.players;
  }

  if (
    Array.isArray(team?.players_list)
  ) {
    return team.players_list;
  }

  if (
    Array.isArray(team?.roster)
  ) {
    return team.roster;
  }

  return [];
}


function getPlayerId(player) {
  return (
    player?.id ||
    player?.player_id ||
    player?.uuid ||
    null
  );
}


function getPlayerName(player) {
  return (
    typeof player?.name === "string"
      ? player.name
      : typeof player?.player_name === "string"
        ? player.player_name
        : "Unnamed Player"
  );
}


function getPlayerUsername(player) {
  return (
    player?.username ||
    player?.ign ||
    player?.in_game_name ||
    player?.player_username ||
    ""
  );
}


function normalizePlayer(
  player,
  index = 0
) {
  return {
    ...player,

    id:
      getPlayerId(player) ||
      `player-${index}`,

    name:
      getPlayerName(player),

    username:
      getPlayerUsername(player),
  };
}


function normalizeTeam(
  team,
  index = 0
) {
  const roster =
    getTeamRoster(team)
      .map(
        normalizePlayer
      );

  return {
    ...team,

    id:
      getTeamId(team) ||
      `team-${index}`,

    name:
      getTeamName(team),

    status:
      getTeamStatus(team),

    players:
      roster,

    player_count:
      Number(
        team?.player_count ??
        team?.players_count ??
        roster.length ??
        0
      ),
  };
}


/*
|--------------------------------------------------------------------------
| PLAYER API FALLBACK
|--------------------------------------------------------------------------
|
| The current frontend API has getPlayers(), but the old Teams.jsx was
| expecting getPlayersByTeam() from a missing frontend service.
|
| We therefore use getPlayers() and filter by team_id on the frontend.
|
|--------------------------------------------------------------------------
*/

async function getPlayersForTeam(
  teamId
) {
  if (!teamId) {
    return [];
  }

  const response =
    await getPlayers();

  const raw =
    unwrapResponse(
      response
    );

  const list =
    Array.isArray(raw)
      ? raw
      : Array.isArray(
          raw?.players
        )
          ? raw.players
          : Array.isArray(
              raw?.data
            )
              ? raw.data
              : [];

  return list
    .filter(
      (player) => {

        const playerTeamId =
          player?.team_id ||
          player?.teamId ||
          player?.team?.id ||
          null;

        return (
          String(
            playerTeamId
          ) ===
          String(
            teamId
          )
        );
      }
    )
    .map(
      normalizePlayer
    );
}


/*
|--------------------------------------------------------------------------
| STAT CARD
|--------------------------------------------------------------------------
*/

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}) {
  return (
    <div
      className="
        rounded-2xl
        border border-white/[0.06]
        bg-[#0d1014]
        p-5
        shadow-[0_20px_60px_rgba(0,0,0,.15)]
      "
    >

      <div
        className="
          flex
          items-center
          justify-between
        "
      >

        <div
          className="
            flex
            h-10 w-10
            items-center
            justify-center
            rounded-xl
            border
            border-yellow-400/10
            bg-yellow-400/[0.035]
            text-yellow-300
          "
        >
          <Icon size={17} />
        </div>

        <span
          className="
            h-1.5 w-1.5
            rounded-full
            bg-yellow-300
            shadow-[0_0_10px_rgba(253,224,71,.55)]
          "
        />

      </div>


      <div className="mt-5">

        <div
          className="
            text-[8px]
            font-black
            uppercase
            tracking-[0.18em]
            text-slate-600
          "
        >
          {label}
        </div>

        <div
          className="
            mt-1
            text-2xl
            font-black
            tracking-tight
            text-white
          "
        >
          {value}
        </div>

        {detail && (
          <div
            className="
              mt-1
              text-[8px]
              text-slate-700
            "
          >
            {detail}
          </div>
        )}

      </div>

    </div>
  );
}


/*
|--------------------------------------------------------------------------
| PAGE
|--------------------------------------------------------------------------
*/

export default function Teams() {

  const [teams, setTeams] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const [showTeamModal, setShowTeamModal] =
    useState(false);

  const [editingTeam, setEditingTeam] =
    useState(null);

  const [teamForm, setTeamForm] =
    useState({
      name: "",
    });

  const [selectedTeam, setSelectedTeam] =
    useState(null);

  const [selectedLoading, setSelectedLoading] =
    useState(false);

  const [showPlayerForm, setShowPlayerForm] =
    useState(false);

  const [playerForm, setPlayerForm] =
    useState({
      name: "",
      username: "",
    });


  /*
  |--------------------------------------------------------------------------
  | NOTICE
  |--------------------------------------------------------------------------
  */

  function showNoticeMessage(
    message
  ) {

    setNotice(
      message
    );

    window.clearTimeout(
      showNoticeMessage.timer
    );

    showNoticeMessage.timer =
      window.setTimeout(
        () => {
          setNotice("");
        },
        2600
      );
  }


  /*
  |--------------------------------------------------------------------------
  | LOAD TEAMS
  |--------------------------------------------------------------------------
  */

  async function loadTeams({
    silent = false,
  } = {}) {

    if (!silent) {
      setLoading(true);
    }

    setError("");

    try {

      const response =
        await getTeams();

      const raw =
        unwrapResponse(
          response
        );

      const list =
        Array.isArray(raw)
          ? raw
          : Array.isArray(
              raw?.teams
            )
              ? raw.teams
              : Array.isArray(
                  raw?.data
                )
                  ? raw.data
                  : [];

      const normalized =
        list.map(
          normalizeTeam
        );

      setTeams(
        normalized
      );

    } catch (err) {

      console.error(
        "MWOPS - LOAD TEAMS ERROR:",
        err
      );

      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Unable to load teams."
      );

    } finally {

      if (!silent) {
        setLoading(false);
      }

    }
  }


  /*
  |--------------------------------------------------------------------------
  | INITIAL LOAD
  |--------------------------------------------------------------------------
  */

  useEffect(() => {

    loadTeams();

  }, []);


  /*
  |--------------------------------------------------------------------------
  | REFRESH
  |--------------------------------------------------------------------------
  */

  async function handleRefresh() {

    if (refreshing) {
      return;
    }

    setRefreshing(true);

    try {

      await loadTeams({
        silent: true,
      });

      if (selectedTeam) {

        const id =
          getTeamId(
            selectedTeam
          );

        if (id) {

          await loadSelectedTeam(
            id
          );

        }
      }

      showNoticeMessage(
        "Team registry refreshed."
      );

    } catch (err) {

      console.error(
        "MWOPS - REFRESH ERROR:",
        err
      );

    } finally {

      setRefreshing(false);

    }
  }


  /*
  |--------------------------------------------------------------------------
  | FILTERED TEAMS
  |--------------------------------------------------------------------------
  */

  const filteredTeams =
    useMemo(() => {

      const query =
        search
          .trim()
          .toLowerCase();

      return teams.filter(
        (team) => {

          const name =
            getTeamName(
              team
            ).toLowerCase();

          const status =
            getTeamStatus(
              team
            );

          const matchesSearch =
            !query ||
            name.includes(
              query
            );

          const matchesStatus =
            statusFilter ===
              "all" ||
            status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );

    }, [
      teams,
      search,
      statusFilter,
    ]);


  /*
  |--------------------------------------------------------------------------
  | TEAM MODAL
  |--------------------------------------------------------------------------
  */

  function openCreateModal() {

    setEditingTeam(
      null
    );

    setTeamForm({
      name: "",
    });

    setError("");

    setShowTeamModal(
      true
    );
  }


  function openEditModal(
    team
  ) {

    setEditingTeam(
      team
    );

    setTeamForm({
      name:
        getTeamName(
          team
        ),
    });

    setError("");

    setShowTeamModal(
      true
    );
  }


  function closeTeamModal() {

    if (saving) {
      return;
    }

    setShowTeamModal(
      false
    );

    setEditingTeam(
      null
    );

    setTeamForm({
      name: "",
    });

    setError("");
  }


  function handleTeamFormChange(
    event
  ) {

    setTeamForm({
      name:
        event.target.value,
    });
  }


  /*
  |--------------------------------------------------------------------------
  | SAVE TEAM
  |--------------------------------------------------------------------------
  */

  async function handleSaveTeam(
    event
  ) {

    event.preventDefault();

    const name =
      teamForm.name.trim();

    if (!name) {

      setError(
        "Team name is required."
      );

      return;
    }

    setSaving(true);
    setError("");

    try {

      if (editingTeam) {

        const id =
          getTeamId(
            editingTeam
          );

        if (!id) {

          throw new Error(
            "Team ID is missing."
          );
        }

        await updateTeam(
          id,
          {
            name,
          }
        );

        showNoticeMessage(
          "Team updated successfully."
        );

      } else {

        await createTeam({
          name,
        });

        showNoticeMessage(
          "Team created successfully."
        );
      }

      closeTeamModal();

      await loadTeams({
        silent: true,
      });

    } catch (err) {

      console.error(
        "MWOPS - SAVE TEAM ERROR:",
        err
      );

      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Unable to save team."
      );

    } finally {

      setSaving(false);

    }
  }


  /*
  |--------------------------------------------------------------------------
  | DELETE TEAM
  |--------------------------------------------------------------------------
  */

  async function handleDeleteTeam(
    team
  ) {

    const id =
      getTeamId(
        team
      );

    if (!id) {

      setError(
        "Team ID is missing."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${getTeamName(team)}"? This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError("");

    try {

      await deleteTeam(
        id
      );

      if (
        selectedTeam &&
        String(
          getTeamId(
            selectedTeam
          )
        ) ===
        String(id)
      ) {

        setSelectedTeam(
          null
        );
      }

      showNoticeMessage(
        "Team deleted successfully."
      );

      await loadTeams({
        silent: true,
      });

    } catch (err) {

      console.error(
        "MWOPS - DELETE TEAM ERROR:",
        err
      );

      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Unable to delete team."
      );

    } finally {

      setSaving(false);

    }
  }


  /*
  |--------------------------------------------------------------------------
  | LOAD SELECTED TEAM
  |--------------------------------------------------------------------------
  */

  async function loadSelectedTeam(
    teamId
  ) {

    if (!teamId) {
      return;
    }

    setSelectedLoading(
      true
    );

    setError("");

    try {

      let detailed = null;

      /*
       * Load the actual team.
       */

      try {

        const response =
          await getTeam(
            teamId
          );

        detailed =
          normalizeTeam(
            unwrapResponse(
              response
            )
          );

      } catch (teamError) {

        console.warn(
          "MWOPS - TEAM DETAILS FALLBACK:",
          teamError
        );

        detailed =
          teams.find(
            (team) =>
              String(
                getTeamId(
                  team
                )
              ) ===
              String(
                teamId
              )
          ) || {
            id:
              teamId,
            name:
              "Team",
          };
      }


      /*
       * Load players.
       *
       * We use the existing frontend
       * getPlayers() API and filter by
       * team_id.
       */

      let players = [];

      try {

        players =
          await getPlayersForTeam(
            teamId
          );

      } catch (playerError) {

        console.warn(
          "MWOPS - ROSTER LOAD ERROR:",
          playerError
        );

        players =
          getTeamRoster(
            detailed
          ).map(
            normalizePlayer
          );
      }


      setSelectedTeam({
        ...detailed,

        id:
          teamId,

        players,

        player_count:
          players.length,
      });

    } catch (err) {

      console.error(
        "MWOPS - LOAD TEAM ERROR:",
        err
      );

      setError(
        err?.response?.data?.message ||
        err?.message ||
        "Unable to load team."
      );

    } finally {

      setSelectedLoading(
        false
      );
    }
  }


  /*
  |--------------------------------------------------------------------------
  | OPEN TEAM
  |--------------------------------------------------------------------------
  */

  async function openTeam(
    team
  ) {

    const id =
      getTeamId(
        team
      );

    if (!id) {

      setError(
        "This team does not have a valid ID."
      );

      return;
    }

    await loadSelectedTeam(
      id
    );
  }


  /*
  |--------------------------------------------------------------------------
  | CLOSE SELECTED TEAM
  |--------------------------------------------------------------------------
  */

  function closeSelectedTeam() {

    if (saving) {
      return;
    }

    setSelectedTeam(
      null
    );

    setShowPlayerForm(
      false
    );

    setPlayerForm({
      name: "",
      username: "",
    });
  }


  /*
  |--------------------------------------------------------------------------
  | PLAYER FORM
  |--------------------------------------------------------------------------
  */

  function handlePlayerFormChange(
    event
  ) {

    const {
      name,
      value,
    } = event.target;

    setPlayerForm(
      (current) => ({
        ...current,
        [name]:
          value,
      })
    );
  }


  /*
  |--------------------------------------------------------------------------
  | ADD PLAYER
  |--------------------------------------------------------------------------
  */

  async function handleAddPlayer(
    event
  ) {

    event.preventDefault();

    if (!selectedTeam) {
      return;
    }

    const teamId =
      getTeamId(
        selectedTeam
      );

    if (!teamId) {

      setError(
        "Selected team has no valid ID."
      );

      return;
    }

    const name =
      playerForm.name.trim();

    const username =
      playerForm.username.trim();

    if (!name) {

      setError(
        "Player name is required."
      );

      return;
    }

    setSaving(true);
    setError("");

    try {

      /*
       * IMPORTANT:
       *
       * Send team_id so the backend
       * associates the player with
       * this team.
       */

      await createPlayer({
        name,
        username:
          username || null,
        team_id:
          teamId,
      });

      setPlayerForm({
        name: "",
        username: "",
      });

      setShowPlayerForm(
        false
      );

      showNoticeMessage(
        `${name} added to ${getTeamName(selectedTeam)}.`
      );

      await loadSelectedTeam(
        teamId
      );

      await loadTeams({
        silent: true,
      });

    } catch (err) {

      console.error(
        "MWOPS - ADD PLAYER ERROR:",
        err
      );

      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Unable to add player."
      );

    } finally {

      setSaving(false);

    }
  }


  /*
  |--------------------------------------------------------------------------
  | DELETE PLAYER
  |--------------------------------------------------------------------------
  */

  async function handleDeletePlayer(
    player
  ) {

    if (!selectedTeam) {
      return;
    }

    const playerId =
      getPlayerId(
        player
      );

    if (!playerId) {

      setError(
        "Player ID is missing."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Remove "${getPlayerName(player)}" from this team?`
      );

    if (!confirmed) {
      return;
    }

    const teamId =
      getTeamId(
        selectedTeam
      );

    setSaving(true);
    setError("");

    try {

      await deletePlayer(
        playerId
      );

      showNoticeMessage(
        "Player removed."
      );

      await loadSelectedTeam(
        teamId
      );

      await loadTeams({
        silent: true,
      });

    } catch (err) {

      console.error(
        "MWOPS - DELETE PLAYER ERROR:",
        err
      );

      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Unable to remove player."
      );

    } finally {

      setSaving(false);

    }
  }


  /*
  |--------------------------------------------------------------------------
  | COPY TEAM ID
  |--------------------------------------------------------------------------
  */

  async function handleCopyTeamId(
    team
  ) {

    const id =
      getTeamId(
        team
      );

    if (!id) {
      return;
    }

    try {

      await navigator.clipboard.writeText(
        String(id)
      );

      showNoticeMessage(
        "Team ID copied."
      );

    } catch (err) {

      console.error(
        "MWOPS - COPY ERROR:",
        err
      );

      setError(
        "Unable to copy team ID."
      );
    }
  }


  /*
  |--------------------------------------------------------------------------
  | STATS
  |--------------------------------------------------------------------------
  */

  const totalTeams =
    teams.length;

  const activeTeams =
    teams.filter(
      (team) =>
        getTeamStatus(
          team
        ) === "active"
    ).length;

  const totalPlayers =
    teams.reduce(
      (
        total,
        team
      ) => {

        const roster =
          getTeamRoster(
            team
          );

        if (
          roster.length
        ) {
          return (
            total +
            roster.length
          );
        }

        return (
          total +
          Number(
            team?.player_count ??
            team?.players_count ??
            0
          )
        );
      },
      0
    );


  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <div
      className="
        min-h-screen
        bg-[#080a0c]
        px-4
        py-5
        text-white
        sm:px-6
        lg:px-8
      "
    >

      {/* ================================================================
          BACKGROUND
      ================================================================ */}

      <div
        className="
          pointer-events-none
          fixed
          inset-0
          opacity-[0.035]
        "
        style={{
          backgroundImage:
            `
              linear-gradient(
                rgba(255,255,255,.08) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(255,255,255,.08) 1px,
                transparent 1px
              )
            `,
          backgroundSize:
            "36px 36px",
        }}
      />


      <div
        className="
          relative
          mx-auto
          max-w-[1500px]
        "
      >

        {/* ==============================================================
            HEADER
        ============================================================== */}

        <header
          className="
            rounded-[26px]
            border
            border-white/[0.065]
            bg-[#0d1014]
            px-5
            py-5
            shadow-[0_25px_80px_rgba(0,0,0,.2)]
            sm:px-6
          "
        >

          <div
            className="
              flex
              flex-col
              justify-between
              gap-5
              lg:flex-row
              lg:items-center
            "
          >

            <div>

              <div
                className="
                  flex
                  items-center
                  gap-2
                "
              >

                <span
                  className="
                    h-1.5
                    w-1.5
                    animate-pulse
                    rounded-full
                    bg-yellow-300
                    shadow-[0_0_10px_rgba(253,224,71,.55)]
                  "
                />

                <span
                  className="
                    text-[7px]
                    font-black
                    uppercase
                    tracking-[0.24em]
                    text-yellow-400
                  "
                >
                  MWOPS / TEAM NETWORK
                </span>

              </div>


              <h1
                className="
                  mt-3
                  text-2xl
                  font-black
                  uppercase
                  tracking-[-0.03em]
                  text-white
                  sm:text-3xl
                "
              >
                Teams
              </h1>


              <p
                className="
                  mt-2
                  max-w-xl
                  text-[9px]
                  leading-5
                  text-slate-600
                "
              >
                Register competitive
                organizations, manage
                team rosters, and prepare
                players for tournament
                operations.
              </p>

            </div>


            <div
              className="
                flex
                flex-wrap
                items-center
                gap-2
              "
            >

              <button
                type="button"
                onClick={
                  handleRefresh
                }
                disabled={
                  refreshing
                }
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-xl
                  border
                  border-white/[0.08]
                  bg-white/[0.025]
                  px-4
                  py-3
                  text-[8px]
                  font-black
                  uppercase
                  tracking-[0.1em]
                  text-slate-400
                  transition
                  hover:border-yellow-400/15
                  hover:bg-yellow-400/[0.025]
                  hover:text-white
                  disabled:cursor-wait
                  disabled:opacity-50
                "
              >

                <RefreshCw
                  size={14}
                  className={
                    refreshing
                      ? "animate-spin"
                      : ""
                  }
                />

                Refresh

              </button>


              <button
                type="button"
                onClick={
                  openCreateModal
                }
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-xl
                  bg-yellow-400
                  px-4
                  py-3
                  text-[8px]
                  font-black
                  uppercase
                  tracking-[0.1em]
                  text-[#17130a]
                  transition
                  hover:bg-yellow-300
                "
              >

                <CirclePlus
                  size={15}
                />

                Add Team

              </button>

            </div>

          </div>

        </header>


        {/* ==============================================================
            ERROR
        ============================================================== */}

        {error && (
          <div
            className="
              mt-4
              flex
              items-start
              justify-between
              gap-4
              rounded-xl
              border
              border-red-400/15
              bg-red-400/[0.04]
              px-4
              py-3
              text-[8px]
              text-red-300
            "
          >

            <span>
              {error}
            </span>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="
                text-red-300/60
                hover:text-red-200
              "
            >
              <X size={14} />
            </button>

          </div>
        )}


        {/* ==============================================================
            NOTICE
        ============================================================== */}

        {notice && (
          <div
            className="
              fixed
              bottom-5
              right-5
              z-[100]
              flex
              items-center
              gap-2
              rounded-xl
              border
              border-yellow-400/20
              bg-[#101318]
              px-4
              py-3
              text-[8px]
              font-black
              uppercase
              tracking-[0.08em]
              text-yellow-300
              shadow-[0_20px_60px_rgba(0,0,0,.45)]
            "
          >

            <Check size={14} />

            {notice}

          </div>
        )}


        {/* ==============================================================
            STATS
        ============================================================== */}

        <section
          className="
            mt-5
            grid
            gap-4
            sm:grid-cols-2
            xl:grid-cols-4
          "
        >

          <StatCard
            icon={Users}
            label="Total Teams"
            value={totalTeams}
            detail="Registered organizations"
          />

          <StatCard
            icon={Shield}
            label="Active Teams"
            value={activeTeams}
            detail="Operational teams"
          />

          <StatCard
            icon={UserPlus}
            label="Total Players"
            value={totalPlayers}
            detail="Registered roster members"
          />

          <StatCard
            icon={Grid3X3}
            label="Displayed"
            value={
              filteredTeams.length
            }
            detail="Current registry view"
          />

        </section>


        {/* ==============================================================
            FILTER BAR
        ============================================================== */}

        <section
          className="
            mt-5
            rounded-2xl
            border
            border-white/[0.06]
            bg-[#0d1014]
            p-4
          "
        >

          <div
            className="
              flex
              flex-col
              gap-3
              lg:flex-row
              lg:items-center
              lg:justify-between
            "
          >

            <div
              className="
                relative
                w-full
                lg:max-w-md
              "
            >

              <Search
                size={14}
                className="
                  pointer-events-none
                  absolute
                  left-3
                  top-1/2
                  -translate-y-1/2
                  text-slate-700
                "
              />

              <input
                value={
                  search
                }
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search teams..."
                className="
                  h-11
                  w-full
                  rounded-xl
                  border
                  border-white/[0.07]
                  bg-black/20
                  pl-9
                  pr-4
                  text-[9px]
                  text-white
                  outline-none
                  placeholder:text-slate-700
                  focus:border-yellow-400/20
                "
              />

            </div>


            <div
              className="
                flex
                items-center
                gap-2
              "
            >

              {[
                {
                  label: "All",
                  value: "all",
                },
                {
                  label: "Active",
                  value: "active",
                },
                {
                  label: "Inactive",
                  value: "inactive",
                },
              ].map(
                (filter) => (

                  <button
                    key={
                      filter.value
                    }
                    type="button"
                    onClick={() =>
                      setStatusFilter(
                        filter.value
                      )
                    }
                    className={`
                      rounded-lg
                      border
                      px-3
                      py-2.5
                      text-[7px]
                      font-black
                      uppercase
                      tracking-[0.1em]
                      transition
                      ${
                        statusFilter ===
                        filter.value
                          ? "border-yellow-400/15 bg-yellow-400/[0.07] text-yellow-300"
                          : "border-white/[0.05] bg-white/[0.018] text-slate-600 hover:text-white"
                      }
                    `}
                  >
                    {filter.label}
                  </button>

                )
              )}

            </div>

          </div>

        </section>


        {/* ==============================================================
            TEAM REGISTRY
        ============================================================== */}

        <section
          className="
            mt-5
            overflow-hidden
            rounded-[26px]
            border
            border-white/[0.065]
            bg-[#0d1014]
            shadow-[0_25px_80px_rgba(0,0,0,.18)]
          "
        >

          <div
            className="
              flex
              items-center
              justify-between
              border-b
              border-white/[0.055]
              px-5
              py-4
              sm:px-6
            "
          >

            <div
              className="
                flex
                items-center
                gap-3
              "
            >

              <div
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-yellow-400/10
                  bg-yellow-400/[0.035]
                  text-yellow-300
                "
              >
                <Grid3X3
                  size={15}
                />
              </div>


              <div>

                <div
                  className="
                    text-[7px]
                    font-black
                    uppercase
                    tracking-[0.18em]
                    text-yellow-400
                  "
                >
                  Organization Registry
                </div>

                <div
                  className="
                    mt-1
                    text-[10px]
                    font-black
                    uppercase
                    text-white
                  "
                >
                  Registered Teams
                </div>

              </div>

            </div>


            <div
              className="
                font-mono
                text-[7px]
                text-slate-700
              "
            >
              {filteredTeams.length}
              /
              {totalTeams}
            </div>

          </div>


          {loading ? (

            <div
              className="
                flex
                min-h-[300px]
                items-center
                justify-center
              "
            >

              <RefreshCw
                size={22}
                className="
                  animate-spin
                  text-yellow-300
                "
              />

            </div>

          ) : filteredTeams.length === 0 ? (

            <div
              className="
                px-6
                py-20
                text-center
              "
            >

              <div
                className="
                  mx-auto
                  flex
                  h-16
                  w-16
                  items-center
                  justify-center
                  rounded-2xl
                  border
                  border-white/[0.06]
                  bg-white/[0.02]
                  text-slate-700
                "
              >
                <Users
                  size={24}
                />
              </div>


              <div
                className="
                  mt-5
                  text-[9px]
                  font-black
                  uppercase
                  tracking-[0.16em]
                  text-white
                "
              >
                {teams.length
                  ? "No matching teams"
                  : "No teams registered"}
              </div>


              <p
                className="
                  mx-auto
                  mt-2
                  max-w-md
                  text-[8px]
                  leading-5
                  text-slate-600
                "
              >
                {teams.length
                  ? "Try another search term or change the status filter."
                  : "Create your first team to begin managing tournament rosters."}
              </p>


              <button
                type="button"
                onClick={
                  teams.length
                    ? () => {
                        setSearch("");
                        setStatusFilter(
                          "all"
                        );
                      }
                    : openCreateModal
                }
                className="
                  mt-6
                  inline-flex
                  items-center
                  gap-2
                  rounded-xl
                  bg-yellow-400
                  px-4
                  py-2.5
                  text-[7px]
                  font-black
                  uppercase
                  tracking-[0.12em]
                  text-[#17130a]
                  transition
                  hover:bg-yellow-300
                "
              >

                {teams.length ? (
                  <>
                    <X size={13} />
                    Clear Filters
                  </>
                ) : (
                  <>
                    <CirclePlus size={13} />
                    Create Team
                  </>
                )}

              </button>

            </div>

          ) : (

            <div
              className="
                grid
                gap-3
                p-4
                sm:p-5
                lg:grid-cols-2
                xl:grid-cols-3
              "
            >

              {filteredTeams.map(
                (
                  team,
                  index
                ) => {

                  const id =
                    getTeamId(
                      team
                    );

                  const name =
                    getTeamName(
                      team
                    );

                  const status =
                    getTeamStatus(
                      team
                    );

                  const roster =
                    getTeamRoster(
                      team
                    );

                  const playerCount =
                    roster.length ||
                    Number(
                      team?.player_count ??
                      team?.players_count ??
                      0
                    );

                  return (

                    <article
                      key={
                        id ||
                        index
                      }
                      className="
                        group
                        overflow-hidden
                        rounded-2xl
                        border
                        border-white/[0.055]
                        bg-[#101318]
                        transition
                        hover:border-yellow-400/15
                        hover:bg-[#11151a]
                      "
                    >

                      <div
                        className="p-4"
                      >

                        <div
                          className="
                            flex
                            items-start
                            justify-between
                            gap-3
                          "
                        >

                          <button
                            type="button"
                            onClick={() =>
                              openTeam(
                                team
                              )
                            }
                            className="
                              flex
                              min-w-0
                              items-center
                              gap-3
                              text-left
                            "
                          >

                            <div
                              className="
                                flex
                                h-11
                                w-11
                                shrink-0
                                items-center
                                justify-center
                                rounded-xl
                                border
                                border-yellow-400/10
                                bg-yellow-400/[0.04]
                                text-xs
                                font-black
                                uppercase
                                text-yellow-300
                              "
                            >
                              {name
                                .slice(
                                  0,
                                  2
                                )
                                .toUpperCase()}
                            </div>


                            <div
                              className="
                                min-w-0
                              "
                            >

                              <div
                                className="
                                  truncate
                                  text-sm
                                  font-black
                                  text-white
                                "
                              >
                                {name}
                              </div>

                              <div
                                className="
                                  mt-1
                                  font-mono
                                  text-[7px]
                                  text-slate-700
                                "
                              >
                                {id}
                              </div>

                            </div>

                          </button>


                          <span
                            className={`
                              shrink-0
                              rounded-full
                              border
                              px-2
                              py-1
                              text-[6px]
                              font-black
                              uppercase
                              tracking-[0.1em]
                              ${
                                status ===
                                "active"
                                  ? "border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-300"
                                  : "border-slate-400/10 bg-slate-400/[0.04] text-slate-500"
                              }
                            `}
                          >
                            {status}
                          </span>

                        </div>


                        <div
                          className="
                            mt-5
                            grid
                            grid-cols-2
                            gap-2
                          "
                        >

                          <div
                            className="
                              rounded-xl
                              border
                              border-white/[0.045]
                              bg-black/[0.12]
                              p-3
                            "
                          >

                            <div
                              className="
                                text-[6px]
                                font-black
                                uppercase
                                tracking-[0.14em]
                                text-slate-700
                              "
                            >
                              Roster
                            </div>

                            <div
                              className="
                                mt-1
                                text-sm
                                font-black
                                text-white
                              "
                            >
                              {playerCount}
                            </div>

                          </div>


                          <div
                            className="
                              rounded-xl
                              border
                              border-white/[0.045]
                              bg-black/[0.12]
                              p-3
                            "
                          >

                            <div
                              className="
                                text-[6px]
                                font-black
                                uppercase
                                tracking-[0.14em]
                                text-slate-700
                              "
                            >
                              Team ID
                            </div>

                            <div
                              className="
                                mt-1
                                truncate
                                font-mono
                                text-[8px]
                                text-slate-500
                              "
                            >
                              {id || "—"}
                            </div>

                          </div>

                        </div>


                        <div
                          className="
                            mt-4
                            grid
                            grid-cols-[1fr_auto_auto]
                            gap-2
                          "
                        >

                          <button
                            type="button"
                            onClick={() =>
                              openTeam(
                                team
                              )
                            }
                            className="
                              inline-flex
                              items-center
                              justify-center
                              gap-2
                              rounded-xl
                              border
                              border-yellow-400/10
                              bg-yellow-400/[0.04]
                              px-3
                              py-2.5
                              text-[7px]
                              font-black
                              uppercase
                              tracking-[0.1em]
                              text-yellow-300
                              transition
                              hover:bg-yellow-400/[0.08]
                            "
                          >

                            <Users
                              size={13}
                            />

                            Roster

                          </button>


                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(
                                team
                              )
                            }
                            className="
                              flex
                              h-10
                              w-10
                              items-center
                              justify-center
                              rounded-xl
                              border
                              border-white/[0.06]
                              bg-white/[0.02]
                              text-slate-500
                              transition
                              hover:border-yellow-400/15
                              hover:text-yellow-300
                            "
                            title="Edit team"
                          >
                            <Pencil
                              size={14}
                            />
                          </button>


                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteTeam(
                                team
                              )
                            }
                            disabled={
                              saving
                            }
                            className="
                              flex
                              h-10
                              w-10
                              items-center
                              justify-center
                              rounded-xl
                              border
                              border-white/[0.06]
                              bg-white/[0.02]
                              text-slate-600
                              transition
                              hover:border-red-400/15
                              hover:bg-red-400/[0.04]
                              hover:text-red-300
                              disabled:opacity-40
                            "
                            title="Delete team"
                          >
                            <Trash2
                              size={14}
                            />
                          </button>

                        </div>

                      </div>

                    </article>
                  );
                }
              )}

            </div>

          )}

        </section>

      </div>


      {/* ================================================================
          CREATE / EDIT TEAM MODAL
      ================================================================ */}

      {showTeamModal && (
        <div
          className="
            fixed
            inset-0
            z-[80]
            flex
            items-center
            justify-center
            bg-black/75
            p-4
            backdrop-blur-sm
          "
          onMouseDown={(
            event
          ) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              closeTeamModal();
            }

          }}
        >

          <div
            className="
              w-full
              max-w-md
              overflow-hidden
              rounded-2xl
              border
              border-white/[0.08]
              bg-[#0d1014]
              shadow-[0_30px_100px_rgba(0,0,0,.6)]
            "
          >

            <div
              className="
                flex
                items-center
                justify-between
                border-b
                border-white/[0.06]
                px-5
                py-4
              "
            >

              <div>

                <div
                  className="
                    text-[7px]
                    font-black
                    uppercase
                    tracking-[0.18em]
                    text-yellow-400
                  "
                >
                  Team Registry
                </div>

                <div
                  className="
                    mt-1
                    text-sm
                    font-black
                    text-white
                  "
                >
                  {editingTeam
                    ? "Edit Team"
                    : "Create Team"}
                </div>

              </div>


              <button
                type="button"
                onClick={
                  closeTeamModal
                }
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-lg
                  border
                  border-white/[0.06]
                  text-slate-600
                  hover:text-white
                "
              >
                <X
                  size={15}
                />
              </button>

            </div>


            <form
              onSubmit={
                handleSaveTeam
              }
              className="p-5"
            >

              <label
                className="
                  block
                  text-[7px]
                  font-black
                  uppercase
                  tracking-[0.14em]
                  text-slate-500
                "
              >
                Team Name
              </label>


              <input
                autoFocus
                value={
                  teamForm.name
                }
                onChange={
                  handleTeamFormChange
                }
                placeholder="Enter team name"
                className="
                  mt-2
                  h-12
                  w-full
                  rounded-xl
                  border
                  border-white/[0.07]
                  bg-black/20
                  px-4
                  text-sm
                  font-bold
                  text-white
                  outline-none
                  placeholder:text-slate-700
                  focus:border-yellow-400/20
                "
              />


              {error && (
                <div
                  className="
                    mt-3
                    rounded-xl
                    border
                    border-red-400/15
                    bg-red-400/[0.04]
                    px-3
                    py-2.5
                    text-[8px]
                    text-red-300
                  "
                >
                  {error}
                </div>
              )}


              <div
                className="
                  mt-5
                  flex
                  justify-end
                  gap-2
                "
              >

                <button
                  type="button"
                  onClick={
                    closeTeamModal
                  }
                  disabled={
                    saving
                  }
                  className="
                    rounded-xl
                    border
                    border-white/[0.07]
                    bg-white/[0.02]
                    px-4
                    py-3
                    text-[7px]
                    font-black
                    uppercase
                    tracking-[0.1em]
                    text-slate-500
                    hover:text-white
                    disabled:opacity-40
                  "
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="
                    inline-flex
                    items-center
                    gap-2
                    rounded-xl
                    bg-yellow-400
                    px-5
                    py-3
                    text-[7px]
                    font-black
                    uppercase
                    tracking-[0.1em]
                    text-[#17130a]
                    disabled:cursor-wait
                    disabled:opacity-50
                  "
                >

                  {saving ? (
                    <RefreshCw
                      size={13}
                      className="animate-spin"
                    />
                  ) : (
                    <Check
                      size={13}
                    />
                  )}

                  {editingTeam
                    ? "Save Changes"
                    : "Create Team"}

                </button>

              </div>

            </form>

          </div>

        </div>
      )}


      {/* ================================================================
          TEAM ROSTER MODAL
      ================================================================ */}

      {selectedTeam && (
        <div
          className="
            fixed
            inset-0
            z-[70]
            flex
            items-center
            justify-center
            bg-black/80
            p-4
            backdrop-blur-sm
          "
          onMouseDown={(
            event
          ) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              closeSelectedTeam();
            }

          }}
        >

          <div
            className="
              flex
              max-h-[90vh]
              w-full
              max-w-3xl
              flex-col
              overflow-hidden
              rounded-2xl
              border
              border-white/[0.08]
              bg-[#0d1014]
              shadow-[0_30px_100px_rgba(0,0,0,.65)]
            "
          >

            {/* HEADER */}

            <div
              className="
                flex
                items-center
                justify-between
                border-b
                border-white/[0.06]
                px-5
                py-4
              "
            >

              <div
                className="
                  flex
                  min-w-0
                  items-center
                  gap-3
                "
              >

                <div
                  className="
                    flex
                    h-11
                    w-11
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-yellow-400/10
                    bg-yellow-400/[0.04]
                    text-xs
                    font-black
                    text-yellow-300
                  "
                >
                  {getTeamName(
                    selectedTeam
                  )
                    .slice(
                      0,
                      2
                    )
                    .toUpperCase()}
                </div>


                <div
                  className="
                    min-w-0
                  "
                >

                  <div
                    className="
                      truncate
                      text-sm
                      font-black
                      text-white
                    "
                  >
                    {getTeamName(
                      selectedTeam
                    )}
                  </div>

                  <div
                    className="
                      mt-1
                      text-[7px]
                      uppercase
                      tracking-[0.14em]
                      text-slate-600
                    "
                  >
                    Team Roster
                  </div>

                </div>

              </div>


              <div
                className="
                  flex
                  items-center
                  gap-2
                "
              >

                <button
                  type="button"
                  onClick={() =>
                    handleCopyTeamId(
                      selectedTeam
                    )
                  }
                  className="
                    flex
                    h-9
                    w-9
                    items-center
                    justify-center
                    rounded-lg
                    border
                    border-white/[0.06]
                    text-slate-600
                    hover:text-yellow-300
                  "
                  title="Copy team ID"
                >
                  <Copy
                    size={14}
                  />
                </button>


                <button
                  type="button"
                  onClick={
                    closeSelectedTeam
                  }
                  className="
                    flex
                    h-9
                    w-9
                    items-center
                    justify-center
                    rounded-lg
                    border
                    border-white/[0.06]
                    text-slate-600
                    hover:text-white
                  "
                >
                  <X
                    size={15}
                  />
                </button>

              </div>

            </div>


            {/* BODY */}

            <div
              className="
                flex-1
                overflow-y-auto
                p-5
              "
            >

              {/* ADD PLAYER */}

              <div
                className="
                  rounded-2xl
                  border
                  border-white/[0.055]
                  bg-black/[0.12]
                "
              >

                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-3
                    border-b
                    border-white/[0.05]
                    px-4
                    py-3
                  "
                >

                  <div>

                    <div
                      className="
                        text-[7px]
                        font-black
                        uppercase
                        tracking-[0.16em]
                        text-yellow-400
                      "
                    >
                      Roster Management
                    </div>

                    <div
                      className="
                        mt-1
                        text-[8px]
                        text-slate-600
                      "
                    >
                      Add players to this team
                    </div>

                  </div>


                  <button
                    type="button"
                    onClick={() =>
                      setShowPlayerForm(
                        (current) =>
                          !current
                      )
                    }
                    className="
                      inline-flex
                      items-center
                      gap-2
                      rounded-lg
                      bg-yellow-400
                      px-3
                      py-2
                      text-[7px]
                      font-black
                      uppercase
                      tracking-[0.1em]
                      text-[#17130a]
                    "
                  >

                    <UserPlus
                      size={13}
                    />

                    Add Player

                  </button>

                </div>


                {showPlayerForm && (
                  <form
                    onSubmit={
                      handleAddPlayer
                    }
                    className="
                      grid
                      gap-3
                      p-4
                      sm:grid-cols-[1fr_1fr_auto]
                    "
                  >

                    <input
                      name="name"
                      value={
                        playerForm.name
                      }
                      onChange={
                        handlePlayerFormChange
                      }
                      placeholder="Player name"
                      className="
                        h-11
                        rounded-xl
                        border
                        border-white/[0.07]
                        bg-[#090b0d]
                        px-3
                        text-[9px]
                        text-white
                        outline-none
                        placeholder:text-slate-700
                        focus:border-yellow-400/20
                      "
                    />


                    <input
                      name="username"
                      value={
                        playerForm.username
                      }
                      onChange={
                        handlePlayerFormChange
                      }
                      placeholder="IGN / Username"
                      className="
                        h-11
                        rounded-xl
                        border
                        border-white/[0.07]
                        bg-[#090b0d]
                        px-3
                        text-[9px]
                        text-white
                        outline-none
                        placeholder:text-slate-700
                        focus:border-yellow-400/20
                      "
                    />


                    <button
                      type="submit"
                      disabled={
                        saving
                      }
                      className="
                        h-11
                        rounded-xl
                        bg-yellow-400
                        px-4
                        text-[7px]
                        font-black
                        uppercase
                        tracking-[0.1em]
                        text-[#17130a]
                        disabled:opacity-50
                      "
                    >
                      Add
                    </button>

                  </form>
                )}

              </div>


              {/* ROSTER */}

              <div
                className="
                  mt-4
                  overflow-hidden
                  rounded-2xl
                  border
                  border-white/[0.055]
                  bg-black/[0.12]
                "
              >

                <div
                  className="
                    flex
                    items-center
                    justify-between
                    border-b
                    border-white/[0.05]
                    px-4
                    py-3
                  "
                >

                  <div
                    className="
                      flex
                      items-center
                      gap-2
                    "
                  >

                    <Users
                      size={14}
                      className="text-yellow-300"
                    />

                    <span
                      className="
                        text-[8px]
                        font-black
                        uppercase
                        tracking-[0.12em]
                        text-white
                      "
                    >
                      Players
                    </span>

                  </div>


                  <span
                    className="
                      rounded-full
                      border
                      border-yellow-400/10
                      bg-yellow-400/[0.04]
                      px-2
                      py-1
                      text-[7px]
                      font-black
                      text-yellow-300
                    "
                  >
                    {
                      Array.isArray(
                        selectedTeam.players
                      )
                        ? selectedTeam.players.length
                        : 0
                    }
                  </span>

                </div>


                {selectedLoading ? (

                  <div
                    className="
                      flex
                      min-h-[180px]
                      items-center
                      justify-center
                    "
                  >

                    <RefreshCw
                      size={20}
                      className="
                        animate-spin
                        text-yellow-300
                      "
                    />

                  </div>

                ) : !Array.isArray(
                    selectedTeam.players
                  ) ||
                  selectedTeam.players.length ===
                    0 ? (

                  <div
                    className="
                      px-5
                      py-14
                      text-center
                    "
                  >

                    <Users
                      size={25}
                      className="
                        mx-auto
                        text-slate-700
                      "
                    />

                    <div
                      className="
                        mt-3
                        text-[8px]
                        font-black
                        uppercase
                        tracking-[0.12em]
                        text-slate-500
                      "
                    >
                      No players registered
                    </div>

                    <p
                      className="
                        mt-1
                        text-[7px]
                        text-slate-700
                      "
                    >
                      Add players using the
                      roster controls above.
                    </p>

                  </div>

                ) : (

                  <div
                    className="
                      divide-y
                      divide-white/[0.04]
                    "
                  >

                    {selectedTeam.players.map(
                      (
                        player,
                        index
                      ) => {

                        const playerId =
                          getPlayerId(
                            player
                          );

                        return (

                          <div
                            key={
                              playerId ||
                              index
                            }
                            className="
                              flex
                              items-center
                              justify-between
                              gap-3
                              px-4
                              py-3
                            "
                          >

                            <div
                              className="
                                flex
                                min-w-0
                                items-center
                                gap-3
                              "
                            >

                              <div
                                className="
                                  flex
                                  h-9
                                  w-9
                                  shrink-0
                                  items-center
                                  justify-center
                                  rounded-lg
                                  border
                                  border-white/[0.06]
                                  bg-white/[0.02]
                                  text-[8px]
                                  font-black
                                  text-slate-500
                                "
                              >
                                {String(
                                  index + 1
                                ).padStart(
                                  2,
                                  "0"
                                )}
                              </div>


                              <div
                                className="
                                  min-w-0
                                "
                              >

                                <div
                                  className="
                                    truncate
                                    text-[9px]
                                    font-black
                                    text-white
                                  "
                                >
                                  {getPlayerName(
                                    player
                                  )}
                                </div>


                                <div
                                  className="
                                    mt-1
                                    truncate
                                    text-[7px]
                                    text-slate-700
                                  "
                                >
                                  {getPlayerUsername(
                                    player
                                  ) ||
                                    "No username"}
                                </div>

                              </div>

                            </div>


                            <button
                              type="button"
                              onClick={() =>
                                handleDeletePlayer(
                                  player
                                )
                              }
                              disabled={
                                saving
                              }
                              className="
                                flex
                                h-8
                                w-8
                                shrink-0
                                items-center
                                justify-center
                                rounded-lg
                                border
                                border-white/[0.05]
                                text-slate-700
                                transition
                                hover:border-red-400/15
                                hover:bg-red-400/[0.04]
                                hover:text-red-300
                                disabled:opacity-30
                              "
                              title="Remove player"
                            >
                              <UserMinus
                                size={13}
                              />
                            </button>

                          </div>

                        );
                      }
                    )}

                  </div>

                )}

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}