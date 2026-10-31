pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    environment {
        IMAGE_NAME = 'depdevflow'
    }

    stages {
        stage('1. Environment Check') {
            steps {
                bat 'git --version'
                bat 'node --version'
                bat 'npm --version'
                bat 'docker --version'
            }
        }

        stage('2. Install Dependencies') {
            steps {
                bat 'npm ci'
            }
        }

        stage('3. Unit and Integration Tests') {
            steps {
                bat 'npm test'
            }
        }

        stage('4. Change Impact Analysis') {
            steps {
                bat 'node scripts/analyze-changes.js'

                script {
                    def plan = readFile('.pipeline-plan.json')
                    echo "Change impact report:\n${plan}"
                }

                archiveArtifacts(
                    artifacts: '.pipeline-plan.json',
                    fingerprint: true
                )
            }
        }

        stage('5. Secret Detection') {
            steps {
                bat '''
                    docker run --rm ^
                      -v "%WORKSPACE%:/repo" ^
                      zricethezav/gitleaks:latest ^
                      git /repo --redact --no-banner
                '''
            }
        }

        stage('6. Static Application Security Testing') {
            steps {
                bat '''
                    docker run --rm ^
                      -v "%WORKSPACE%:/src" ^
                      semgrep/semgrep:latest ^
                      semgrep scan --config p/ci /src
                '''
            }
        }

        stage('7. Dependency Vulnerability Scan') {
            steps {
                bat 'npm audit --audit-level=high'
            }
        }

        stage('8. Docker Build') {
            steps {
                bat 'docker build -t depdevflow:ci .'
            }
        }

        stage('9. Container Vulnerability Scan') {
            steps {
                bat '''
                    docker run --rm ^
                      -v /var/run/docker.sock:/var/run/docker.sock ^
                      aquasec/trivy:latest ^
                      image --exit-code 1 --severity HIGH,CRITICAL depdevflow:ci
                '''
            }
        }
    }

    post {
        always {
            echo 'DepDevFlow pipeline finished. Review the stage results.'
        }

        success {
            echo 'All configured quality and security gates passed.'
        }

        failure {
            echo 'Pipeline failed. Review the failing stage before release.'
        }
    }
}