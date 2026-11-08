const fs = require("node:fs");

function evaluateRisk(input) {
  const findings = Array.isArray(input.findings) ? input.findings : [];
  const testsPassed = input.testsPassed === true;
  const secretDetected = input.secretDetected === true;
  const scannerFailed = input.scannerFailed === true;

  const criticalCount = findings.filter(
    f => String(f.severity).toUpperCase() === "CRITICAL"
  ).length;

  const highCount = findings.filter(
    f => String(f.severity).toUpperCase() === "HIGH"
  ).length;

  let score = 0;

  score += criticalCount * 40;
  score += highCount * 15;

  if (!testsPassed) score += 40;
  if (secretDetected) score += 100;
  if (scannerFailed) score += 40;

  score = Math.min(score, 100);

  const blocked =
    !testsPassed ||
    secretDetected ||
    scannerFailed ||
    criticalCount > 0 ||
    highCount > 0;

  return {
    project: "DepDevFlow",
    score,
    level:
      score >= 70 ? "HIGH" :
      score >= 30 ? "MEDIUM" :
      score > 0 ? "LOW" : "MINIMAL",
    decision: blocked ? "BLOCK" : "PROCEED",
    reasons: [
      ...(!testsPassed ? ["Required tests failed"] : []),
      ...(secretDetected ? ["Secret detected"] : []),
      ...(scannerFailed ? ["One or more security reports are missing or invalid"] : []),
      ...(criticalCount ? [`${criticalCount} critical vulnerability finding(s)`] : []),
      ...(highCount ? [`${highCount} high vulnerability finding(s)`] : [])
    ],
    scannerErrors: Array.isArray(input.scannerErrors)
      ? input.scannerErrors
      : []
  };
}

if (require.main === module) {
  const inputPath = process.argv[2];

  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error("Usage: node scripts/risk-engine.js <input.json>");
    process.exit(2);
  }

  try {
    const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
    const result = evaluateRisk(input);

    console.log(JSON.stringify(result, null, 2));

    if (result.decision === "BLOCK") {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`Risk evaluation failed: ${error.message}`);
    process.exitCode = 2;
  }
}

module.exports = { evaluateRisk };
