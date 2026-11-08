# DepDevFlow Dashboard

The dashboard is the consolidated interface for displaying available
CI/CD, code-quality, security-evidence, and runtime information.

## Files

-   `server.js` --- Node.js backend that serves the dashboard and
    retrieves service data.
-   `public/index.html` --- dashboard frontend.

## URLs

``` text
Dashboard:       http://127.0.0.1:4173/
Health endpoint: http://127.0.0.1:4173/api/health
Data endpoint:   http://127.0.0.1:4173/api/dashboard
```

## Environment variables

Set these in the same PowerShell session used to start the Node.js
server.

  Variable              Purpose
  --------------------- -------------------------------------------
  `JENKINS_URL`         Jenkins base URL
  `JENKINS_JOB`         Jenkins job name
  `JENKINS_USER`        Jenkins username
  `JENKINS_TOKEN`       Jenkins API token
  `SONAR_HOST_URL`      SonarQube base URL
  `SONAR_TOKEN`         SonarQube user token
  `SONAR_PROJECT_KEY`   Exact project key, if required by backend
  `PROMETHEUS_URL`      Prometheus base URL
  `APP_HEALTH_URL`      Application health endpoint
  `K8S_NAMESPACE`       Namespace used for workload queries

Typical local URLs:

``` powershell
$env:JENKINS_URL = "http://localhost:8081"
$env:JENKINS_JOB = "DepDevFlow-CI"
$env:SONAR_HOST_URL = "http://localhost:9000"
$env:PROMETHEUS_URL = "http://localhost:9090"
$env:APP_HEALTH_URL = "http://localhost:8080/health"
```

Enter Jenkins and SonarQube credentials interactively or load them from
a protected local secret store. Never hardcode tokens in source files or
commit them.

Secure interactive prompts:

``` powershell
$env:JENKINS_USER = Read-Host "Jenkins username"
$secure = Read-Host "Jenkins API token" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $env:JENKINS_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

$secure = Read-Host "SonarQube token" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $env:SONAR_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}
```

These variables apply to the current PowerShell process and child
processes. Reconfigure them after opening a new terminal.

## Start

From the repository root:

``` powershell
Set-Location "D:\\Project 26X\\DepDevFlow"
node --check ".\\dashboard\\server.js"
if ($LASTEXITCODE -ne 0) {
    throw "Dashboard server syntax check failed."
}
node ".\\dashboard\\server.js"
```

Keep the terminal running.

## Verify

From a second terminal:

``` powershell
Invoke-RestMethod "http://127.0.0.1:4173/api/health"
$data = Invoke-RestMethod "http://127.0.0.1:4173/api/dashboard"
$data | ConvertTo-Json -Depth 10
```

## Troubleshooting

  -----------------------------------------------------------------------
  Symptom                             Check
  ----------------------------------- -----------------------------------
  Jenkins credentials missing         Set `JENKINS_USER` and
                                      `JENKINS_TOKEN` in the dashboard
                                      process environment

  Jenkins 401                         Verify username and API token

  Jenkins 403                         Verify Jenkins job/build read
                                      permissions

  Jenkins 404                         Verify base URL and job name

  SonarQube token missing             Set `SONAR_TOKEN` in the dashboard
                                      process environment

  SonarQube 401/403                   Verify token and project
                                      permissions

  Prometheus unavailable              Verify URL, port, and service
                                      health

  Kubernetes unavailable              Verify kubectl context, cluster
                                      access, and namespace

  Application unavailable             Verify health endpoint and any
                                      required port-forward

  Scanner findings unavailable        Verify report generation, expected
                                      directory, and supported JSON
                                      format

  Risk decision unknown               Verify that the pipeline publishes
                                      a real result in the expected
                                      location/schema
  -----------------------------------------------------------------------

## Data limitations

The dashboard displays only information that its backend can retrieve
and interpret. Jenkins connectivity does not guarantee stage details are
available. SonarQube connectivity does not mean scanner findings are
aggregated. Scanner report aggregation and risk-decision publishing must
be implemented and verified separately.

A missing report must not be interpreted as zero findings. An unknown
risk decision must not be interpreted as an approved release.
