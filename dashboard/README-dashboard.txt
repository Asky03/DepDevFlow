DepDevFlow Dashboard — local MVP
================================

Files
-----
dashboard/server.js
dashboard/public/index.html

Requirements
------------
- Node.js 20+ (Node 24 is fine).
- DepDevFlow project dependencies are not required for this dashboard server.
- Optional: SonarQube, Jenkins, Prometheus port-forward, kubectl context, and application port-forward.

Install
-------
Extract the dashboard folder into:
D:\Project 26X\DepDevFlow\dashboard

Run in PowerShell from the project root:
  $env:SONAR_HOST_URL = "http://localhost:9000"
  $secure = Read-Host "SonarQube token (input hidden)" -AsSecureString
  $env:SONAR_TOKEN = [System.Net.NetworkCredential]::new("", $secure).Password
  $env:JENKINS_URL = "http://localhost:8081"
  $env:JENKINS_JOB = "DepDevFlow-CI"
  $env:PROMETHEUS_URL = "http://localhost:9090"
  $env:APP_HEALTH_URL = "http://localhost:8080/health"
  node .\dashboard\server.js

Then open:
  http://127.0.0.1:4173

Prometheus access
-----------------
If Prometheus is running in Kubernetes, run this in a separate PowerShell terminal
and keep it open. First check the exact service name:
  kubectl get svc -n monitoring
Then, if the service is named monitoring-kube-prometheus-prometheus:
  kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090

Application health
------------------
If the DepDevFlow app is not currently forwarded to localhost:8080, either start its
existing port-forward or set APP_HEALTH_URL to the actual local health URL.

Jenkins authentication
----------------------
If Jenkins does not allow read-only API access anonymously, set these environment
variables in the same PowerShell session before starting the dashboard:
  $env:JENKINS_USER = "your-jenkins-user"
  $secureJenkins = Read-Host "Jenkins API token (input hidden)" -AsSecureString
  $env:JENKINS_TOKEN = [System.Net.NetworkCredential]::new("", $secureJenkins).Password

Use a Jenkins API token, not your account password. Do not commit tokens or place them
in HTML/JavaScript. To clear the session variables later:
  Remove-Item Env:SONAR_TOKEN,Env:JENKINS_TOKEN -ErrorAction SilentlyContinue

What is live vs pending
-----------------------
Live if reachable and authorized:
- SonarQube measures and Quality Gate
- Latest Jenkins build summary and workflow stages when wfapi is available
- Prometheus `up` query and optional `kube_pod_info`
- Kubernetes pod inventory from the current kubectl context
- DepDevFlow /health endpoint

Explicitly pending:
- Normalized Trivy/Semgrep/Gitleaks reports exposed to the dashboard
- Risk-engine result published by Jenkins as an artifact/API
- Conventional-vs-adaptive experimental measurements
These are intentionally not fabricated. They require follow-on pipeline artifact integration and repeatable experiments.

Security notes
--------------
- This server binds to 127.0.0.1 only; it is a local dashboard MVP, not a public deployment.
- Secrets are read from process environment variables by the backend and are never sent to the browser.
- Do not expose this server or local Jenkins/SonarQube/Grafana endpoints publicly.
- For a public website, deploy a properly authenticated backend/API and keep service credentials server-side.
