pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    environment {
    IMAGE_NAME = 'depdevflow'
    PATH+DOCKER = 'C:/Users/ASUS/AppData/Local/Programs/DockerDesktop/resources/bin'
}

    stages {
        stage('1. Environment Check') {
    steps {
        bat 'git --version'
        bat 'node --version'
        bat 'npm --version'
        bat 'where docker'
        bat 'docker --version'
        bat 'docker info --format "Docker engine: {{.ServerVersion}}"'
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

        stage('4a. Adaptive Infrastructure Scan') {
             when {
        expression {
            if (!fileExists('.pipeline-plan.json')) {
                return false
            }

            def plan = new groovy.json.JsonSlurperClassic()
                .parseText(readFile('.pipeline-plan.json'))

            return plan.classifications.containsKey('infrastructure')
        }
    }

    steps {
        echo 'Infrastructure changes detected. Running configuration security checks.'

        bat '''
            docker run --rm ^
              -v "%WORKSPACE%:/src" ^
              aquasec/trivy:latest ^
              config --exit-code 1 --severity HIGH,CRITICAL /src
        '''
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
        bat 'docker save -o depdevflow.tar depdevflow:ci'
    }
}
    }
}

        stage('9. Container Vulnerability Scan') {
    steps {
        bat '''
            docker run --rm ^
              -v "%WORKSPACE%:/repo" ^
              aquasec/trivy:latest ^
              image --input /repo/depdevflow.tar ^
              --exit-code 1 ^
              --severity HIGH,CRITICAL
        '''
    }

    post {
        always {
            archiveArtifacts(
                artifacts: 'depdevflow.tar',
                allowEmptyArchive: true
            )
        }
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