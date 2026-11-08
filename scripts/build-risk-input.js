const fs = require("node:fs");
const path = require("node:path");

const reportDir = path.resolve(process.argv[2] || "reports");
const outputPath = path.resolve(process.argv[3] || "risk-input.json");
const findings = [];
const scannerErrors = [];

function readJson(filename, required = true) {
  const fullPath = path.join(reportDir, filename);
  if (!fs.existsSync(fullPath)) {
    if (required) scannerErrors.push(`Missing report: ${filename}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    scannerErrors.push(`Invalid JSON in ${filename}: ${error.message}`);
    return null;
  }
}

function addFinding(severity, source, title) {
  const value = String(severity || "").toUpperCase();
  const normalized = ({
    ERROR: "HIGH",
    WARNING: "MEDIUM",
    INFO: "LOW",
    MODERATE: "MEDIUM"
  })[value] || value;

  if (["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(normalized)) {
    findings.push({ severity: normalized, source, title: String(title || "Unspecified finding") });
  }
}

const scannerErrorsPath = path.join(reportDir, "scanner-errors.txt");
if (fs.existsSync(scannerErrorsPath)) {
  scannerErrors.push(...fs.readFileSync(scannerErrorsPath, "utf8")
    .split(/\r?\n/).map(x => x.trim()).filter(Boolean));
}

const npm = readJson("npm-audit.json");
if (npm) {
  const vulnerabilities = npm.metadata?.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== "object") {
    scannerErrors.push("npm-audit.json has no vulnerability summary");
  } else {
    for (const [severity, rawCount] of Object.entries(vulnerabilities)) {
      const count = Number(rawCount);
      if (!Number.isFinite(count) || count < 0) {
        scannerErrors.push(`Invalid npm audit count for severity ${severity}`);
        continue;
      }
      const normalized = String(severity).toUpperCase();
      const mapped = normalized === "MODERATE" ? "MEDIUM" : normalized;
      if (["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(mapped)) {
        for (let i = 0; i < count; i++) addFinding(mapped, "npm-audit", `${severity} dependency vulnerability ${i + 1}`);
      }
    }
  }
}

const trivy = readJson("trivy-image.json");
if (trivy) {
  if (!Array.isArray(trivy.Results)) scannerErrors.push("trivy-image.json has no Results array");
  else for (const result of trivy.Results) {
    for (const vulnerability of result.Vulnerabilities || []) {
      addFinding(vulnerability.Severity, "trivy-image", vulnerability.Title || vulnerability.VulnerabilityID);
    }
  }
}

const semgrep = readJson("semgrep.json");
if (semgrep) {
  if (!Array.isArray(semgrep.results)) scannerErrors.push("semgrep.json has no results array");
  else for (const result of semgrep.results) {
    addFinding(result.extra?.severity, "semgrep", result.check_id || result.extra?.message || "Semgrep finding");
  }
}

const gitleaks = readJson("gitleaks.json");
let secretDetected = false;
if (gitleaks) {
  if (!Array.isArray(gitleaks)) scannerErrors.push("gitleaks.json must contain a JSON array");
  else secretDetected = gitleaks.length > 0;
}

let infrastructureScanRequired = false;
const planPath = path.resolve(".pipeline-plan.json");
if (!fs.existsSync(planPath)) scannerErrors.push("Missing .pipeline-plan.json");
else {
  try {
    const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
    infrastructureScanRequired = plan.stages?.infrastructureScan === true || plan.infrastructureScan === true;
  } catch (error) {
    scannerErrors.push(`Invalid .pipeline-plan.json: ${error.message}`);
  }
}

const configPath = path.join(reportDir, "trivy-config.json");
if (infrastructureScanRequired || fs.existsSync(configPath)) {
  const config = readJson("trivy-config.json", infrastructureScanRequired);
  if (config) {
    if (!Array.isArray(config.Results)) scannerErrors.push("trivy-config.json has no Results array");
    else for (const result of config.Results) {
      for (const misconfiguration of result.Misconfigurations || []) {
        addFinding(misconfiguration.Severity, "trivy-config", misconfiguration.Title || misconfiguration.ID);
      }
    }
  }
}

const input = {
  project: "DepDevFlow",
  generatedAt: new Date().toISOString(),
  testsPassed: process.env.TESTS_PASSED === "true",
  secretDetected,
  scannerFailed: scannerErrors.length > 0,
  scannerErrors,
  findings
};

fs.writeFileSync(outputPath, JSON.stringify(input, null, 2) + "\n");
console.log(JSON.stringify(input, null, 2));
// Scanner errors are represented in the input; the risk engine performs the fail-closed decision.