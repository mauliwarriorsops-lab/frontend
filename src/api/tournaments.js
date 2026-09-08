/*
|--------------------------------------------------------------------------
| MWOPS TOURNAMENT API
|--------------------------------------------------------------------------
*/

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

/*
|--------------------------------------------------------------------------
| RESPONSE HELPER
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
    throw new Error(
      result?.message ||
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
  const params = new URLSearchParams();

  if (status && status !== "ALL") {
    params.set("status", status);
  }

  if (search.trim()) {
    params.set("search", search.trim());
  }

  const queryString = params.toString();

  const url = queryString
    ? `${API_BASE_URL}/tournaments?${queryString}`
    : `${API_BASE_URL}/tournaments`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const result = await handleResponse(response);

  return result.data || [];
}

/*
|--------------------------------------------------------------------------
| GET TOURNAMENT
|--------------------------------------------------------------------------
*/

export async function getTournament(id) {
  if (!id) {
    throw new Error("Tournament ID is required");
  }

  const response = await fetch(
    `${API_BASE_URL}/tournaments/${id}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }
  );

  const result = await handleResponse(response);

  return result.data;
}

/*
|--------------------------------------------------------------------------
| CREATE TOURNAMENT
|--------------------------------------------------------------------------
*/

export async function createTournament(payload) {
  const response = await fetch(
    `${API_BASE_URL}/tournaments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const result = await handleResponse(response);

  return result.data;
}

/*
|--------------------------------------------------------------------------
| UPDATE TOURNAMENT
|--------------------------------------------------------------------------
*/

export async function updateTournament(id, payload) {
  if (!id) {
    throw new Error("Tournament ID is required");
  }

  const response = await fetch(
    `${API_BASE_URL}/tournaments/${id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const result = await handleResponse(response);

  return result.data;
}

/*
|--------------------------------------------------------------------------
| DELETE TOURNAMENT
|--------------------------------------------------------------------------
*/

export async function deleteTournament(id) {
  if (!id) {
    throw new Error("Tournament ID is required");
  }

  const response = await fetch(
    `${API_BASE_URL}/tournaments/${id}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    }
  );

  const result = await handleResponse(response);

  return result.data;
}