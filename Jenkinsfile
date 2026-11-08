pipeline {
    agent any
    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }
    environment {
        IMAGE_NAME = 'depdevflow'
        DOCKER_EXE = 'C:/Users/ASUS/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe'
        TESTS_PASSED = 'false'
        GITLEAKS_STATUS = 'not-run'
        SEMGREP_STATUS = 'not-run'
        NPM_AUDIT_STATUS = 'not-run'
        TRIVY_CONFIG_STATUS = 'skipped'
        TRIVY_IMAGE_STATUS = 'not-run'
        SONAR_STATUS = 'not-run'
    }
    stages {
        stage('1. Environment Check') {
            steps {
                bat 'if exist reports rmdir /s /q reports & mkdir reports'
                bat 'git --version'
                bat 'node --version'
                bat 'npm --version'
                bat '"%DOCKER_EXE%" --version'
                bat '"%DOCKER_EXE%" info --format "Docker engine: {{.ServerVersion}}"'
            }
        }
        stage('2. Install Dependencies') {
            steps { bat 'npm ci' }
        }
        stage('3. Unit and Integration Tests') {
            steps {
                script {
                    int testStatus = bat(returnStatus: true, script: 'npm test')
                    env.TESTS_PASSED = testStatus == 0 ? 'true' : 'false'
                    if (testStatus != 0) {
                        echo "Tests failed with exit code ${testStatus}; collecting evidence before the final risk gate."
                    } else {
                        echo 'All tests passed.'
                    }
                }
            }
        }
        stage('4. Change Impact Analysis') {
            steps {
                bat 'node scripts/analyze-changes.js'
                script { echo "Change impact report:\n${readFile('.pipeline-plan.json')}" }
                archiveArtifacts artifacts: '.pipeline-plan.json', fingerprint: true
            }
        }
        stage('4a. Adaptive Infrastructure Scan') {
            when {
                expression {
                    fileExists('.pipeline-plan.json') &&
                    readFile('.pipeline-plan.json').contains('"infrastructureScan": true')
                }
            }
            steps {
                script {
                    echo 'Infrastructure changes detected. Collecting Trivy configuration report.'
                    int status = bat(returnStatus: true, script: '''
                        if not exist reports mkdir reports
                        "%DOCKER_EXE%" run --rm ^
                          -v "%WORKSPACE%:/src" ^
                          aquasec/trivy:latest ^
                          config --format json --output /src/reports/trivy-config.json ^
                          --exit-code 0 /src
                    ''')
                    env.TRIVY_CONFIG_STATUS = status.toString()
                    if (status != 0) echo "Trivy config scanner execution failed (exit ${status}); risk gate will block."
                }
            }
        }
        stage('5. Secret Detection') {
            steps {
                script {
                    int status = bat(returnStatus: true, script: '''
                        if not exist reports mkdir reports
                        "%DOCKER_EXE%" run --rm ^
                          -v "%WORKSPACE%:/repo" ^
                          zricethezav/gitleaks:latest ^
                          git /repo --report-format json ^
                          --report-path /repo/reports/gitleaks.json ^
                          --redact --no-banner
                    ''')
                    env.GITLEAKS_STATUS = status.toString()
                    if (status > 1) echo "Gitleaks execution failed (exit ${status}); risk gate will block."
                    else if (status == 1) echo 'Gitleaks findings detected; the risk engine will record and block them.'
                }
            }
        }
        stage('6. Static Application Security Testing') {
            steps {
                script {
                    int status = bat(returnStatus: true, script: '''
                        if not exist reports mkdir reports
                        "%DOCKER_EXE%" run --rm ^
                          -v "%WORKSPACE%:/src" ^
                          semgrep/semgrep:latest ^
                          semgrep scan --config p/ci --json ^
                          --output /src/reports/semgrep.json /src
                    ''')
                    env.SEMGREP_STATUS = status.toString()
                    if (status > 1) echo "Semgrep execution failed (exit ${status}); risk gate will block."
                    else if (status == 1) echo 'Semgrep reported findings or policy violations; continuing to consolidated risk gate.'
                }
            }
        }
        stage('7. Dependency Vulnerability Scan') {
            steps {
                script {
                    int status = bat(returnStatus: true, script: '''
                        if not exist reports mkdir reports
                        call npm audit --json > reports\\npm-audit.json
                    ''')
                    env.NPM_AUDIT_STATUS = status.toString()
                    echo "npm audit exited with ${status}; its JSON report will be evaluated."
                }
            }
        }
        stage('8a. SonarQube Analysis') {
            steps {
                script {
                    int status = -1
                    withCredentials([string(credentialsId: 'sonarqube-token', variable: 'SONAR_TOKEN')]) {
                        withEnv(['SONAR_HOST_URL=http://localhost:9000']) {
                            status = bat(returnStatus: true, script: 'npx --yes @sonar/scan')
                        }
                    }
                    env.SONAR_STATUS = status.toString()
                    if (status != 0) echo "SonarQube analysis/quality gate returned ${status}; risk gate will block."
                }
            }
        }
        stage('8. Docker Build') {
            steps {
                bat '"%DOCKER_EXE%" build -t depdevflow:ci .'
                bat '"%DOCKER_EXE%" save -o depdevflow.tar depdevflow:ci'
            }
        }
        stage('9. Container Vulnerability Scan') {
            steps {
                script {
                    int status = bat(returnStatus: true, script: '''
                        if not exist reports mkdir reports
                        "%DOCKER_EXE%" run --rm ^
                          -v "%WORKSPACE%:/repo" ^
                          aquasec/trivy:latest ^
                          image --input /repo/depdevflow.tar ^
                          --format json --output /repo/reports/trivy-image.json ^
                          --exit-code 0
                    ''')
                    env.TRIVY_IMAGE_STATUS = status.toString()
                    if (status != 0) echo "Trivy image scan execution failed (exit ${status}); risk gate will block."
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'depdevflow.tar', allowEmptyArchive: true, fingerprint: true
                }
            }
        }
        stage('10. Consolidated Risk Decision') {
            steps {
                script {
                    def scannerErrors = []
                    try {
                        int s = env.GITLEAKS_STATUS.toInteger()
                        if (s > 1) scannerErrors << "Gitleaks execution failed (exit ${s})"
                    } catch (ignored) { scannerErrors << 'Gitleaks did not return a valid status' }

                    try {
                        int s = env.SEMGREP_STATUS.toInteger()
                        if (s > 1) scannerErrors << "Semgrep execution failed (exit ${s})"
                    } catch (ignored) { scannerErrors << 'Semgrep did not return a valid status' }

                    try {
                        int s = env.TRIVY_IMAGE_STATUS.toInteger()
                        if (s != 0) scannerErrors << "Trivy image scan failed (exit ${s})"
                    } catch (ignored) { scannerErrors << 'Trivy image scan did not return a valid status' }

                    try {
                        int s = env.SONAR_STATUS.toInteger()
                        if (s != 0) scannerErrors << "SonarQube analysis/quality gate failed (exit ${s})"
                    } catch (ignored) { scannerErrors << 'SonarQube did not return a valid status' }

                    def plan = fileExists('.pipeline-plan.json') ? readFile('.pipeline-plan.json') : ''
                    if (plan.contains('"infrastructureScan": true')) {
                        try {
                            int s = env.TRIVY_CONFIG_STATUS.toInteger()
                            if (s != 0) scannerErrors << "Trivy config scan failed (exit ${s})"
                        } catch (ignored) { scannerErrors << 'Required Trivy config scan did not run' }
                    }

                    writeFile file: 'reports/scanner-errors.txt',
                        text: scannerErrors.isEmpty() ? '' : scannerErrors.join('\n') + '\n'

                    bat 'node scripts/build-risk-input.js reports risk-input.json'
                    int riskStatus = bat(returnStatus: true, script: 'node scripts/risk-engine.js risk-input.json > risk-decision.json')
                    if (fileExists('risk-decision.json')) {
                        echo "Consolidated risk decision:\n${readFile('risk-decision.json')}"
                    }
                    archiveArtifacts artifacts: 'reports/**,risk-input.json,risk-decision.json,.pipeline-plan.json',
                        allowEmptyArchive: true, fingerprint: true
                    if (riskStatus != 0) {
                        error("DepDevFlow risk gate BLOCKED this build (risk-engine exit ${riskStatus}). Review archived reports.")
                    }
                }
            }
        }
    }
    post {
        always {
            echo 'DepDevFlow pipeline finished. Review archived reports and the consolidated risk decision.'
        }
        success {
            echo 'Risk engine returned PROCEED. Configured checks completed without a blocking condition.'
        }
        failure {
            echo 'Pipeline failed or the consolidated risk engine blocked the build. Do not release this build.'
        }
    }
}