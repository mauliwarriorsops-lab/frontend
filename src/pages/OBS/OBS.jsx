import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/*
|--------------------------------------------------------------------------
| MWOPS OBS SETTINGS
|--------------------------------------------------------------------------
|
| OBS WebSocket settings and broadcast control page.
|
| Backend endpoints:
|
| GET  /api/obs
| POST /api/obs/connect
| POST /api/obs/disconnect
| GET  /api/obs/scenes
| GET  /api/obs/scenes/current
| POST /api/obs/scenes/switch
| POST /api/obs/stream/start
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
| DEFAULT STATE
|--------------------------------------------------------------------------
*/

const EMPTY_STATE = {
  connected: false,
  streaming: false,
  currentScene: null,
  scenes: [],
};

/*
|--------------------------------------------------------------------------
| LIVE OBS SYNC
|--------------------------------------------------------------------------
|
| Keep the OBS production state synchronized without requiring a manual
| refresh. This is a lightweight polling fallback and can later be
| replaced/augmented by backend realtime events.
|
|--------------------------------------------------------------------------
*/

const OBS_STATUS_REFRESH_INTERVAL = 1000;
const OBS_REQUEST_TIMEOUT = 5000;

/*
|--------------------------------------------------------------------------
| API HELPER
|--------------------------------------------------------------------------
*/

async function apiRequest(
  endpoint,
  options = {}
) {
  const {
    timeout = OBS_REQUEST_TIMEOUT,
    cacheBust = true,
    signal: externalSignal,
    ...requestOptions
  } = options;

  const separator =
    endpoint.includes("?")
      ? "&"
      : "?";

  const requestUrl = cacheBust
    ? `${API_BASE_URL}${endpoint}${separator}_mwops_ts=${Date.now()}`
    : `${API_BASE_URL}${endpoint}`;

  const controller =
    new AbortController();

  let timeoutId = null;

  const abortFromExternal =
    () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener(
        "abort",
        abortFromExternal,
        { once: true }
      );
    }
  }

  if (
    Number.isFinite(timeout) &&
    timeout > 0
  ) {
    timeoutId = window.setTimeout(
      () => controller.abort(),
      timeout
    );
  }

  try {
    const response = await fetch(
      requestUrl,
      {
        ...requestOptions,
        signal: controller.signal,
        headers: {
          Accept:
            "application/json",
          "Content-Type":
            "application/json",
          ...(requestOptions.headers || {}),
        },
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
          payload?.error ||
          `Request failed with status ${response.status}`
      );
    }

    return payload;
  } catch (requestError) {
    if (
      requestError?.name ===
      "AbortError"
    ) {
      throw new Error(
        "OBS request timed out."
      );
    }

    throw requestError;
  } finally {
    if (timeoutId) {
      window.clearTimeout(
        timeoutId
      );
    }

    if (externalSignal) {
      externalSignal.removeEventListener(
        "abort",
        abortFromExternal
      );
    }
  }
}

/*
|--------------------------------------------------------------------------
| UNWRAP API RESPONSE
|--------------------------------------------------------------------------
*/

function unwrapResponse(payload) {
  if (!payload) {
    return null;
  }

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

  return payload;
}

/*
|--------------------------------------------------------------------------
| NORMALIZE OBS STATUS
|--------------------------------------------------------------------------
*/

function normalizeOBSState(payload) {
  const data =
    unwrapResponse(payload) || {};

  const connected =
    Boolean(
      data.connected ??
      data.isConnected ??
      data.connection?.connected ??
      false
    );

  const streaming =
    Boolean(
      data.streaming ??
      data.isStreaming ??
      data.stream?.active ??
      false
    );

  return {
    connected,
    streaming,

    currentScene:
      data.currentScene ??
      data.current_scene ??
      data.scene ??
      data.current?.scene ??
      null,

    scenes:
      Array.isArray(data.scenes)
        ? data.scenes
        : [],
  };
}

/*
|--------------------------------------------------------------------------
| OBS PAGE
|--------------------------------------------------------------------------
*/

function OBS() {
  const navigate = useNavigate();

  const [
    obs,
    setOBS,
  ] = useState(EMPTY_STATE);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    actionLoading,
    setActionLoading,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  /*
  |--------------------------------------------------------------------------
  | LIVE SYNC REFS
  |--------------------------------------------------------------------------
  */

  const statusRequestInFlightRef =
    useRef(false);

  const mountedRef =
    useRef(true);

  const [
    syncing,
    setSyncing,
  ] = useState(false);

  const [
    lastSyncedAt,
    setLastSyncedAt,
  ] = useState(null);

  const [
    host,
    setHost,
  ] = useState(
    localStorage.getItem(
      "mwops_obs_host"
    ) || "127.0.0.1"
  );

  const [
    port,
    setPort,
  ] = useState(
    localStorage.getItem(
      "mwops_obs_port"
    ) || "4455"
  );

  const [
    password,
    setPassword,
  ] = useState("");

  /*
  |--------------------------------------------------------------------------
  | FETCH OBS STATUS
  |--------------------------------------------------------------------------
  */

  const loadOBSStatus =
    useCallback(
      async (
        options = {}
      ) => {
        const {
          silent = false,
        } = options;

        if (
          statusRequestInFlightRef.current
        ) {
          return null;
        }

        statusRequestInFlightRef.current =
          true;

        if (!silent) {
          setError("");
          setLoading(true);
        }

        if (
          mountedRef.current
        ) {
          setSyncing(true);
        }

        try {
          const payload =
            await apiRequest(
              "/obs"
            );

          const normalized =
            normalizeOBSState(
              payload
            );

          if (
            mountedRef.current
          ) {
            setOBS(
              normalized
            );

            const now =
              Date.now();

            setLastSyncedAt(
              now
            );

            /*
            |--------------------------------------------------------------------------
            | A successful background request clears a stale connection error.
            |--------------------------------------------------------------------------
            */

            if (silent) {
              setError("");
            }
          }

          return normalized;
        } catch (requestError) {
          console.error(
            "OBS status request failed:",
            requestError
          );

          /*
          |--------------------------------------------------------------------------
          | Keep the last known good state during silent/background sync.
          |--------------------------------------------------------------------------
          */

          if (
            !silent &&
            mountedRef.current
          ) {
            setError(
              requestError?.message ||
                "Unable to retrieve OBS status."
            );
          }
        } finally {
          statusRequestInFlightRef.current =
            false;

          if (
            mountedRef.current
          ) {
            setSyncing(false);

            if (!silent) {
              setLoading(false);
            }
          }
        }

        return null;
      },
      []
    );

  /*
  |--------------------------------------------------------------------------
  | LOAD SCENES
  |--------------------------------------------------------------------------
  */

  const loadScenes =
    useCallback(async () => {
      if (!obs.connected) {
        return;
      }

      try {
        const [
          scenesResponse,
          currentResponse,
        ] = await Promise.all([
          apiRequest(
            "/obs/scenes"
          ),
          apiRequest(
            "/obs/scenes/current"
          ),
        ]);

        const scenesData =
          unwrapResponse(
            scenesResponse
          );

        const currentData =
          unwrapResponse(
            currentResponse
          );

        const scenes =
          Array.isArray(
            scenesData
          )
            ? scenesData
            : Array.isArray(
                scenesData?.scenes
              )
            ? scenesData.scenes
            : [];

        const currentScene =
          currentData?.currentScene ??
          currentData?.current_scene ??
          currentData?.scene ??
          currentData;

        setOBS((previous) => ({
          ...previous,

          scenes,

          currentScene:
            typeof currentScene ===
              "string"
              ? currentScene
              : previous.currentScene,
        }));
      } catch (requestError) {
        console.error(
          "Unable to load OBS scenes:",
          requestError
        );

        setError(
          requestError?.message ||
            "Unable to load OBS scenes."
        );
      }
    }, [obs.connected]);

  /*
  |--------------------------------------------------------------------------
  | INITIAL LOAD
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    mountedRef.current = true;

    loadOBSStatus();

    const syncStatus = () => {
      if (
        document.visibilityState ===
        "hidden"
      ) {
        return;
      }

      loadOBSStatus({
        silent: true,
      });
    };

    const intervalId =
      window.setInterval(
        syncStatus,
        OBS_STATUS_REFRESH_INTERVAL
      );

    const handleVisibility =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          loadOBSStatus({
            silent: true,
          });
        }
      };

    const handleFocus =
      () => {
        loadOBSStatus({
          silent: true,
        });
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
  }, [loadOBSStatus]);

  /*
  |--------------------------------------------------------------------------
  | LOAD SCENES AFTER CONNECTION
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (obs.connected) {
      loadScenes();
    }
  }, [
    obs.connected,
    loadScenes,
  ]);

  /*
  |--------------------------------------------------------------------------
  | REFRESH SCENES WHILE CONNECTED
  |--------------------------------------------------------------------------
  |
  | Scene changes can also be made directly in OBS Studio, so keep the
  | scene list/current scene synchronized independently of the faster
  | connection/stream status polling.
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!obs.connected) {
      return undefined;
    }

    let active = true;

    const syncScenes = async () => {
      if (
        !active ||
        document.visibilityState ===
          "hidden"
      ) {
        return;
      }

      await loadScenes();
    };

    const intervalId =
      window.setInterval(
        syncScenes,
        2500
      );

    return () => {
      active = false;

      window.clearInterval(
        intervalId
      );
    };
  }, [
    obs.connected,
    loadScenes,
  ]);

  /*
  |--------------------------------------------------------------------------
  | CLEAR MESSAGE
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer =
      setTimeout(() => {
        setMessage("");
      }, 4000);

    return () =>
      clearTimeout(timer);
  }, [message]);

  /*
  |--------------------------------------------------------------------------
  | CONNECT OBS
  |--------------------------------------------------------------------------
  */

  const connectOBS =
    async () => {
      try {
        setActionLoading(
          "connect"
        );

        setError("");
        setMessage("");

        const cleanHost =
          host.trim();

        const cleanPort =
          Number.parseInt(
            port,
            10
          );

        if (!cleanHost) {
          throw new Error(
            "OBS host is required."
          );
        }

        if (
          !Number.isFinite(
            cleanPort
          ) ||
          cleanPort <= 0 ||
          cleanPort > 65535
        ) {
          throw new Error(
            "Enter a valid OBS WebSocket port."
          );
        }

        localStorage.setItem(
          "mwops_obs_host",
          cleanHost
        );

        localStorage.setItem(
          "mwops_obs_port",
          String(cleanPort)
        );

        await apiRequest(
          "/obs/connect",
          {
            method: "POST",

            body: JSON.stringify({
              host: cleanHost,
              port: cleanPort,
              password:
                password || undefined,
            }),
          }
        );

        setMessage(
          "OBS connected successfully."
        );

        await loadOBSStatus();
      } catch (requestError) {
        console.error(
          "OBS connection failed:",
          requestError
        );

        setError(
          requestError?.message ||
            "Unable to connect to OBS."
        );
      } finally {
        setActionLoading("");
      }
    };

  /*
  |--------------------------------------------------------------------------
  | DISCONNECT OBS
  |--------------------------------------------------------------------------
  */

  const disconnectOBS =
    async () => {
      try {
        setActionLoading(
          "disconnect"
        );

        setError("");
        setMessage("");

        await apiRequest(
          "/obs/disconnect",
          {
            method: "POST",
          }
        );

        setOBS(
          EMPTY_STATE
        );

        setLastSyncedAt(
          Date.now()
        );

        setMessage(
          "OBS disconnected."
        );
      } catch (requestError) {
        console.error(
          "OBS disconnect failed:",
          requestError
        );

        setError(
          requestError?.message ||
            "Unable to disconnect OBS."
        );
      } finally {
        setActionLoading("");
      }
    };

  /*
  |--------------------------------------------------------------------------
  | SWITCH SCENE
  |--------------------------------------------------------------------------
  */

  const switchScene =
    async (sceneName) => {
      if (!sceneName) {
        return;
      }

      try {
        setActionLoading(
          `scene:${sceneName}`
        );

        setError("");
        setMessage("");

        await apiRequest(
          "/obs/scenes/switch",
          {
            method: "POST",

            body: JSON.stringify({
              sceneName,
            }),
          }
        );

        setOBS((previous) => ({
          ...previous,
          currentScene:
            sceneName,
        }));

        setLastSyncedAt(
          Date.now()
        );

        setMessage(
          `Switched to ${sceneName}.`
        );
      } catch (requestError) {
        console.error(
          "OBS scene switch failed:",
          requestError
        );

        setError(
          requestError?.message ||
            "Unable to switch OBS scene."
        );
      } finally {
        setActionLoading("");
      }
    };

  /*
  |--------------------------------------------------------------------------
  | START STREAM
  |--------------------------------------------------------------------------
  */

  const startStream =
    async () => {
      try {
        setActionLoading(
          "stream"
        );

        setError("");
        setMessage("");

        await apiRequest(
          "/obs/stream/start",
          {
            method: "POST",
          }
        );

        setOBS((previous) => ({
          ...previous,
          streaming: true,
        }));

        setLastSyncedAt(
          Date.now()
        );

        setMessage(
          "Stream start command sent to OBS."
        );

        await loadOBSStatus();
      } catch (requestError) {
        console.error(
          "OBS stream request failed:",
          requestError
        );

        setError(
          requestError?.message ||
            "Unable to start OBS stream."
        );
      } finally {
        setActionLoading("");
      }
    };

  /*
  |--------------------------------------------------------------------------
  | REFRESH
  |--------------------------------------------------------------------------
  */

  const refresh =
    async () => {
      setError("");

      const latest =
        await loadOBSStatus({
          silent: false,
        });

      if (
        latest?.connected
      ) {
        await loadScenes();
      }
    };

  /*
  |--------------------------------------------------------------------------
  | SCENE LIST
  |--------------------------------------------------------------------------
  */

  const sceneList =
    useMemo(() => {
      return obs.scenes.map(
        (scene, index) => {
          if (
            typeof scene ===
            "string"
          ) {
            return {
              id: scene,
              name: scene,
            };
          }

          return {
            id:
              scene?.sceneIndex ??
              scene?.id ??
              scene?.sceneName ??
              `scene-${index}`,

            name:
              scene?.sceneName ??
              scene?.name ??
              `Scene ${index + 1}`,
          };
        }
      );
    }, [obs.scenes]);

  /*
  |--------------------------------------------------------------------------
  | STATUS
  |--------------------------------------------------------------------------
  */

  const connectionLabel =
    obs.connected
      ? "CONNECTED"
      : "DISCONNECTED";

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <>
      <style>{`

        * {
          box-sizing: border-box;
        }

        html,
        body,
        #root {
          margin: 0;
          min-height: 100%;
          background: #050607;
        }

        body {
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        button,
        input {
          font-family: inherit;
        }

        .mwops-obs {
          min-height: 100vh;
          padding: 30px 34px 50px;
          background:
            radial-gradient(
              circle at 78% 0%,
              rgba(230,174,61,0.08),
              transparent 28%
            ),
            #050607;
          color: #f4f2eb;
        }

        .obs-container {
          width: 100%;
          max-width: 1700px;
          margin: 0 auto;
        }

        .obs-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 25px;
          padding-bottom: 25px;
          border-bottom:
            1px solid
            rgba(255,255,255,0.08);
        }

        .obs-eyebrow {
          color: #e6ae3d;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 2.8px;
          text-transform: uppercase;
        }

        .obs-title {
          margin: 9px 0 0;
          font-size: clamp(40px, 5vw, 68px);
          font-weight: 950;
          line-height: 0.95;
          letter-spacing: -3px;
          text-transform: uppercase;
        }

        .obs-title span {
          color: #e6ae3d;
        }

        .obs-description {
          max-width: 620px;
          margin: 16px 0 0;
          color: #81878c;
          font-size: 12px;
          line-height: 1.7;
        }

        .obs-header-actions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .obs-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 38px;
          padding:
            0
            15px;
          border:
            1px solid
            rgba(255,255,255,0.12);
          border-radius: 3px;
          background:
            rgba(255,255,255,0.025);
          color: #d7d4cc;
          font-size: 10px;
          font-weight: 850;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .obs-button:hover {
          border-color:
            rgba(230,174,61,0.45);
          color: #e6ae3d;
        }

        .obs-button.primary {
          border-color: #e6ae3d;
          background: #e6ae3d;
          color: #151008;
        }

        .obs-button.primary:hover {
          background: #f4c55e;
          color: #151008;
        }

        .obs-button.danger {
          border-color:
            rgba(255,71,71,0.32);
          color: #ff6c6c;
        }

        .obs-button.danger:hover {
          background:
            rgba(255,71,71,0.08);
          border-color:
            rgba(255,71,71,0.6);
        }

        .obs-button:disabled {
          opacity: 0.5;
          cursor: wait;
        }

        .obs-button:focus-visible,
        .field-input:focus-visible,
        .scene-button:focus-visible,
        .back-link:focus-visible {
          outline: 1px solid #e6ae3d;
          outline-offset: 2px;
        }

        .status-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-top: 18px;
          padding:
            13px
            16px;
          border:
            1px solid
            rgba(255,255,255,0.08);
          border-radius: 4px;
          background:
            rgba(12,15,17,0.82);
        }

        .status-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #777d82;
        }

        .status-indicator.connected {
          background: #45d88d;
          box-shadow:
            0 0 12px
            rgba(69,216,141,0.7);
        }

        .status-indicator.streaming {
          background: #ff4545;
          box-shadow:
            0 0 12px
            rgba(255,69,69,0.7);
        }

        .mwops-sync-pulse {
          animation:
            mwops-sync-pulse
            1s ease-in-out infinite;
        }

        @keyframes mwops-sync-pulse {
          0%,
          100% {
            opacity: 0.55;
          }

          50% {
            opacity: 1;
          }
        }

        .status-main {
          color: #f0ede6;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.7px;
        }

        .status-sub {
          margin-top: 3px;
          color: #696f74;
          font-size: 9px;
        }

        .status-right {
          display: flex;
          align-items: center;
          gap: 16px;
          color: #6d7378;
          font-size: 9px;
          font-weight: 750;
        }

        .status-right strong {
          color: #a9adb1;
        }

        .notice {
          margin-top: 18px;
          padding:
            11px
            14px;
          border-radius: 3px;
          font-size: 10px;
          line-height: 1.5;
        }

        .notice.error {
          border:
            1px solid
            rgba(255,71,71,0.28);
          background:
            rgba(255,71,71,0.055);
          color: #ff7777;
        }

        .notice.success {
          border:
            1px solid
            rgba(69,216,141,0.24);
          background:
            rgba(69,216,141,0.045);
          color: #55d998;
        }

        .obs-grid {
          display: grid;
          grid-template-columns:
            minmax(0,1.25fr)
            minmax(360px,0.75fr);
          gap: 18px;
          margin-top: 18px;
        }

        .panel {
          border:
            1px solid
            rgba(255,255,255,0.09);
          border-radius: 5px;
          background:
            linear-gradient(
              145deg,
              rgba(17,20,23,0.96),
              rgba(9,11,13,0.96)
            );
          overflow: hidden;
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding:
            18px
            20px;
          border-bottom:
            1px solid
            rgba(255,255,255,0.07);
        }

        .panel-title {
          margin: 0;
          color: #eeeae1;
          font-size: 13px;
          font-weight: 950;
          letter-spacing: 0.4px;
          text-transform: uppercase;
        }

        .panel-subtitle {
          margin-top: 4px;
          color: #646b70;
          font-size: 9px;
        }

        .panel-body {
          padding: 20px;
        }

        .connection-grid {
          display: grid;
          grid-template-columns:
            repeat(2,minmax(0,1fr));
          gap: 13px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .field.full {
          grid-column: 1 / -1;
        }

        .field-label {
          color: #73797e;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .field-input {
          width: 100%;
          height: 40px;
          padding:
            0
            12px;
          border:
            1px solid
            rgba(255,255,255,0.10);
          border-radius: 3px;
          outline: none;
          background:
            rgba(255,255,255,0.025);
          color: #ebe8e0;
          font-size: 11px;
          transition: 0.2s ease;
        }

        .field-input:focus {
          border-color:
            rgba(230,174,61,0.55);
          box-shadow:
            0 0 0 2px
            rgba(230,174,61,0.06);
        }

        .connection-actions {
          display: flex;
          gap: 9px;
          margin-top: 17px;
        }

        .metric-grid {
          display: grid;
          grid-template-columns:
            repeat(3,minmax(0,1fr));
          gap: 10px;
          margin-top: 20px;
        }

        .metric {
          padding: 15px;
          border:
            1px solid
            rgba(255,255,255,0.07);
          border-radius: 4px;
          background:
            rgba(255,255,255,0.018);
        }

        .metric-label {
          color: #62686d;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.9px;
          text-transform: uppercase;
        }

        .metric-value {
          margin-top: 7px;
          color: #f0ede6;
          font-size: 20px;
          font-weight: 950;
        }

        .metric-value.gold {
          color: #e6ae3d;
        }

        .scene-list {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .scene {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          min-height: 49px;
          padding:
            0
            12px;
          border:
            1px solid
            rgba(255,255,255,0.07);
          border-radius: 3px;
          background:
            rgba(255,255,255,0.018);
          transition: 0.2s ease;
        }

        .scene:hover {
          border-color:
            rgba(230,174,61,0.32);
          background:
            rgba(230,174,61,0.035);
        }

        .scene.active {
          border-color:
            rgba(230,174,61,0.55);
          background:
            rgba(230,174,61,0.055);
        }

        .scene-info {
          min-width: 0;
        }

        .scene-name {
          overflow: hidden;
          color: #e7e4dc;
          font-size: 10px;
          font-weight: 850;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .scene-active {
          margin-top: 3px;
          color: #e6ae3d;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.9px;
          text-transform: uppercase;
        }

        .scene-button {
          flex-shrink: 0;
          padding:
            7px
            10px;
          border:
            1px solid
            rgba(255,255,255,0.10);
          border-radius: 3px;
          background:
            rgba(255,255,255,0.025);
          color: #9ca1a5;
          font-size: 8px;
          font-weight: 850;
          cursor: pointer;
        }

        .scene-button:hover {
          border-color:
            rgba(230,174,61,0.45);
          color: #e6ae3d;
        }

        .scene-button.active {
          border-color:
            rgba(230,174,61,0.5);
          background:
            rgba(230,174,61,0.10);
          color: #e6ae3d;
        }

        .scene-button:disabled {
          opacity: 0.45;
          cursor: wait;
        }

        .empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 170px;
          color: #62686d;
          font-size: 10px;
          text-align: center;
        }

        .stream-panel {
          margin-top: 18px;
        }

        .stream-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 20px;
        }

        .stream-status {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .stream-status-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border:
            1px solid
            rgba(255,255,255,0.09);
          border-radius: 4px;
          background:
            rgba(255,255,255,0.025);
          color: #777d82;
          font-size: 17px;
        }

        .stream-status-icon.live {
          border-color:
            rgba(255,71,71,0.32);
          background:
            rgba(255,71,71,0.06);
          color: #ff4e4e;
        }

        .stream-title {
          color: #eeeae2;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .stream-description {
          margin-top: 4px;
          color: #666c71;
          font-size: 9px;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-top: 24px;
          border: 0;
          background: transparent;
          color: #72787d;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .back-link:hover {
          color: #e6ae3d;
        }

        @media (max-width: 1200px) {
          .obs-grid {
            grid-template-columns:
              minmax(0,1fr)
              minmax(320px,0.72fr);
          }

          .status-right {
            gap: 10px;
          }
        }

        @media (max-width: 1000px) {
          .obs-grid {
            grid-template-columns: 1fr;
          }

          .status-right {
            flex-wrap: wrap;
            justify-content: flex-end;
          }
        }

        @media (max-width: 700px) {
          .mwops-obs {
            padding:
              20px
              16px
              35px;
          }

          .obs-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .obs-header-actions {
            justify-content: flex-start;
          }

          .status-bar {
            align-items: flex-start;
            flex-direction: column;
          }

          .connection-grid {
            grid-template-columns: 1fr;
          }

          .field.full {
            grid-column: auto;
          }

          .stream-card {
            align-items: flex-start;
            flex-direction: column;
          }
        }

        @media (max-width: 450px) {
          .metric-grid {
            grid-template-columns: 1fr;
          }

          .connection-actions {
            flex-direction: column;
          }

          .connection-actions .obs-button {
            width: 100%;
          }
        }

      `}</style>

      <div className="mwops-obs">

        <div className="obs-container">

          {/* ==============================================================
              HEADER
          ============================================================== */}

          <header className="obs-header">

            <div>

              <div className="obs-eyebrow">
                Broadcast Infrastructure
              </div>

              <h1 className="obs-title">
                OBS <span>Settings</span>
              </h1>

              <p className="obs-description">
                Configure the OBS WebSocket connection used by MWOPS and manage the essential broadcast controls from one production-ready settings page.
              </p>

            </div>

            <div className="obs-header-actions">

              <button
                className="obs-button"
                type="button"
                onClick={refresh}
                disabled={
                  loading ||
                  actionLoading !== ""
                }
              >
                {loading
                  ? "Refreshing..."
                  : "↻ Refresh"}
              </button>

              <button
                className="obs-button"
                type="button"
                onClick={() =>
                  navigate("/control-room")
                }
              >
                Control Room →
              </button>

            </div>

          </header>

          {/* ==============================================================
              STATUS BAR
          ============================================================== */}

          <div className="status-bar">

            <div className="status-left">

              <span
                className={
                  `status-indicator ${
                    obs.streaming
                      ? "streaming"
                      : obs.connected
                      ? "connected"
                      : ""
                  } ${
                    syncing
                      ? "mwops-sync-pulse"
                      : ""
                  }`
                }
              />

              <div>

                <div className="status-main">
                  OBS {connectionLabel}
                </div>

                <div className="status-sub">
                  {obs.streaming
                    ? "Broadcast is currently active"
                    : obs.connected
                    ? "WebSocket connection established"
                    : "Connect OBS Studio to MWOPS"}
                </div>

              </div>

            </div>

            <div className="status-right">

              <span>
                SYNC
                {" "}
                <strong
                  style={{
                    color:
                      syncing
                        ? "#e6ae3d"
                        : "#45d88d",
                  }}
                >
                  {syncing
                    ? "UPDATING"
                    : "LIVE"}
                </strong>
              </span>

              <span>
                API
                {" "}
                <strong>
                  {API_BASE_URL}
                </strong>
              </span>

              <span>
                Scene
                {" "}
                <strong>
                  {obs.currentScene ||
                    "—"}
                </strong>
              </span>

              {lastSyncedAt && (
                <span>
                  Updated
                  {" "}
                  <strong>
                    {new Date(
                      lastSyncedAt
                    ).toLocaleTimeString()}
                  </strong>
                </span>
              )}

            </div>

          </div>

          {/* ==============================================================
              NOTIFICATIONS
          ============================================================== */}

          {error && (
            <div className="notice error">
              {error}
            </div>
          )}

          {message && !error && (
            <div className="notice success">
              {message}
            </div>
          )}

          {/* ==============================================================
              MAIN GRID
          ============================================================== */}

          <div className="obs-grid">

            {/* ==========================================================
                CONNECTION
            ========================================================== */}

            <section className="panel">

              <div className="panel-header">

                <div>

                  <h2 className="panel-title">
                    OBS WebSocket Settings
                  </h2>

                  <div className="panel-subtitle">
                    Configure the local OBS WebSocket connection used by MWOPS.
                  </div>

                </div>

                <div
                  className={
                    `badge ${
                      obs.connected
                        ? "connected"
                        : "disconnected"
                    }`
                  }
                  style={{
                    padding:
                      "6px 9px",
                    borderRadius:
                      "3px",
                    fontSize:
                      "8px",
                    fontWeight:
                      900,
                    background:
                      obs.connected
                        ? "rgba(69,216,141,0.10)"
                        : "rgba(255,255,255,0.05)",
                    color:
                      obs.connected
                        ? "#45d88d"
                        : "#777d82",
                  }}
                >
                  {connectionLabel}
                </div>

              </div>

              <div className="panel-body">

                <div className="connection-grid">

                  <div className="field">

                    <label
                      className="field-label"
                      htmlFor="obs-host"
                    >
                      Host
                    </label>

                    <input
                      id="obs-host"
                      className="field-input"
                      value={host}
                      onChange={(event) =>
                        setHost(
                          event.target.value
                        )
                      }
                      placeholder="127.0.0.1"
                      disabled={
                        obs.connected ||
                        actionLoading !== ""
                      }
                    />

                  </div>

                  <div className="field">

                    <label
                      className="field-label"
                      htmlFor="obs-port"
                    >
                      WebSocket Port
                    </label>

                    <input
                      id="obs-port"
                      className="field-input"
                      value={port}
                      onChange={(event) =>
                        setPort(
                          event.target.value
                        )
                      }
                      placeholder="4455"
                      inputMode="numeric"
                      disabled={
                        obs.connected ||
                        actionLoading !== ""
                      }
                    />

                  </div>

                  <div className="field full">

                    <label
                      className="field-label"
                      htmlFor="obs-password"
                    >
                      WebSocket Password
                    </label>

                    <input
                      id="obs-password"
                      className="field-input"
                      type="password"
                      value={password}
                      onChange={(event) =>
                        setPassword(
                          event.target.value
                        )
                      }
                      placeholder="Enter OBS WebSocket password"
                      disabled={
                        obs.connected ||
                        actionLoading !== ""
                      }
                    />

                  </div>

                </div>

                <div
                  style={{
                    marginTop: "10px",
                    color: "#555c61",
                    fontSize: "9px",
                    lineHeight: 1.55,
                  }}
                >
                  OBS Studio → Tools → WebSocket Server Settings.
                  The default WebSocket port is 4455.
                </div>

                <div className="connection-actions">

                  {!obs.connected ? (

                    <button
                      className="obs-button primary"
                      type="button"
                      onClick={connectOBS}
                      disabled={
                        actionLoading !== ""
                      }
                    >
                      {actionLoading ===
                      "connect"
                        ? "Connecting..."
                        : "Connect OBS"}
                    </button>

                  ) : (

                    <button
                      className="obs-button danger"
                      type="button"
                      onClick={
                        disconnectOBS
                      }
                      disabled={
                        actionLoading !== ""
                      }
                    >
                      {actionLoading ===
                      "disconnect"
                        ? "Disconnecting..."
                        : "Disconnect OBS"}
                    </button>

                  )}

                </div>

                <div className="metric-grid">

                  <div className="metric">

                    <div className="metric-label">
                      Connection
                    </div>

                    <div
                      className={
                        `metric-value ${
                          obs.connected
                            ? "gold"
                            : ""
                        }`
                      }
                    >
                      {obs.connected
                        ? "ON"
                        : "OFF"}
                    </div>

                  </div>

                  <div className="metric">

                    <div className="metric-label">
                      Stream
                    </div>

                    <div
                      className={
                        `metric-value ${
                          obs.streaming
                            ? "gold"
                            : ""
                        }`
                      }
                    >
                      {obs.streaming
                        ? "LIVE"
                        : "OFF"}
                    </div>

                  </div>

                  <div className="metric">

                    <div className="metric-label">
                      Scenes
                    </div>

                    <div className="metric-value">
                      {
                        sceneList.length
                      }
                    </div>

                  </div>

                </div>

              </div>

            </section>

            {/* ==========================================================
                SCENES
            ========================================================== */}

            <section className="panel">

              <div className="panel-header">

                <div>

                  <h2 className="panel-title">
                    Scenes
                  </h2>

                  <div className="panel-subtitle">
                    Switch the active OBS scene.
                  </div>

                </div>

                <button
                  className="obs-button"
                  type="button"
                  onClick={
                    loadScenes
                  }
                  disabled={
                    !obs.connected ||
                    actionLoading !== ""
                  }
                >
                  ↻
                </button>

              </div>

              <div className="panel-body">

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    marginBottom: "12px",
                    paddingBottom: "10px",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <span
                    style={{
                      color: "#555c61",
                      fontSize: "8px",
                      fontWeight: 800,
                      letterSpacing: "0.8px",
                      textTransform: "uppercase",
                    }}
                  >
                    Live Scene Routing
                  </span>

                  <span
                    style={{
                      color: obs.connected ? "#45d88d" : "#62686d",
                      fontSize: "8px",
                      fontWeight: 900,
                    }}
                  >
                    {obs.connected ? "READY" : "WAITING"}
                  </span>
                </div>

                {!obs.connected ? (

                  <div className="empty-state">
                    Connect OBS to load available
                    scenes.
                  </div>

                ) : sceneList.length === 0 ? (

                  <div className="empty-state">
                    No OBS scenes were returned.
                  </div>

                ) : (

                  <div className="scene-list">

                    {sceneList.map(
                      (scene) => {

                        const active =
                          scene.name ===
                          obs.currentScene;

                        const switching =
                          actionLoading ===
                          `scene:${scene.name}`;

                        return (

                          <div
                            className={
                              `scene ${
                                active
                                  ? "active"
                                  : ""
                              }`
                            }
                            key={
                              scene.id
                            }
                          >

                            <div className="scene-info">

                              <div className="scene-name">
                                {
                                  scene.name
                                }
                              </div>

                              {active && (
                                <div className="scene-active">
                                  Active Scene
                                </div>
                              )}

                            </div>

                            <button
                              className={
                                `scene-button ${
                                  active
                                    ? "active"
                                    : ""
                                }`
                              }
                              type="button"
                              disabled={
                                active ||
                                switching ||
                                actionLoading !== ""
                              }
                              onClick={() =>
                                switchScene(
                                  scene.name
                                )
                              }
                            >
                              {switching
                                ? "Switching..."
                                : active
                                ? "Active"
                                : "Switch"}
                            </button>

                          </div>

                        );
                      }
                    )}

                  </div>

                )}

              </div>

            </section>

          </div>

          {/* ==============================================================
              STREAM CONTROL
          ============================================================== */}

          <section className="panel stream-panel">

            <div className="panel-header">

              <div>

                <h2 className="panel-title">
                  Broadcast
                </h2>

                <div className="panel-subtitle">
                  Start the OBS broadcast when production is ready.
                </div>

              </div>

              {obs.streaming && (
                <div
                  style={{
                    color:
                      "#ff4e4e",
                    fontSize:
                      "9px",
                    fontWeight:
                      950,
                    letterSpacing:
                      "1px",
                  }}
                >
                  ● LIVE
                </div>
              )}

            </div>

            <div className="stream-card">

              <div className="stream-status">

                <div
                  className={
                    `stream-status-icon ${
                      obs.streaming
                        ? "live"
                        : ""
                    }`
                  }
                >
                  {obs.streaming
                    ? "●"
                    : "▶"}
                </div>

                <div>

                  <div className="stream-title">
                    {obs.streaming
                      ? "Broadcast Live"
                      : "Broadcast Standby"}
                  </div>

                  <div className="stream-description">
                    {obs.streaming
                      ? "OBS is currently streaming."
                      : "Start the OBS stream when your production is ready."}
                  </div>

                </div>

              </div>

              <button
                className={
                  `obs-button ${
                    obs.streaming
                      ? "danger"
                      : "primary"
                  }`
                }
                type="button"
                disabled={
                  !obs.connected ||
                  obs.streaming ||
                  actionLoading !== ""
                }
                onClick={
                  startStream
                }
              >
                {actionLoading ===
                "stream"
                  ? "Starting..."
                  : obs.streaming
                  ? "Stream Live"
                  : "Start Stream"}
              </button>

            </div>

          </section>

          {/* ==============================================================
              FOOTER NAVIGATION
          ============================================================== */}

          <button
            className="back-link"
            type="button"
            onClick={() =>
              navigate("/dashboard")
            }
          >
            ← Back to Dashboard
          </button>

        </div>

      </div>
    </>
  );
}

export default OBS;