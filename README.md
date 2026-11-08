# DepDevFlow

**Risk-Aware Security Evidence Orchestration for DevSecOps CI/CD
Pipelines**

DepDevFlow integrates CI/CD orchestration, change-impact analysis,
security checks, risk-assessment logic, Kubernetes runtime
configuration, and monitoring visibility. Its objective is to make
security evidence part of software delivery rather than treating a
successful build as sufficient proof of security.

> **Status note:** This README reflects the project history and
> dashboard observations available when it was prepared. Verify the
> current repository, Jenkinsfile, scanner commands, and live
> environment before claiming every integration is operational. The
> dashboard has previously reported missing scanner reports and no
> published risk-decision result.

## Problem statement

A basic CI/CD workflow may automate checkout, testing, building, and
deployment without checking for exposed secrets, vulnerable
dependencies, insecure code patterns, or container/configuration
weaknesses. Security findings can also remain scattered across tools.
DepDevFlow aims to integrate these checks and provide a risk-assessment
component that evaluates available evidence against configured rules.

## Objectives

-   Orchestrate repeatable CI/CD stages using Jenkins.
-   Classify source changes to support change-impact analysis.
-   Run configured secret, source-code, dependency, configuration, and
    container checks.
-   Prepare scanner evidence for risk assessment.
-   Evaluate findings using configured severity weights and blocking
    conditions.
-   Apply Kubernetes deployment hardening settings.
-   Monitor connected services and runtime workloads.
-   Present available pipeline, quality, and runtime information in one
    dashboard.

## Architecture

``` text
Developer
   |
   v
GitHub repository
   |
   v
Jenkins pipeline (Jenkinsfile)
   |
   +--> Tests
   +--> Change-impact analysis
   +--> Gitleaks (secret detection)
   +--> Semgrep (static analysis)
   +--> npm audit (dependency analysis)
   +--> Trivy (configuration/container scans, as configured)
   +--> SonarQube (code quality / quality gate)
   |
   v
Evidence preparation
   |
   v
Risk engine
   |
   v
Configured release decision
   |
   v
Kubernetes workload / runtime
   |
   +--> Prometheus metrics
   +--> Grafana visualizations
   |
   v
DepDevFlow dashboard
```

This is the logical architecture. The actual stage order, conditional
execution, and enforcement behavior are defined by the current
Jenkinsfile and scripts. A component existing in the repository does not
by itself prove its end-to-end integration is active.

## Technology stack

  -------------------------------------------------------------------------
  Area                      Technology              Role
  ------------------------- ----------------------- -----------------------
  Source control            Git, GitHub             Version control and
                                                    source delivery

  CI/CD                     Jenkins                 Pipeline orchestration

  Runtime                   Node.js                 JavaScript runtime

  Secret detection          Gitleaks                Detect potential
                                                    exposed secrets

  Static analysis           Semgrep                 Find code patterns
                                                    matching configured
                                                    rules

  Dependency analysis       npm audit               Report known dependency
                                                    vulnerabilities

  Configuration/container   Trivy                   Scan supported
  scanning                                          configuration and
                                                    container artifacts

  Code quality              SonarQube               Code analysis and
                                                    quality gate

  Containers                Docker                  Build and run container
                                                    images

  Orchestration             Kubernetes / Kind       Manage workloads

  Metrics                   Prometheus              Query monitoring
                                                    metrics

  Visualization             Grafana                 Display monitoring
                                                    dashboards

  Dashboard                 Node.js, HTML, CSS,     Consolidated status
                            JavaScript              interface
  -------------------------------------------------------------------------

## Repository structure

The following is a conceptual map; the exact repository may contain
additional files or different subfolders.

``` text
DepDevFlow/
├── Jenkinsfile
├── Dockerfile
├── package.json
├── package-lock.json
├── scripts/
│   ├── analyze-changes.js
│   ├── build-risk-input.js
│   └── risk-engine.js
├── k8s/
│   └── deployment.yaml
├── reports/
└── dashboard/
    ├── server.js
    └── public/
        └── index.html
```

  -----------------------------------------------------------------------
  Path                                Responsibility
  ----------------------------------- -----------------------------------
  `Jenkinsfile`                       Defines CI/CD stages and execution
                                      rules

  `scripts/analyze-changes.js`        Classifies changed files and
                                      supports scanning plans

  `scripts/build-risk-input.js`       Prepares evidence for risk
                                      assessment

  `scripts/risk-engine.js`            Evaluates evidence using configured
                                      weights and rules

  `Dockerfile`                        Defines the container image build

  `k8s/`                              Kubernetes workload configuration

  `dashboard/server.js`               Dashboard backend and service
                                      integrations

  `dashboard/public/`                 Dashboard frontend

  `reports/`                          Intended scanner-report location,
                                      subject to pipeline configuration
  -----------------------------------------------------------------------

## Pipeline workflow

The Jenkinsfile is the source of truth for the actual pipeline. The
project workflow includes these areas, subject to the current pipeline's
conditions:

1.  Environment and dependency setup.
2.  Unit/integration tests.
3.  Change-impact analysis.
4.  Secret detection using Gitleaks.
5.  Static analysis using Semgrep.
6.  Dependency analysis using npm audit.
7.  Configuration/container scanning using Trivy.
8.  Code-quality analysis and quality-gate evaluation using SonarQube.
9.  Container build, where configured.
10. Evidence preparation and risk assessment, subject to integration.
11. Release/deployment handling according to configured rules.

A green build means configured stages passed according to their rules.
It does not prove that the application has no vulnerabilities.

## Security components

-   **Gitleaks:** Checks repository content for patterns associated with
    exposed credentials. Removing a secret from the latest file does not
    necessarily remove it from Git history. Revoke or rotate any real
    exposed credential.
-   **Semgrep:** Analyzes source code for patterns matching configured
    rules. Results depend on the ruleset and scan scope.
-   **npm audit:** Reports known vulnerabilities associated with the
    dependency tree. Review severity, affected versions, and
    remediation.
-   **Trivy:** Can inspect supported configuration files and container
    images. Exact scan types depend on the pipeline commands.
-   **SonarQube:** Provides code analysis and a quality gate based on
    configured conditions. A passing gate does not guarantee that all
    security issues have been eliminated.

## Risk assessment

The project includes `scripts/build-risk-input.js` and
`scripts/risk-engine.js`. At a high level, the intended process is:

1.  Collect available results from configured checks.
2.  Normalize findings and severity information.
3.  Apply configured severity weights and penalties.
4.  Evaluate blocking conditions and required evidence.
5.  Produce a risk assessment or release decision.

The exact formula, thresholds, and fail-safe behavior must be read from
the current scripts and Jenkinsfile. Do not infer a live release
decision from the existence of the code alone.

## Dashboard and monitoring

Previously configured local endpoints:

  Service              Local URL
  -------------------- ---------------------------------------
  Dashboard            `http://127.0.0.1:4173/`
  Dashboard health     `http://127.0.0.1:4173/api/health`
  Dashboard data       `http://127.0.0.1:4173/api/dashboard`
  Jenkins              `http://localhost:8081/`
  SonarQube            `http://localhost:9000/`
  Prometheus           `http://localhost:9090/`
  Grafana              `http://localhost:3000/`
  Application health   `http://localhost:8080/health`

These are local development defaults, not universal values. The
dashboard can display only information its backend retrieves and
understands. Service connectivity does not automatically mean scanner
findings or risk decisions are available.

## Prerequisites

Install and configure the tools used by the current repository:

-   Git
-   Node.js and npm
-   Docker Desktop
-   `kubectl`
-   Kind, if using the local Kind cluster
-   Jenkins
-   SonarQube
-   Gitleaks
-   Semgrep
-   Trivy
-   Prometheus and Grafana, if using the monitoring stack

Check local installations:

``` powershell
node --version
npm --version
git --version
docker --version
kubectl version --client
gitleaks version
semgrep --version
trivy --version
```

A command may be unavailable if its tool is not installed or not on
`PATH`.

## Local configuration

Set dashboard environment variables in the same PowerShell session used
to start `dashboard/server.js`.

  --------------------------------------------------------------------------------
  Variable                Purpose                 Example/default
  ----------------------- ----------------------- --------------------------------
  `JENKINS_URL`           Jenkins base URL        `http://localhost:8081`

  `JENKINS_JOB`           Jenkins job name        `DepDevFlow-CI`

  `JENKINS_USER`          Jenkins account name    Set locally

  `JENKINS_TOKEN`         Jenkins API token       Secret; never commit

  `SONAR_HOST_URL`        SonarQube base URL      `http://localhost:9000`

  `SONAR_TOKEN`           SonarQube user token    Secret; never commit

  `SONAR_PROJECT_KEY`     SonarQube project key   Exact configured project key, if
                                                  required

  `PROMETHEUS_URL`        Prometheus base URL     `http://localhost:9090`

  `APP_HEALTH_URL`        Application health      `http://localhost:8080/health`
                          endpoint                

  `K8S_NAMESPACE`         Namespace for workload  Set to intended namespace
                          queries                 
  --------------------------------------------------------------------------------

Example PowerShell setup. Enter credentials interactively; do not paste
them into tracked files:

``` powershell
$env:JENKINS_URL = "http://localhost:8081"
$env:JENKINS_JOB = "DepDevFlow-CI"
$env:JENKINS_USER = Read-Host "Jenkins username"

$secure = Read-Host "Jenkins API token" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $env:JENKINS_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

$env:SONAR_HOST_URL = "http://localhost:9000"
$secure = Read-Host "SonarQube token" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $env:SONAR_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

$env:PROMETHEUS_URL = "http://localhost:9090"
$env:APP_HEALTH_URL = "http://localhost:8080/health"
```

These variables apply to the current PowerShell process and its child
processes. Reconfigure them after opening a new terminal. Use a
protected local secret store for persistent configuration. Never commit
tokens.

## Running the project

Open PowerShell in the repository:

``` powershell
Set-Location "D:\\Project 26X\\DepDevFlow"
```

### 1. Verify Docker and Kubernetes

``` powershell
docker version
docker ps
kubectl config current-context
kubectl get nodes
kubectl get pods -A
kubectl get services -A
```

Start required services using the Compose files, service definitions, or
scripts actually present in the repository. Avoid starting duplicate
stacks.

### 2. Verify or forward the application service

``` powershell
kubectl get services -A
```

If the `depdevflow` service exists in the `default` namespace and local
port 8080 is free, use a dedicated terminal:

``` powershell
kubectl port-forward service/depdevflow 8080:80
```

Keep the terminal open. If the service is in another namespace, specify
that namespace. Verify:

``` powershell
Invoke-RestMethod "http://localhost:8080/health"
```

### 3. Start the dashboard

After setting the required environment variables in the same terminal:

``` powershell
Set-Location "D:\\Project 26X\\DepDevFlow"
node --check ".\\dashboard\\server.js"
if ($LASTEXITCODE -ne 0) {
    throw "Dashboard server syntax check failed."
}
node ".\\dashboard\\server.js"
```

Keep the terminal open.

### 4. Verify dashboard APIs

From a separate terminal:

``` powershell
Invoke-RestMethod "http://127.0.0.1:4173/api/health"

$data = Invoke-RestMethod "http://127.0.0.1:4173/api/dashboard"
$data | ConvertTo-Json -Depth 10
```

Open `http://127.0.0.1:4173/`.

### 5. Monitoring port-forwards (only if needed)

Inspect actual service names first:

``` powershell
kubectl get services -n monitoring
```

If the following services exist and the local ports are free, use
dedicated terminals:

``` powershell
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
```

``` powershell
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
```

Do not run duplicate port-forwards.

## Verifying integrations

-   **Jenkins 401:** verify username and API token.
-   **Jenkins 403:** verify the account can read job/build APIs.
-   **Jenkins 404:** verify Jenkins URL and job name.
-   **SonarQube 401:** verify token validity.
-   **SonarQube 403:** verify token permissions and project access.
-   **Connection refused:** verify service status, URL, and port.
-   **Missing scanner findings:** verify report generation, report
    paths, and supported formats.
-   **Missing risk decision:** verify the pipeline publishes an actual
    result in the location/schema expected by the dashboard.

Redact credentials from logs and screenshots.

## Controlled security demonstration

Use a separate demonstration branch and disposable fixtures. Never use a
real credential or intentionally vulnerable production dependency.

1.  Record a successful baseline build.
2.  Create a branch such as `demo/security-incident`.
3.  Add a fake secret-like fixture and run the configured Gitleaks scan.
4.  Add a harmless static-analysis fixture that matches a rule in the
    configured Semgrep ruleset.
5.  Use an isolated test project or existing fixture for dependency
    vulnerability testing.
6.  Inspect Jenkins logs and scanner outputs to confirm what was
    actually detected.
7.  Feed supported evidence into the risk-engine test path and inspect
    its actual result.
8.  Remove fixtures and rerun checks.
9.  Delete the demonstration branch; do not merge it into `main`.

Detection and release blocking are separate behaviors. Claim blocking
only if the pipeline or branch protection actually enforces it. Deleting
a secret from the latest file does not remove it from Git history.
Revoke/rotate any real exposed credential.

## Current implementation status

Based on the project history and dashboard observations available when
this README was prepared; revalidate before presenting:

  -----------------------------------------------------------------------
  Area                                Known status / evidence
  ----------------------------------- -----------------------------------
  GitHub repository                   Exists and has been used

  Jenkins pipeline                    Configured; dashboard previously
                                      displayed build #21 SUCCESS

  SonarQube                           Dashboard previously retrieved a
                                      passing quality gate

  Prometheus                          Dashboard integration previously
                                      connected

  Kubernetes                          Dashboard previously retrieved pod
                                      inventory; showed 16/16 at that
                                      time

  Application health                  Dashboard previously reached the
                                      configured endpoint

  Dashboard                           Implemented and serving integration
                                      data

  Change-impact analysis              Script exists in project history

  Risk engine                         Script and evidence builder exist
                                      in project history

  Scanner report aggregation          Dashboard previously reported no
                                      supported scanner JSON reports

  Risk decision display               Dashboard previously reported no
                                      result file

  End-to-end risk-based deployment    Verify from current pipeline before
  enforcement                         claiming complete

  Adaptive-vs-conventional            No measured comparison documented
  performance evaluation              here
  -----------------------------------------------------------------------

## Limitations and future work

-   Aggregate scanner reports into a documented common schema.
-   Publish the actual risk-engine result as an artifact or API response
    and display it in the dashboard.
-   Validate that required missing evidence and configured blocking
    findings stop release progression.
-   Verify branch protection and pull-request checks if preventing
    unsafe merges is required.
-   Compare conventional and adaptive scanning with repeatable
    measurements of duration, scan coverage, findings, and failure
    behavior.
-   Add SBOM generation and evaluate artifact provenance and
    attestation.
-   Extend Kubernetes policy enforcement and runtime monitoring.
-   Improve integration diagnostics and error reporting.

## Security notes

-   Never commit Jenkins API tokens, SonarQube tokens, passwords, or
    real application credentials.
-   Use protected environment variables or a secret manager.
-   Apply least-privilege permissions.
-   Use disposable branches and fixtures for demonstrations.
-   Do not push deliberately vulnerable test code to the production
    branch.
-   Rotate any real credential that may have been exposed.
-   Treat scanner output as evidence requiring review, not a guarantee
    of security.
-   Review the current pipeline before describing a release as
    automatically blocked or secured.

## License

Add the project's selected license and ownership details before
publishing it as open source.
