"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

const HOST = "127.0.0.1";
const PORT = Number(process.env.DASHBOARD_PORT || 4173);

const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(__dirname, "public");

const JENKINS_URL = trimSlash(
  process.env.JENKINS_URL || "http://localhost:8081"
);

const JENKINS_JOB =
  process.env.JENKINS_JOB || "DepDevFlow-CI";

const SONAR_URL = trimSlash(
  process.env.SONAR_HOST_URL || "http://localhost:9000"
);

const SONAR_PROJECT_KEY =
  process.env.SONAR_PROJECT_KEY || "DepDevFlow";

const PROMETHEUS_URL = trimSlash(
  process.env.PROMETHEUS_URL || "http://localhost:9090"
);

const APP_HEALTH_URL =
  process.env.APP_HEALTH_URL || "http://localhost:8080/health";

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });

  res.end(JSON.stringify(data, null, 2));
}

function sendText(res, status, text) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });

  res.end(text);
}

async function fetchJson(url, headers = {}, timeoutMs = 6000) {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function jenkinsHeaders() {
  const headers = {
    Accept: "application/json"
  };

  const user = process.env.JENKINS_USER;
  const token = process.env.JENKINS_TOKEN;

  if (user && token) {
    headers.Authorization =
      "Basic " +
      Buffer.from(`${user}:${token}`).toString("base64");
  }

  return headers;
}

function sonarHeaders() {
  const headers = {
    Accept: "application/json"
  };

  if (process.env.SONAR_TOKEN) {
    headers.Authorization =
      `Bearer ${process.env.SONAR_TOKEN}`;
  }

  return headers;
}

function encodeJobPath(jobName) {
  return jobName
    .split("/")
    .map(part => `job/${encodeURIComponent(part)}`)
    .join("/");
}

async function getJenkins() {
  const jobPath = encodeJobPath(JENKINS_JOB);

  const result = {
    status: "unavailable",
    detail: "",
    url: `${JENKINS_URL}/${jobPath}/`,
    build: null,
    stages: [],
    recentBuilds: []
  };

  try {
    if (
      !process.env.JENKINS_USER ||
      !process.env.JENKINS_TOKEN
    ) {
      result.detail =
        "Jenkins credentials are missing. Configure " +
        "JENKINS_USER and JENKINS_TOKEN in the dashboard process.";
      return result;
    }

    const headers = jenkinsHeaders();

    const jobData = await fetchJson(
      `${JENKINS_URL}/${jobPath}/api/json?tree=name,color,lastBuild[number,result,timestamp,duration,building,url,displayName]`,
      headers
    );

    const latest = jobData.lastBuild;

    if (!latest) {
      result.status = "connected";
      result.detail =
        "Jenkins is connected, but this job has no recorded build.";
      return result;
    }

    result.build = {
      number: latest.number,
      result: latest.building
        ? "BUILDING"
        : latest.result || "UNKNOWN",
      building: Boolean(latest.building),
      timestamp: latest.timestamp || null,
      durationMs: latest.duration || 0,
      url: latest.url || result.url,
      displayName: latest.displayName || `#${latest.number}`
    };

    result.jobColor = jobData.color || "notbuilt";
    result.status = "connected";
    result.detail = "Latest Jenkins build retrieved.";

    try {
      const buildUrl = trimSlash(
        latest.url || `${JENKINS_URL}/${jobPath}/lastBuild/`
      );

      const workflow = await fetchJson(
        `${buildUrl}/wfapi/describe`,
        headers
      );

      result.stages = (workflow.stages || []).map(stage => ({
        name: stage.name || "Unnamed stage",
        status: stage.status || "UNKNOWN",
        durationMs: stage.durationMillis || 0
      }));
    } catch (error) {
      result.stageDetail =
        `Build available; stage details unavailable (${error.message}).`;
    }

    try {
      const history = await fetchJson(
        `${JENKINS_URL}/${jobPath}/api/json?tree=builds[number,result,timestamp,duration,building,url,displayName]{0,10}`,
        headers
      );

      result.recentBuilds = (history.builds || []).map(build => ({
        number: build.number,
        result: build.building
          ? "BUILDING"
          : build.result || "UNKNOWN",
        timestamp: build.timestamp || null,
        durationMs: build.duration || 0,
        url: build.url || null,
        displayName: build.displayName || `#${build.number}`
      }));
    } catch {
      // Latest build data remains useful if history is unavailable.
    }
  } catch (error) {
    result.detail =
      `Jenkins API error: ${error.message}. Check the URL, ` +
      "job name, username, API token, and Jenkins permissions.";
  }

  return result;
}

async function getSonar() {
  const result = {
    status: "unavailable",
    detail: "",
    url: `${SONAR_URL}/dashboard?id=${encodeURIComponent(SONAR_PROJECT_KEY)}`,
    projectKey: SONAR_PROJECT_KEY,
    qualityGate: "UNKNOWN",
    measures: {}
  };

  if (!process.env.SONAR_TOKEN) {
    result.detail =
      "SONAR_TOKEN is missing from the dashboard process environment.";
    return result;
  }

  try {
    const headers = sonarHeaders();

    const measureParams = new URLSearchParams({
      component: SONAR_PROJECT_KEY,
      metricKeys: [
        "bugs",
        "vulnerabilities",
        "security_hotspots",
        "code_smells",
        "coverage",
        "duplicated_lines_density",
        "ncloc"
      ].join(",")
    });

    const [measures, gate] = await Promise.all([
      fetchJson(
        `${SONAR_URL}/api/measures/component?${measureParams}`,
        headers
      ),
      fetchJson(
        `${SONAR_URL}/api/qualitygates/project_status?projectKey=${encodeURIComponent(SONAR_PROJECT_KEY)}`,
        headers
      )
    ]);

    for (const item of measures.component?.measures || []) {
      result.measures[item.metric] =
        item.value ?? item.period?.value ?? null;
    }

    result.qualityGate =
      gate.projectStatus?.status || "UNKNOWN";

    result.status = "connected";
    result.detail = "Live SonarQube metrics retrieved.";
  } catch (error) {
    result.detail =
      `SonarQube API error: ${error.message}. Check SONAR_TOKEN, ` +
      "SONAR_PROJECT_KEY, and project permissions.";
  }

  return result;
}

async function prometheusQuery(query) {
  const params = new URLSearchParams({ query });

  const data = await fetchJson(
    `${PROMETHEUS_URL}/api/v1/query?${params}`,
    { Accept: "application/json" }
  );

  if (data.status !== "success") {
    throw new Error("Prometheus query failed.");
  }

  return data.data?.result || [];
}

async function getPrometheus() {
  const result = {
    status: "unavailable",
    detail: "",
    url: PROMETHEUS_URL,
    up: [],
    upTargets: 0,
    totalTargets: 0,
    podMetricCount: null
  };

  try {
    const [up, podInfo] = await Promise.all([
      prometheusQuery("up"),
      prometheusQuery("kube_pod_info").catch(() => null)
    ]);

    result.up = up;
    result.totalTargets = up.length;
    result.upTargets = up.filter(
      item => Number(item.value?.[1]) === 1
    ).length;

    result.podMetricCount =
      podInfo === null ? null : podInfo.length;

    result.status = "connected";
    result.detail = "Live Prometheus queries succeeded.";
  } catch (error) {
    result.detail =
      `Prometheus query error: ${error.message}.`;
  }

  return result;
}

async function getKubernetes() {
  const result = {
    status: "unavailable",
    detail: "",
    total: 0,
    running: 0,
    pending: 0,
    failed: 0,
    other: 0,
    readyContainers: 0,
    totalContainers: 0,
    pods: []
  };

  try {
    const { stdout } = await execFileAsync(
      "kubectl",
      ["get", "pods", "-A", "-o", "json"],
      {
        timeout: 10000,
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024
      }
    );

    const data = JSON.parse(stdout);

    result.pods = (data.items || []).map(pod => {
      const containers = pod.spec?.containers || [];
      const statuses = pod.status?.containerStatuses || [];
      const ready = statuses.filter(container => container.ready).length;

      return {
        namespace: pod.metadata?.namespace || "default",
        name: pod.metadata?.name || "unknown",
        phase: pod.status?.phase || "Unknown",
        ready,
        containers: containers.length,
        restarts: statuses.reduce(
          (sum, container) =>
            sum + (container.restartCount || 0),
          0
        )
      };
    });

    result.total = result.pods.length;
    result.running = result.pods.filter(
      pod => pod.phase === "Running"
    ).length;
    result.pending = result.pods.filter(
      pod => pod.phase === "Pending"
    ).length;
    result.failed = result.pods.filter(
      pod => pod.phase === "Failed"
    ).length;
    result.other =
      result.total -
      result.running -
      result.pending -
      result.failed;

    result.readyContainers = result.pods.reduce(
      (sum, pod) => sum + pod.ready,
      0
    );

    result.totalContainers = result.pods.reduce(
      (sum, pod) => sum + pod.containers,
      0
    );

    result.status = "connected";
    result.detail =
      "Live Kubernetes pod inventory retrieved.";
  } catch (error) {
    result.detail =
      `Kubernetes query failed: ${error.message}. ` +
      "Check kubectl and the active cluster context.";
  }

  return result;
}

async function getAppHealth() {
  const result = {
    status: "unavailable",
    detail: "",
    url: APP_HEALTH_URL,
    response: null
  };

  try {
    const response = await fetch(APP_HEALTH_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();

    try {
      result.response = JSON.parse(text);
    } catch {
      result.response = text;
    }

    result.status = "connected";
    result.detail = "Application health endpoint responded.";
  } catch (error) {
    result.detail =
      `Application health error: ${error.message}.`;
  }

  return result;
}

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function firstJsonFile(candidates) {
  for (const candidate of candidates) {
    const data = readJsonFile(candidate);

    if (data !== null) {
      return {
        path: candidate,
        data
      };
    }
  }

  return null;
}

function getRiskEvidence() {
  const candidates = [
    path.join(ROOT_DIR, "risk-decision.json"),
    path.join(ROOT_DIR, "reports", "risk-decision.json"),
    path.join(ROOT_DIR, "reports", "risk-result.json"),
    path.join(ROOT_DIR, "reports", "risk-assessment.json"),
    path.join(ROOT_DIR, "risk-result.json")
  ];

  const found = firstJsonFile(candidates);

  if (!found) {
    return {
      status: "pending",
      score: null,
      decision: "UNKNOWN",
      detail:
        "No risk-decision JSON was found. Publish the actual " +
        "risk-engine result before displaying a release decision.",
      source: null
    };
  }

  const data = found.data;

  const rawDecision =
    data.decision ??
    data.releaseDecision ??
    data.result?.decision ??
    data.riskDecision ??
    null;

  const rawScore =
    data.score ??
    data.riskScore ??
    data.result?.score ??
    null;

  const scoreNumber =
    rawScore === null ? null : Number(rawScore);

  const decision = String(
    rawDecision || "UNKNOWN"
  ).toUpperCase();

  const hasDecision =
    ["PROCEED", "BLOCK", "ALLOW", "PASS", "FAIL"].includes(decision);

  if (!hasDecision) {
    return {
      status: "pending",
      score: Number.isFinite(scoreNumber) ? scoreNumber : null,
      decision: "UNKNOWN",
      detail:
        "A JSON file exists, but it does not contain a recognized " +
        "risk decision. A risk-input file is not necessarily a result.",
      source: path.relative(ROOT_DIR, found.path)
    };
  }

  return {
    status: "connected",
    score: Number.isFinite(scoreNumber) ? scoreNumber : null,
    decision,
    detail:
      data.reason ||
      data.detail ||
      data.message ||
      "Risk-engine result loaded from a JSON file.",
    source: path.relative(ROOT_DIR, found.path),
    findings: data.findings || data.summary || null
  };
}

function severityCount(value) {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (typeof value === "number") {
    return value;
  }

  return 0;
}

function collectFindings() {
  const reportsDir = path.join(ROOT_DIR, "reports");

  const candidates = [
    path.join(reportsDir, "trivy-image.json"),
    path.join(reportsDir, "trivy-container.json"),
    path.join(reportsDir, "trivy-config.json"),
    path.join(reportsDir, "semgrep.json"),
    path.join(reportsDir, "gitleaks.json"),
    path.join(reportsDir, "npm-audit.json")
  ];

  const totals = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  };

  const reports = [];

  for (const filePath of candidates) {
    const data = readJsonFile(filePath);

    if (!data) {
      continue;
    }

    const name = path.basename(filePath);
    let parsed = false;

    // Trivy JSON report format.
    if (Array.isArray(data.Results)) {
      parsed = true;

      for (const item of data.Results) {
        for (const vulnerability of item.Vulnerabilities || []) {
          const severity = String(
            vulnerability.Severity || ""
          ).toLowerCase();

          if (Object.prototype.hasOwnProperty.call(totals, severity)) {
            totals[severity]++;
          }
        }

        for (const misconfiguration of item.Misconfigurations || []) {
          const severity = String(
            misconfiguration.Severity || ""
          ).toLowerCase();

          if (Object.prototype.hasOwnProperty.call(totals, severity)) {
            totals[severity]++;
          }
        }
      }
    }

    // Semgrep JSON report format.
    if (Array.isArray(data.results)) {
      parsed = true;

      for (const finding of data.results) {
        const level = String(
          finding.extra?.severity || ""
        ).toLowerCase();

        if (level === "error" || level === "critical") {
          totals.high++;
        } else if (level === "warning") {
          totals.medium++;
        } else if (level === "info") {
          totals.low++;
        }
      }
    }

    // Gitleaks JSON report format.
    if (
      name.toLowerCase().includes("gitleaks") &&
      Array.isArray(data)
    ) {
      parsed = true;
      totals.high += data.length;
    }

    // npm audit JSON report format.
    if (data.metadata?.vulnerabilities) {
      parsed = true;
      const vulnerabilities = data.metadata.vulnerabilities;

      totals.critical += severityCount(vulnerabilities.critical);
      totals.high += severityCount(vulnerabilities.high);
      totals.medium += severityCount(
        vulnerabilities.moderate ?? vulnerabilities.medium
      );
      totals.low += severityCount(vulnerabilities.low);
    }

    if (parsed) {
      reports.push(name);
    }
  }

  const total =
    totals.critical +
    totals.high +
    totals.medium +
    totals.low;

  return {
    status: reports.length ? "connected" : "pending",
    detail: reports.length
      ? "Findings parsed from available JSON reports."
      : "No supported scanner JSON reports were found in reports/.",
    totals,
    total,
    reports
  };
}

async function dashboardData() {
  const [
    jenkins,
    sonarqube,
    prometheus,
    kubernetes,
    app
  ] = await Promise.all([
    getJenkins(),
    getSonar(),
    getPrometheus(),
    getKubernetes(),
    getAppHealth()
  ]);

  return {
    project: "DepDevFlow",
    generatedAt: new Date().toISOString(),
    sources: {
      jenkins,
      sonarqube,
      prometheus,
      kubernetes,
      app
    },
    findings: collectFindings(),
    riskEngine: getRiskEvidence()
  };
}

function serveHtml(res) {
  const filePath = path.join(PUBLIC_DIR, "index.html");

  if (!fs.existsSync(filePath)) {
    return sendText(res, 500, "Dashboard index.html was not found.");
  }

  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });

  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(
    req.url,
    `http://${HOST}:${PORT}`
  );

  if (req.method !== "GET") {
    return sendText(res, 405, "Method not allowed");
  }

  if (requestUrl.pathname === "/api/health") {
    return sendJson(res, 200, {
      status: "ok",
      project: "DepDevFlow dashboard"
    });
  }

  if (requestUrl.pathname === "/api/dashboard") {
    try {
      const data = await dashboardData();
      return sendJson(res, 200, data);
    } catch (error) {
      console.error("Dashboard collection error:", error.message);

      return sendJson(res, 500, {
        error: "Dashboard data collection failed",
        detail: error.message
      });
    }
  }

  if (
    requestUrl.pathname === "/" ||
    requestUrl.pathname === "/index.html"
  ) {
    return serveHtml(res);
  }

  return sendText(res, 404, "Not found");
});

server.listen(PORT, HOST, () => {
  console.log(`DepDevFlow dashboard: http://${HOST}:${PORT}`);
  console.log(`Jenkins: ${JENKINS_URL}`);
  console.log(`Jenkins job: ${JENKINS_JOB}`);
  console.log(`SonarQube: ${SONAR_URL}`);
  console.log(`Sonar project key: ${SONAR_PROJECT_KEY}`);
  console.log(`Prometheus: ${PROMETHEUS_URL}`);
  console.log(`Application health: ${APP_HEALTH_URL}`);
  console.log(
    `Jenkins credentials configured: ${
      Boolean(process.env.JENKINS_USER && process.env.JENKINS_TOKEN)
    }`
  );
  console.log(
    `Sonar token configured: ${Boolean(process.env.SONAR_TOKEN)}`
  );
});

server.on("error", error => {
  console.error("Dashboard server error:", error.message);

  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the old dashboard process first.`
    );
  }

  process.exitCode = 1;
});