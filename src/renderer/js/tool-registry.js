(function () {
  function createToolRegistry({
    fetchWithTimeout,
    buildHttpError,
    weatherTimeoutMs,
  }) {
    async function getWeatherUpdate(args = {}) {
      const city = String(args.city || "").trim();
      const country = String(args.country || "").trim();
      const unit = args.unit === "fahrenheit" ? "fahrenheit" : "celsius";

      if (!city) {
        throw new Error("city is required");
      }

      const geoUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
      geoUrl.searchParams.set("name", city);
      geoUrl.searchParams.set("count", "1");
      geoUrl.searchParams.set("language", "en");
      geoUrl.searchParams.set("format", "json");
      if (country) {
        geoUrl.searchParams.set("country", country);
      }

      const geoResp = await fetchWithTimeout(
        geoUrl.toString(),
        {},
        weatherTimeoutMs,
      );
      if (!geoResp.ok) {
        throw await buildHttpError(geoResp, "Weather geocoding failed");
      }

      const geoData = await geoResp.json();
      const location = geoData?.results?.[0];
      if (!location) {
        throw new Error(`No location found for '${city}'`);
      }

      const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
      forecastUrl.searchParams.set("latitude", String(location.latitude));
      forecastUrl.searchParams.set("longitude", String(location.longitude));
      forecastUrl.searchParams.set(
        "current",
        "temperature_2m,weather_code,wind_speed_10m",
      );
      forecastUrl.searchParams.set(
        "temperature_unit",
        unit === "fahrenheit" ? "fahrenheit" : "celsius",
      );
      forecastUrl.searchParams.set("wind_speed_unit", "kmh");

      const forecastResp = await fetchWithTimeout(
        forecastUrl.toString(),
        {},
        weatherTimeoutMs,
      );
      if (!forecastResp.ok) {
        throw await buildHttpError(
          forecastResp,
          "Weather forecast request failed",
        );
      }

      const forecast = await forecastResp.json();
      return {
        location: {
          city: location.name,
          country: location.country,
          admin1: location.admin1 || null,
          latitude: location.latitude,
          longitude: location.longitude,
        },
        current: {
          time: forecast?.current?.time || null,
          temperature: forecast?.current?.temperature_2m ?? null,
          unit:
            forecast?.current_units?.temperature_2m ||
            (unit === "fahrenheit" ? "°F" : "°C"),
          weatherCode: forecast?.current?.weather_code ?? null,
          windSpeed: forecast?.current?.wind_speed_10m ?? null,
          windSpeedUnit: forecast?.current_units?.wind_speed_10m || "km/h",
        },
        source: "open-meteo.com",
      };
    }

    function getToolDefinitions() {
      return [
        {
          type: "function",
          function: {
            name: "get_weather_update",
            description:
              "Get current weather for a city using Open-Meteo geocoding and forecast data.",
            parameters: {
              type: "object",
              properties: {
                city: {
                  type: "string",
                  description: "City name, for example Lahore or London.",
                },
                country: {
                  type: "string",
                  description:
                    "Optional country name or ISO code to disambiguate city results.",
                },
                unit: {
                  type: "string",
                  enum: ["celsius", "fahrenheit"],
                  description: "Temperature unit. Defaults to celsius.",
                },
              },
              required: ["city"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "read_workspace_file",
            description:
              "Read a text file from the local workspace using a relative path.",
            parameters: {
              type: "object",
              properties: {
                relativePath: {
                  type: "string",
                  description:
                    "Relative path in the current workspace, for example README.md or src/renderer/js/chat.js.",
                },
                startLine: {
                  type: "integer",
                  description: "1-based starting line. Defaults to 1.",
                },
                endLine: {
                  type: "integer",
                  description:
                    "1-based ending line. Defaults to a safe bounded range.",
                },
                maxChars: {
                  type: "integer",
                  description: "Maximum number of characters returned.",
                },
              },
              required: ["relativePath"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "read_file_path",
            description:
              "Read a text file from any absolute path or relative path.",
            parameters: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description:
                    "Absolute path (for example /home/user/file.txt) or relative path.",
                },
                startLine: {
                  type: "integer",
                  description: "1-based starting line. Defaults to 1.",
                },
                endLine: {
                  type: "integer",
                  description:
                    "1-based ending line. Defaults to a safe bounded range.",
                },
                maxChars: {
                  type: "integer",
                  description: "Maximum number of characters returned.",
                },
              },
              required: ["path"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "list_workspace_files",
            description:
              "List files and folders in a workspace directory using a relative path.",
            parameters: {
              type: "object",
              properties: {
                relativePath: {
                  type: "string",
                  description:
                    "Relative directory path in the workspace. Defaults to current workspace root.",
                },
                maxEntries: {
                  type: "integer",
                  description: "Maximum number of entries to return.",
                },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "list_path",
            description:
              "List files and folders in any absolute path or relative path.",
            parameters: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description:
                    "Absolute path (for example /home/user) or relative path.",
                },
                maxEntries: {
                  type: "integer",
                  description: "Maximum number of entries to return.",
                },
              },
              required: ["path"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "write_file_path",
            description:
              "Write text content to a file at any absolute path or relative path.",
            parameters: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description:
                    "Absolute path (for example /home/user/note.txt) or relative path.",
                },
                content: {
                  type: "string",
                  description: "Text content to write.",
                },
                append: {
                  type: "boolean",
                  description: "If true, append content instead of overwrite.",
                },
                createDirs: {
                  type: "boolean",
                  description:
                    "If true, create parent directories automatically.",
                },
              },
              required: ["path", "content"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "get_current_datetime",
            description: "Get the current local date/time information.",
            parameters: {
              type: "object",
              properties: {
                locale: {
                  type: "string",
                  description:
                    "Optional BCP-47 locale, for example en-US or en-GB.",
                },
              },
            },
          },
        },
      ];
    }

    function shouldUseToolCalling(userMessage) {
      const text = String(userMessage || "").toLowerCase();
      if (!text) return false;

      // Trigger tool mode whenever user provides an absolute Unix path.
      if (/(^|\s)\/[\w./-]+/.test(text)) {
        return true;
      }

      return [
        /\bweather\b/,
        /\btemperature\b/,
        /\bforecast\b/,
        /\btime\b/,
        /\bdate\b/,
        /\bcurrent\s+time\b/,
        /\bpath\b/,
        /\babsolute\s+path\b/,
        /\bread\b.*\bfile\b/,
        /\bread\b.*\bpath\b/,
        /\bfind\b.*\bfiles?\b/,
        /\bopen\b.*\bfile\b/,
        /\blist\b.*\bfiles?\b/,
        /\bimportant\b.*\bfiles?\b/,
        /\bkey\b.*\bfiles?\b/,
        /\blist\b.*\bpath\b/,
        /\bwrite\b.*\bfile\b/,
        /\bsave\b.*\bfile\b/,
        /\bappend\b.*\bfile\b/,
        /\b(folder|directory)\b/,
        /\bcodebase\b/,
        /\brepository\b/,
        /\bproject\b.*\bstructure\b/,
        /\banaly[sz]e\b.*\b(codebase|project|repo|folder)\b/,
        /\bworkspace\b.*\bfiles?\b/,
        /\bshow\b.*\bfiles?\b/,
      ].some((pattern) => pattern.test(text));
    }

    async function runToolByName(name, args = {}) {
      switch (name) {
        case "get_weather_update":
          return await getWeatherUpdate(args);
        case "read_workspace_file":
          if (!window.electronAPI?.tools?.readWorkspaceFile) {
            throw new Error(
              "Workspace read tool is unavailable in this environment",
            );
          }
          return await window.electronAPI.tools.readWorkspaceFile(args || {});
        case "read_file_path":
          if (!window.electronAPI?.tools?.readPath) {
            throw new Error(
              "Path read tool is unavailable in this environment",
            );
          }
          return await window.electronAPI.tools.readPath({
            path: args?.path,
            startLine: args?.startLine,
            endLine: args?.endLine,
            maxChars: args?.maxChars,
          });
        case "list_workspace_files":
          if (!window.electronAPI?.tools?.listWorkspaceFiles) {
            throw new Error(
              "Workspace list tool is unavailable in this environment",
            );
          }
          return await window.electronAPI.tools.listWorkspaceFiles(args || {});
        case "list_path":
          if (!window.electronAPI?.tools?.listPath) {
            throw new Error(
              "Path list tool is unavailable in this environment",
            );
          }
          return await window.electronAPI.tools.listPath({
            path: args?.path,
            maxEntries: args?.maxEntries,
          });
        case "write_file_path":
          if (!window.electronAPI?.tools?.writePath) {
            throw new Error(
              "Path write tool is unavailable in this environment",
            );
          }
          return await window.electronAPI.tools.writePath({
            path: args?.path,
            content: args?.content,
            append: args?.append,
            createDirs: args?.createDirs,
          });
        case "get_current_datetime": {
          const locale = args?.locale || undefined;
          const now = new Date();
          return {
            iso: now.toISOString(),
            local: now.toLocaleString(locale),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          };
        }
        default:
          throw new Error(`Unknown tool '${name}'`);
      }
    }

    return {
      getToolDefinitions,
      shouldUseToolCalling,
      runToolByName,
    };
  }

  window.ToolRegistry = {
    createToolRegistry,
  };
})();
