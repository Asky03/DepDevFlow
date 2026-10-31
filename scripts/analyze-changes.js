const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

function getChangedFiles() {
  try {
    return execFileSync(
      "git",
      ["diff", "--name-only", "HEAD~1", "HEAD"],
      { encoding: "utf8" }
    )
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    return execFileSync("git", ["ls-files"], {
      encoding: "utf8"
    })
      .split(/\r?\n/)
      .filter(Boolean);
  }
}

function classifyFile(file) {
  const name = file.replaceAll("\\", "/").toLowerCase();

  if (
    name === "package.json" ||
    name === "package-lock.json" ||
    name === "npm-shrinkwrap.json"
  ) {
    return ["dependencies", "dependency-security"];
  }

  if (
    name === "dockerfile" ||
    name.startsWith("docker/") ||
    name.endsWith(".dockerfile")
  ) {
    return ["container", "container-security"];
  }

  if (
    name.startsWith("k8s/") ||
    name.startsWith("kubernetes/") ||
    name.startsWith("charts/") ||
    name.endsWith(".tf")
  ) {
    return ["infrastructure", "infrastructure-security"];
  }

  if (
    name === "jenkinsfile" ||
    name.startsWith(".github/workflows/") ||
    name.startsWith(".gitlab/") ||
    name.startsWith(".circleci/")
  ) {
    return ["pipeline", "pipeline-security"];
  }

  if (
    name === ".env" ||
    name.startsWith(".env.") ||
    name.endsWith(".pem") ||
    name.endsWith(".key") ||
    name.includes("secret")
  ) {
    return ["secrets", "secret-security"];
  }

  if (
    name.startsWith("src/") ||
    name.startsWith("tests/") ||
    name.endsWith(".js") ||
    name.endsWith(".ts")
  ) {
    return ["application", "application-security"];
  }

  return ["general", "baseline-security"];
}

const files = [...new Set(getChangedFiles())];
const classifications = {};

for (const file of files) {
  for (const category of classifyFile(file)) {
    classifications[category] ??= [];
    classifications[category].push(file);
  }
}

const plan = {
  project: "DepDevFlow",
  files,
  classifications,
  stages: {
    tests: true,
    secretScan: true,
    dependencyScan: true,
    sast: true,
    containerBuild: true,
    containerScan: true,
    infrastructureScan:
      Boolean(classifications.infrastructure),
    pipelineSecurity:
      Boolean(classifications.pipeline)
  }
};

fs.writeFileSync(
  ".pipeline-plan.json",
  JSON.stringify(plan, null, 2)
);

console.log(JSON.stringify(plan, null, 2));
