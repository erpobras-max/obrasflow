type BrowserAgentInstance = {
  noticeError: (error: Error, attributes?: Record<string, string>) => void;
};

let agent: BrowserAgentInstance | null = null;
let initializing = false;

function getConfiguration() {
  const licenseKey = import.meta.env.VITE_NEW_RELIC_BROWSER_LICENSE_KEY;
  const applicationID = Number(import.meta.env.VITE_NEW_RELIC_APPLICATION_ID);
  const accountID = Number(import.meta.env.VITE_NEW_RELIC_ACCOUNT_ID);

  if (!licenseKey || !Number.isFinite(applicationID) || !Number.isFinite(accountID)) {
    return null;
  }

  return { licenseKey, applicationID, accountID };
}

/** Starts browser monitoring only when its public build variables are available. */
export async function initializeBrowserMonitoring() {
  if (agent || initializing || typeof window === "undefined") return;

  const configuration = getConfiguration();
  if (!configuration) return;

  initializing = true;

  try {
    const { BrowserAgent } = await import(
      "@newrelic/browser-agent/loaders/browser-agent"
    );

    agent = new BrowserAgent({
      info: {
        applicationID: configuration.applicationID,
        beacon: "bam.nr-data.net",
        errorBeacon: "bam.nr-data.net",
        licenseKey: configuration.licenseKey,
        sa: 1,
      },
      init: {
        ajax: { deny_list: ["bam.nr-data.net"] },
        distributed_tracing: { enabled: true },
        performance: {
          capture_detail: false,
          capture_marks: false,
          capture_measures: true,
        },
        privacy: { cookies_enabled: true },
      },
      loader_config: {
        accountID: configuration.accountID,
        agentID: configuration.applicationID,
        applicationID: configuration.applicationID,
        licenseKey: configuration.licenseKey,
        trustKey: configuration.accountID,
      },
    });
  } catch (error) {
    console.warn("Não foi possível iniciar o monitoramento do navegador.", error);
  } finally {
    initializing = false;
  }
}

export function reportBrowserError(error: unknown, source = "application") {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  agent?.noticeError(normalizedError, { source });
}

