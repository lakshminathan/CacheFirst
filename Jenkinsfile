pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                // Checkout the code from the repository
                git branch: 'main', url: 'https://github.com/lakshminathan/CacheFirst.git'
            }
        }
        stage('Install Dependencies') {
            steps {
                // Install Node.js dependencies
                sh 'npm install'
            }
        }
        stage('Lint') {
            steps {
                // Run linter to ensure code quality
                sh 'npm run lint'
            }
        }
        stage('Test') {
            steps {
                // Run tests
                sh 'npm test'
            }
        }
        stage('Build') {
            steps {
                // Build the application
                sh 'npm run build'
            }
        }
    }

    post {
        always {
            // Clean up after build
            cleanWs()
        }
        success {
            // Actions on successful build
            echo 'Build completed successfully!'
        }
        failure {
            // Actions on failed build
            echo 'Build failed.'
        }
    }
}
