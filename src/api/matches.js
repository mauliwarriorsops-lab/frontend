/*
|--------------------------------------------------------------------------
| MWOPS MATCH API
|--------------------------------------------------------------------------
|
| Frontend API helpers for Match Operations.
|
| MATCH CREATION MODES
|
|   live
|     -> Match is created immediately as LIVE.
|
|   scheduled
|     -> Match is created as SCHEDULED.
|
| The controller chooses the mode from the Quick Match Setup UI.
|
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| API CONFIGURATION
|--------------------------------------------------------------------------
|
| Local development:
|   VITE_API_URL=http://localhost:5000/api
|
| Production:
|   VITE_API_URL=https://backend-no95.onrender.com/api
|
| The production fallback prevents a deployed Vercel build
| from accidentally trying to call localhost.
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
| CONSTANTS
|--------------------------------------------------------------------------
*/

const MATCH_CREATE_STATUSES = [
  "live",
  "scheduled",
];

/*
|--------------------------------------------------------------------------
| CACHE CONTROL
|--------------------------------------------------------------------------
*/

function getNoStoreHeaders(
  includeJson = false
) {
  return {
    Accept: "application/json",

    ...(includeJson
      ? {
          "Content-Type":
            "application/json",
        }
      : {}),

    "Cache-Control":
      "no-cache, no-store, must-revalidate",

    Pragma: "no-cache",

    Expires: "0",
  };
}

/*
|--------------------------------------------------------------------------
| RESPONSE HANDLER
|--------------------------------------------------------------------------
*/

async function handleResponse(
  response
) {
  let result = null;

  try {
    result =
      await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    const message =
      result?.message ||
      result?.error ||
      result?.details ||
      `Request failed with status ${response.status}`;

    const error =
      new Error(message);

    error.status =
      response.status;

    error.code =
      result?.code;

    error.details =
      result?.details;

    error.response = {
      status:
        response.status,

      data:
        result,
    };

    throw error;
  }

  return result;
}

/*
|--------------------------------------------------------------------------
| NORMALIZE API RESULT
|--------------------------------------------------------------------------
*/

function getResponseData(
  result
) {
  if (
    result &&
    typeof result === "object" &&
    result.data !== undefined
  ) {
    return result.data;
  }

  return result;
}

/*
|--------------------------------------------------------------------------
| NORMALIZE MATCH STATUS
|--------------------------------------------------------------------------
*/

function normalizeMatchStatus(
  status,
  fallback = "scheduled"
) {
  const value =
    String(
      status ||
        fallback
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

/*
|--------------------------------------------------------------------------
| VALIDATE CREATE STATUS
|--------------------------------------------------------------------------
*/

function validateCreateStatus(
  status
) {
  const normalized =
    normalizeMatchStatus(
      status,
      "scheduled"
    );

  if (
    !MATCH_CREATE_STATUSES.includes(
      normalized
    )
  ) {
    throw new Error(
      "Match status must be either Live or Scheduled."
    );
  }

  return normalized;
}

/*
|--------------------------------------------------------------------------
| GET MATCHES
|--------------------------------------------------------------------------
*/

export async function getMatches({
  status = "ALL",
  tournamentId = "",
  search = "",
} = {}) {
  const params =
    new URLSearchParams();

  if (
    status &&
    String(
      status
    ).toUpperCase() !==
      "ALL"
  ) {
    params.set(
      "status",
      normalizeMatchStatus(
        status
      )
    );
  }

  if (tournamentId) {
    params.set(
      "tournamentId",
      String(
        tournamentId
      )
    );
  }

  if (
    search &&
    String(
      search
    ).trim()
  ) {
    params.set(
      "search",
      String(
        search
      ).trim()
    );
  }

  const query =
    params.toString();

  const cacheBuster =
    `_mwops_ts=${Date.now()}`;

  const url = query
    ? `${API_BASE_URL}/matches?${query}&${cacheBuster}`
    : `${API_BASE_URL}/matches?${cacheBuster}`;

  let response;

  try {
    response =
      await fetch(
        url,
        {
          method: "GET",

          headers:
            getNoStoreHeaders(),

          cache:
            "no-store",
        }
      );
  } catch (
    networkError
  ) {
    console.error(
      "MWOPS - GET MATCHES NETWORK ERROR:",
      networkError
    );

    throw new Error(
      `Unable to reach MWOPS backend at ${API_BASE_URL}. Check that the backend is running and VITE_API_URL is correct.`
    );
  }

  const result =
    await handleResponse(
      response
    );

  const data =
    getResponseData(
      result
    );

  return Array.isArray(
    data
  )
    ? data
    : [];
}

/*
|--------------------------------------------------------------------------
| GET MATCH BY ID
|--------------------------------------------------------------------------
*/

export async function getMatch(
  id
) {
  if (!id) {
    throw new Error(
      "Match ID is required"
    );
  }

  const url =
    `${API_BASE_URL}/matches/${encodeURIComponent(
      id
    )}?_mwops_ts=${Date.now()}`;

  let response;

  try {
    response =
      await fetch(
        url,
        {
          method: "GET",

          headers:
            getNoStoreHeaders(),

          cache:
            "no-store",
        }
      );
  } catch (
    networkError
  ) {
    console.error(
      "MWOPS - GET MATCH NETWORK ERROR:",
      networkError
    );

    throw new Error(
      "Unable to reach the MWOPS backend."
    );
  }

  const result =
    await handleResponse(
      response
    );

  return getResponseData(
    result
  );
}

/*
|--------------------------------------------------------------------------
| NORMALIZE TEAM SLOTS
|--------------------------------------------------------------------------
*/

function normalizeTeamSlots(
  teamSlots
) {
  if (
    !Array.isArray(
      teamSlots
    )
  ) {
    return [];
  }

  return teamSlots
    .map(
      (
        slotData
      ) => {
        if (
          !slotData ||
          typeof slotData !==
            "object"
        ) {
          return null;
        }

        const slotNumber =
          Number(
            slotData.slot
          );

        if (
          !Number.isInteger(
            slotNumber
          ) ||
          slotNumber < 1
        ) {
          return null;
        }

        const teamId =
          slotData.team_id
            ? String(
                slotData.team_id
              ).trim()
            : null;

        const teamName =
          slotData.team_name
            ? String(
                slotData.team_name
              ).trim()
            : "";

        const teamTag =
          slotData.team_tag
            ? String(
                slotData.team_tag
              ).trim()
            : "";

        const players =
          Array.isArray(
            slotData.players
          )
            ? slotData.players
                .map(
                  (
                    player
                  ) => {
                    if (
                      !player ||
                      typeof player !==
                        "object"
                    ) {
                      return null;
                    }

                    const playerId =
                      player.player_id
                        ? String(
                            player.player_id
                          ).trim()
                        : null;

                    const gamerTag =
                      player.gamer_tag
                        ? String(
                            player.gamer_tag
                          ).trim()
                        : "";

                    const realName =
                      player.real_name
                        ? String(
                            player.real_name
                          ).trim()
                        : "";

                    const avatarUrl =
                      player.avatar_url
                        ? String(
                            player.avatar_url
                          ).trim()
                        : "";

                    if (
                      !playerId &&
                      !gamerTag
                    ) {
                      return null;
                    }

                    return {
                      ...(playerId
                        ? {
                            player_id:
                              playerId,
                          }
                        : {}),

                      gamer_tag:
                        gamerTag,

                      ...(realName
                        ? {
                            real_name:
                              realName,
                          }
                        : {}),

                      ...(avatarUrl
                        ? {
                            avatar_url:
                              avatarUrl,
                          }
                        : {}),
                    };
                  }
                )
                .filter(Boolean)
            : [];

        if (
          !teamId &&
          !teamName
        ) {
          return null;
        }

        return {
          slot:
            slotNumber,

          ...(teamId
            ? {
                team_id:
                  teamId,
              }
            : {}),

          ...(teamName
            ? {
                team_name:
                  teamName,
              }
            : {}),

          ...(teamTag
            ? {
                team_tag:
                  teamTag,
              }
            : {}),

          players,
        };
      }
    )
    .filter(Boolean)
    .sort(
      (
        a,
        b
      ) =>
        a.slot -
        b.slot
    );
}

/*
|--------------------------------------------------------------------------
| CREATE MATCH
|--------------------------------------------------------------------------
*/

export async function createMatch(
  payload = {}
) {
  if (
    !payload ||
    typeof payload !==
      "object"
  ) {
    throw new Error(
      "Match payload is required"
    );
  }

  if (
    !payload.tournament_id
  ) {
    throw new Error(
      "Tournament ID is required"
    );
  }

  if (
    !payload.round_id
  ) {
    throw new Error(
      "Tournament round ID is required"
    );
  }

  if (
    !payload.name ||
    !String(
      payload.name
    ).trim()
  ) {
    throw new Error(
      "Match name is required"
    );
  }

  const selectedStatus =
    validateCreateStatus(
      payload.status
    );

  const normalizedTeamSlots =
    normalizeTeamSlots(
      payload.team_slots
    );

  const normalizedTeamIds =
    Array.isArray(
      payload.team_ids
    )
      ? [
          ...new Set(
            payload.team_ids
              .filter(Boolean)
              .map(
                (
                  id
                ) =>
                  String(
                    id
                  ).trim()
              )
              .filter(
                Boolean
              )
          ),
        ]
      : [];

  if (
    normalizedTeamSlots.length ===
      0 &&
    normalizedTeamIds.length ===
      0
  ) {
    throw new Error(
      "Add at least one team to the match before creating it."
    );
  }

  const normalizedPayload =
    {
      tournament_id:
        payload.tournament_id,

      round_id:
        payload.round_id,

      name:
        String(
          payload.name
        ).trim(),

      status:
        selectedStatus,

      scheduled_at:
        payload.scheduled_at ??
        null,

      team_slots:
        normalizedTeamSlots,
    };

  if (
    selectedStatus ===
    "scheduled"
  ) {
    if (
      payload.started_at !==
      undefined
    ) {
      normalizedPayload.started_at =
        null;
    }

    if (
      payload.ended_at !==
      undefined
    ) {
      normalizedPayload.ended_at =
        null;
    }
  }

  if (
    selectedStatus ===
    "live"
  ) {
    normalizedPayload.scheduled_at =
      null;

    if (
      payload.started_at !==
      undefined
    ) {
      normalizedPayload.started_at =
        payload.started_at ||
        null;
    }

    if (
      payload.ended_at !==
      undefined
    ) {
      normalizedPayload.ended_at =
        payload.ended_at ||
        null;
    }
  }

  if (
    normalizedTeamIds.length >
    0
  ) {
    normalizedPayload.team_ids =
      normalizedTeamIds;
  }

  if (
    payload.game !==
    undefined
  ) {
    normalizedPayload.game =
      payload.game
        ? String(
            payload.game
          ).trim()
        : null;
  }

  if (
    payload.map !==
    undefined
  ) {
    normalizedPayload.map =
      payload.map
        ? String(
            payload.map
          ).trim()
        : null;
  } else if (
    payload.map_name !==
    undefined
  ) {
    normalizedPayload.map =
      payload.map_name
        ? String(
            payload.map_name
          ).trim()
        : null;
  }

  if (
    selectedStatus ===
      "live" &&
    payload.started_at !==
      undefined
  ) {
    normalizedPayload.started_at =
      payload.started_at ||
      null;
  }

  if (
    selectedStatus ===
      "live" &&
    payload.ended_at !==
      undefined
  ) {
    normalizedPayload.ended_at =
      payload.ended_at ||
      null;
  }

  console.log(
    "MWOPS - CREATE MATCH REQUEST:",
    normalizedPayload
  );

  console.log(
    "MWOPS - CREATE MATCH MODE:",
    selectedStatus
  );

  console.log(
    "MWOPS - TEAM SLOTS:",
    normalizedPayload.team_slots
  );

  let response;

  try {
    response =
      await fetch(
        `${API_BASE_URL}/matches`,
        {
          method: "POST",

          headers:
            getNoStoreHeaders(
              true
            ),

          body:
            JSON.stringify(
              normalizedPayload
            ),

          cache:
            "no-store",
        }
      );
  } catch (
    networkError
  ) {
    console.error(
      "MWOPS - CREATE MATCH NETWORK ERROR:",
      networkError
    );

    throw new Error(
      "Unable to reach the MWOPS backend. Check that the backend server is running and the API URL is correct."
    );
  }

  const result =
    await handleResponse(
      response
    );

  const createdMatch =
    getResponseData(
      result
    );

  console.log(
    "MWOPS - CREATE MATCH RESPONSE:",
    createdMatch
  );

  const returnedStatus =
    normalizeMatchStatus(
      createdMatch?.status
    );

  if (
    createdMatch?.status &&
    returnedStatus !==
      selectedStatus
  ) {
    console.warn(
      "MWOPS - BACKEND RETURNED DIFFERENT MATCH STATUS:",
      {
        requested:
          selectedStatus,

        returned:
          createdMatch.status,
      }
    );
  }

  return createdMatch;
}

/*
|--------------------------------------------------------------------------
| UPDATE MATCH
|--------------------------------------------------------------------------
*/

export async function updateMatch(
  id,
  payload = {}
) {
  if (!id) {
    throw new Error(
      "Match ID is required"
    );
  }

  if (
    !payload ||
    typeof payload !==
      "object"
  ) {
    throw new Error(
      "Match update payload is required"
    );
  }

  const normalizedPayload =
    {
      ...payload,
    };

  if (
    payload.team_slots !==
    undefined
  ) {
    normalizedPayload.team_slots =
      normalizeTeamSlots(
        payload.team_slots
      );
  }

  if (
    normalizedPayload.status !==
    undefined
  ) {
    normalizedPayload.status =
      normalizeMatchStatus(
        normalizedPayload.status
      );
  }

  if (
    normalizedPayload.map_name !==
      undefined &&
    normalizedPayload.map ===
      undefined
  ) {
    normalizedPayload.map =
      normalizedPayload.map_name;
  }

  delete normalizedPayload.map_name;

  if (
    normalizedPayload.status ===
    "scheduled"
  ) {
    if (
      normalizedPayload.started_at !==
      undefined
    ) {
      normalizedPayload.started_at =
        null;
    }

    if (
      normalizedPayload.ended_at !==
      undefined
    ) {
      normalizedPayload.ended_at =
        null;
    }
  }

  if (
    normalizedPayload.status ===
    "live"
  ) {
    if (
      normalizedPayload.scheduled_at !==
      undefined
    ) {
      normalizedPayload.scheduled_at =
        null;
    }
  }

  console.log(
    "MWOPS - UPDATE MATCH REQUEST:",
    {
      id,
      payload:
        normalizedPayload,
    }
  );

  const response =
    await fetch(
      `${API_BASE_URL}/matches/${encodeURIComponent(
        id
      )}`,
      {
        method: "PATCH",

        headers:
          getNoStoreHeaders(
            true
          ),

        body:
          JSON.stringify(
            normalizedPayload
          ),

        cache:
          "no-store",
      }
    );

  const result =
    await handleResponse(
      response
    );

  return getResponseData(
    result
  );
}

/*
|--------------------------------------------------------------------------
| START MATCH
|--------------------------------------------------------------------------
*/

export async function startMatch(
  id
) {
  if (!id) {
    throw new Error(
      "Match ID is required"
    );
  }

  const response =
    await fetch(
      `${API_BASE_URL}/matches/${encodeURIComponent(
        id
      )}/start?_mwops_ts=${Date.now()}`,
      {
        method: "POST",

        headers:
          getNoStoreHeaders(),

        cache:
          "no-store",
      }
    );

  const result =
    await handleResponse(
      response
    );

  return getResponseData(
    result
  );
}

/*
|--------------------------------------------------------------------------
| PAUSE MATCH
|--------------------------------------------------------------------------
*/

export async function pauseMatch(
  id
) {
  if (!id) {
    throw new Error(
      "Match ID is required"
    );
  }

  const response =
    await fetch(
      `${API_BASE_URL}/matches/${encodeURIComponent(
        id
      )}/pause?_mwops_ts=${Date.now()}`,
      {
        method: "POST",

        headers:
          getNoStoreHeaders(),

        cache:
          "no-store",
      }
    );

  const result =
    await handleResponse(
      response
    );

  return getResponseData(
    result
  );
}

/*
|--------------------------------------------------------------------------
| RESUME MATCH
|--------------------------------------------------------------------------
*/

export async function resumeMatch(
  id
) {
  if (!id) {
    throw new Error(
      "Match ID is required"
    );
  }

  const response =
    await fetch(
      `${API_BASE_URL}/matches/${encodeURIComponent(
        id
      )}/resume?_mwops_ts=${Date.now()}`,
      {
        method: "POST",

        headers:
          getNoStoreHeaders(),

        cache:
          "no-store",
      }
    );

  const result =
    await handleResponse(
      response
    );

  return getResponseData(
    result
  );
}

/*
|--------------------------------------------------------------------------
| END MATCH
|--------------------------------------------------------------------------
*/

export async function endMatch(
  id
) {
  if (!id) {
    throw new Error(
      "Match ID is required"
    );
  }

  const response =
    await fetch(
      `${API_BASE_URL}/matches/${encodeURIComponent(
        id
      )}/end?_mwops_ts=${Date.now()}`,
      {
        method: "POST",

        headers:
          getNoStoreHeaders(),

        cache:
          "no-store",
      }
    );

  const result =
    await handleResponse(
      response
    );

  return getResponseData(
    result
  );
}

/*
|--------------------------------------------------------------------------
| DELETE MATCH
|--------------------------------------------------------------------------
*/

export async function deleteMatch(
  id
) {
  if (!id) {
    throw new Error(
      "Match ID is required"
    );
  }

  const response =
    await fetch(
      `${API_BASE_URL}/matches/${encodeURIComponent(
        id
      )}?_mwops_ts=${Date.now()}`,
      {
        method: "DELETE",

        headers:
          getNoStoreHeaders(),

        cache:
          "no-store",
      }
    );

  const result =
    await handleResponse(
      response
    );

  return getResponseData(
    result
  );
}

/*
|--------------------------------------------------------------------------
| DEFAULT EXPORT
|--------------------------------------------------------------------------
*/

export default {
  getMatches,
  getMatch,
  createMatch,
  updateMatch,
  startMatch,
  pauseMatch,
  resumeMatch,
  endMatch,
  deleteMatch,
};