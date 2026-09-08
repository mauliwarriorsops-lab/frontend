/*
|--------------------------------------------------------------------------
| MWOPS TOURNAMENT API
|--------------------------------------------------------------------------
|
| Frontend API helpers for Tournament Operations.
|
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
| RESPONSE HELPER
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
    throw new Error(
      result?.message ||
        result?.error ||
        `Request failed with status ${response.status}`
    );
  }

  return result;
}

/*
|--------------------------------------------------------------------------
| GET TOURNAMENTS
|--------------------------------------------------------------------------
*/

export async function getTournaments({
  status = "ALL",
  search = "",
} = {}) {
  const params =
    new URLSearchParams();

  if (
    status &&
    status !== "ALL"
  ) {
    params.set(
      "status",
      status
    );
  }

  if (
    search &&
    search.trim()
  ) {
    params.set(
      "search",
      search.trim()
    );
  }

  const queryString =
    params.toString();

  const url =
    queryString
      ? `${API_BASE_URL}/tournaments?${queryString}`
      : `${API_BASE_URL}/tournaments`;

  let response;

  try {
    response =
      await fetch(
        url,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json",
          },

          cache:
            "no-store",
        }
      );
  } catch (
    networkError
  ) {
    console.error(
      "MWOPS - GET TOURNAMENTS NETWORK ERROR:",
      networkError
    );

    throw new Error(
      `Unable to reach the MWOPS backend at ${API_BASE_URL}. Check that the backend is running and VITE_API_URL is correct.`
    );
  }

  const result =
    await handleResponse(
      response
    );

  return result.data || [];
}

/*
|--------------------------------------------------------------------------
| GET TOURNAMENT
|--------------------------------------------------------------------------
*/

export async function getTournament(
  id
) {
  if (!id) {
    throw new Error(
      "Tournament ID is required"
    );
  }

  let response;

  try {
    response =
      await fetch(
        `${API_BASE_URL}/tournaments/${encodeURIComponent(
          id
        )}`,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json",
          },

          cache:
            "no-store",
        }
      );
  } catch (
    networkError
  ) {
    console.error(
      "MWOPS - GET TOURNAMENT NETWORK ERROR:",
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

  return result.data;
}

/*
|--------------------------------------------------------------------------
| CREATE TOURNAMENT
|--------------------------------------------------------------------------
*/

export async function createTournament(
  payload
) {
  let response;

  try {
    response =
      await fetch(
        `${API_BASE_URL}/tournaments`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body:
            JSON.stringify(
              payload
            ),

          cache:
            "no-store",
        }
      );
  } catch (
    networkError
  ) {
    console.error(
      "MWOPS - CREATE TOURNAMENT NETWORK ERROR:",
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

  return result.data;
}

/*
|--------------------------------------------------------------------------
| UPDATE TOURNAMENT
|--------------------------------------------------------------------------
*/

export async function updateTournament(
  id,
  payload
) {
  if (!id) {
    throw new Error(
      "Tournament ID is required"
    );
  }

  let response;

  try {
    response =
      await fetch(
        `${API_BASE_URL}/tournaments/${encodeURIComponent(
          id
        )}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body:
            JSON.stringify(
              payload
            ),

          cache:
            "no-store",
        }
      );
  } catch (
    networkError
  ) {
    console.error(
      "MWOPS - UPDATE TOURNAMENT NETWORK ERROR:",
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

  return result.data;
}

/*
|--------------------------------------------------------------------------
| DELETE TOURNAMENT
|--------------------------------------------------------------------------
*/

export async function deleteTournament(
  id
) {
  if (!id) {
    throw new Error(
      "Tournament ID is required"
    );
  }

  let response;

  try {
    response =
      await fetch(
        `${API_BASE_URL}/tournaments/${encodeURIComponent(
          id
        )}`,
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
  } catch (
    networkError
  ) {
    console.error(
      "MWOPS - DELETE TOURNAMENT NETWORK ERROR:",
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

  return result.data;
}

/*
|--------------------------------------------------------------------------
| DEFAULT EXPORT
|--------------------------------------------------------------------------
*/

export default {
  getTournaments,
  getTournament,
  createTournament,
  updateTournament,
  deleteTournament,
};