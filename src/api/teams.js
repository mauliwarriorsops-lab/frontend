/*
|--------------------------------------------------------------------------
| MWOPS TEAM API
|--------------------------------------------------------------------------
|
| Frontend API helpers for Teams and Players.
|
|--------------------------------------------------------------------------
*/

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");


/*
|--------------------------------------------------------------------------
| RESPONSE HANDLER
|--------------------------------------------------------------------------
*/

async function handleResponse(response) {
  let result = null;

  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    const message =
      result?.message ||
      result?.error ||
      result?.details ||
      `Request failed with status ${response.status}`;

    const error = new Error(message);

    error.status = response.status;

    error.response = {
      status: response.status,
      data: result,
    };

    throw error;
  }

  return result;
}


/*
|--------------------------------------------------------------------------
| RESPONSE DATA
|--------------------------------------------------------------------------
*/

function getResponseData(result) {
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
| GET ALL TEAMS
|--------------------------------------------------------------------------
*/

export async function getTeams() {
  const response = await fetch(
    `${API_BASE_URL}/teams`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  const result =
    await handleResponse(response);

  const data =
    getResponseData(result);

  /*
   * Backend may return:
   *
   * [
   *   ...
   * ]
   *
   * or:
   *
   * {
   *   teams: [...]
   * }
   */

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.teams)) {
    return data.teams;
  }

  return [];
}


/*
|--------------------------------------------------------------------------
| GET TEAM BY ID
|--------------------------------------------------------------------------
*/

export async function getTeam(id) {
  if (!id) {
    throw new Error(
      "Team ID is required."
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/teams/${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  const result =
    await handleResponse(response);

  return getResponseData(result);
}


/*
|--------------------------------------------------------------------------
| CREATE TEAM
|--------------------------------------------------------------------------
*/

export async function createTeam(payload = {}) {
  if (
    !payload ||
    typeof payload !== "object"
  ) {
    throw new Error(
      "Team payload is required."
    );
  }

  const name =
    String(
      payload.name || ""
    ).trim();

  if (!name) {
    throw new Error(
      "Team name is required."
    );
  }

  /*
   * IMPORTANT:
   *
   * Current MWOPS team schema uses
   * the team name.
   *
   * Do not send tag because the current
   * teams table does not have a tag column.
   */

  const response = await fetch(
    `${API_BASE_URL}/teams`,
    {
      method: "POST",

      headers: {
        Accept:
          "application/json",

        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        name,
      }),
    }
  );

  const result =
    await handleResponse(response);

  return getResponseData(result);
}


/*
|--------------------------------------------------------------------------
| UPDATE TEAM
|--------------------------------------------------------------------------
*/

export async function updateTeam(
  id,
  payload = {}
) {
  if (!id) {
    throw new Error(
      "Team ID is required."
    );
  }

  const name =
    String(
      payload.name || ""
    ).trim();

  if (!name) {
    throw new Error(
      "Team name is required."
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/teams/${encodeURIComponent(id)}`,
    {
      method: "PATCH",

      headers: {
        Accept:
          "application/json",

        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        name,
      }),
    }
  );

  const result =
    await handleResponse(response);

  return getResponseData(result);
}


/*
|--------------------------------------------------------------------------
| DELETE TEAM
|--------------------------------------------------------------------------
*/

export async function deleteTeam(id) {
  if (!id) {
    throw new Error(
      "Team ID is required."
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/teams/${encodeURIComponent(id)}`,
    {
      method: "DELETE",

      headers: {
        Accept:
          "application/json",
      },

      cache: "no-store",
    }
  );

  const result =
    await handleResponse(response);

  return getResponseData(result);
}


/*
|--------------------------------------------------------------------------
| GET ALL PLAYERS
|--------------------------------------------------------------------------
*/

export async function getPlayers() {
  const response = await fetch(
    `${API_BASE_URL}/players`,
    {
      method: "GET",

      headers: {
        Accept:
          "application/json",
      },

      cache: "no-store",
    }
  );

  const result =
    await handleResponse(response);

  const data =
    getResponseData(result);

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.players)) {
    return data.players;
  }

  return [];
}


/*
|--------------------------------------------------------------------------
| GET PLAYER BY ID
|--------------------------------------------------------------------------
*/

export async function getPlayer(id) {
  if (!id) {
    throw new Error(
      "Player ID is required."
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/players/${encodeURIComponent(id)}`,
    {
      method: "GET",

      headers: {
        Accept:
          "application/json",
      },

      cache: "no-store",
    }
  );

  const result =
    await handleResponse(response);

  return getResponseData(result);
}


/*
|--------------------------------------------------------------------------
| CREATE PLAYER
|--------------------------------------------------------------------------
*/

export async function createPlayer(
  payload = {}
) {
  if (
    !payload ||
    typeof payload !== "object"
  ) {
    throw new Error(
      "Player payload is required."
    );
  }

  const name =
    String(
      payload.name || ""
    ).trim();

  if (!name) {
    throw new Error(
      "Player name is required."
    );
  }

  const body = {
    name,
    username:
      payload.username
        ? String(
            payload.username
          ).trim()
        : null,
  };

  /*
   * Only include team_id when a team
   * is actually being assigned.
   */
  if (payload.team_id) {
    body.team_id =
      payload.team_id;
  }

  const response = await fetch(
    `${API_BASE_URL}/players`,
    {
      method: "POST",

      headers: {
        Accept:
          "application/json",

        "Content-Type":
          "application/json",
      },

      body: JSON.stringify(body),
    }
  );

  const result =
    await handleResponse(response);

  return getResponseData(result);
}


/*
|--------------------------------------------------------------------------
| UPDATE PLAYER
|--------------------------------------------------------------------------
*/

export async function updatePlayer(
  id,
  payload = {}
) {
  if (!id) {
    throw new Error(
      "Player ID is required."
    );
  }

  const body = {};

  if (
    payload.name !== undefined
  ) {
    body.name =
      String(
        payload.name
      ).trim();
  }

  if (
    payload.username !== undefined
  ) {
    body.username =
      payload.username
        ? String(
            payload.username
          ).trim()
        : null;
  }

  if (
    payload.team_id !== undefined
  ) {
    body.team_id =
      payload.team_id;
  }

  const response = await fetch(
    `${API_BASE_URL}/players/${encodeURIComponent(id)}`,
    {
      method: "PATCH",

      headers: {
        Accept:
          "application/json",

        "Content-Type":
          "application/json",
      },

      body: JSON.stringify(body),
    }
  );

  const result =
    await handleResponse(response);

  return getResponseData(result);
}


/*
|--------------------------------------------------------------------------
| DELETE PLAYER
|--------------------------------------------------------------------------
*/

export async function deletePlayer(id) {
  if (!id) {
    throw new Error(
      "Player ID is required."
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/players/${encodeURIComponent(id)}`,
    {
      method: "DELETE",

      headers: {
        Accept:
          "application/json",
      },

      cache: "no-store",
    }
  );

  const result =
    await handleResponse(response);

  return getResponseData(result);
}


/*
|--------------------------------------------------------------------------
| DEFAULT EXPORT
|--------------------------------------------------------------------------
*/

const teamsApi = {
  getTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,

  getPlayers,
  getPlayer,
  createPlayer,
  updatePlayer,
  deletePlayer,
};

export default teamsApi;