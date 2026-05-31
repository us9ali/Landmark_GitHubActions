# Jenkins CI/CD Pipeline — Landmark DevOps Demo

Complete guide to installing Jenkins on an Amazon Linux 2023 EC2 instance and running the Landmark DevOps application pipeline.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Launch an EC2 Instance](#launch-an-ec2-instance)
4. [Install Jenkins on Amazon Linux](#install-jenkins-on-amazon-linux)
5. [Access Jenkins UI](#access-jenkins-ui)
6. [Initial Jenkins Setup](#initial-jenkins-setup)
7. [Install Required Plugins](#install-required-plugins)
8. [Configure Tools in Jenkins](#configure-tools-in-jenkins)
9. [Add Credentials](#add-credentials)
10. [Connect Jenkins to GitHub](#connect-jenkins-to-github)
11. [Create the Pipeline Job](#create-the-pipeline-job)
12. [Jenkinsfile Explained](#jenkinsfile-explained)
13. [Multi-Environment Pipeline](#multi-environment-pipeline)
14. [Deploy to EKS from Jenkins](#deploy-to-eks-from-jenkins)
15. [Webhook Configuration](#webhook-configuration)
16. [Troubleshooting](#troubleshooting)
17. [Best Practices](#best-practices)

---

## Overview

This project uses a `Jenkinsfile` (declarative pipeline) to:
- Build the Node.js application (pnpm)
- Run tests (Vitest — 59 test cases)
- Build and push Docker images to DockerHub
- Deploy to AWS EKS (Kubernetes)

---

## Architecture

```
┌──────────┐       ┌──────────────┐       ┌────────────┐       ┌─────────┐
│  GitHub  │──────▶│   Jenkins    │──────▶│  DockerHub │──────▶│   EKS   │
│  (Push)  │       │  (EC2 Host)  │       │  (Registry)│       │(Cluster)│
└──────────┘       └──────────────┘       └────────────┘       └─────────┘
     │                    │
     │ Webhook            │ Build + Test + Docker + Deploy
     └────────────────────┘
```

---

## Launch an EC2 Instance

### Step 1: Launch Instance in AWS Console

| Setting | Value |
|---------|-------|
| Name | `jenkins-server` |
| AMI | Amazon Linux 2023 |
| Instance Type | `t2.medium` (minimum for Jenkins) |
| Key Pair | Create or select existing |
| Storage | 30 GB gp3 |

### Step 2: Security Group Rules

| Type | Port | Source | Purpose |
|------|------|--------|---------|
| SSH | 22 | Your IP | SSH access |
| Custom TCP | 8080 | 0.0.0.0/0 | Jenkins UI |
| HTTP | 80 | 0.0.0.0/0 | (Optional) Reverse proxy |
| HTTPS | 443 | 0.0.0.0/0 | (Optional) SSL |

### Step 3: Connect to the Instance

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ec2-user@<PUBLIC_IP>
```

---

## Install Jenkins on Amazon Linux

### Step 1: Update the System

```bash
sudo yum update -y
```

### Step 2: Install Java 17 (Required for Jenkins)

```bash
sudo yum install java-17-amazon-corretto -y
java -version
```

### Step 3: Add Jenkins Repository

```bash
sudo wget -O /etc/yum.repos.d/jenkins.repo https://pkg.jenkins.io/redhat-stable/jenkins.repo
sudo rpm --import https://pkg.jenkins.io/redhat-stable/jenkins.io-2023.key
```

### Step 4: Install Jenkins

```bash
sudo yum install jenkins -y
```

### Step 5: Start and Enable Jenkins

```bash
sudo systemctl start jenkins
sudo systemctl enable jenkins
sudo systemctl status jenkins
```

### Step 6: Install Node.js 20

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install nodejs -y
node --version
npm --version
```

### Step 7: Install pnpm

```bash
sudo npm install -g pnpm@10.33.0
pnpm --version
```

### Step 8: Install Docker

```bash
sudo yum install docker -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker jenkins
sudo usermod -aG docker ec2-user
sudo systemctl restart jenkins
```

> **Important:** Restart Jenkins after adding it to the docker group, otherwise Docker commands will fail with "permission denied".

### Step 9: Install Git

```bash
sudo yum install git -y
git --version
```

### Step 10: Install kubectl (for EKS deployment)

```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
kubectl version --client
```

### Step 11: Install AWS CLI

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
aws --version
```

---

## Access Jenkins UI

1. Open your browser: `http://<EC2_PUBLIC_IP>:8080`
2. Get the initial admin password:

```bash
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

3. Paste the password into the browser
4. Click **"Install suggested plugins"**
5. Create your admin user:
   - Username: `admin`
   - Password: your choice
   - Full Name: your name
   - Email: your email
6. Set Jenkins URL: `http://<EC2_PUBLIC_IP>:8080/`
7. Click **"Start using Jenkins"**

---

## Initial Jenkins Setup

### Configure System

Go to **Manage Jenkins → System**:

1. **Jenkins URL**: `http://<EC2_PUBLIC_IP>:8080/`
2. **System Admin e-mail**: your email
3. Click **Save**

---

## Install Required Plugins

Go to **Manage Jenkins → Plugins → Available plugins**

Search and install:

| Plugin | Purpose |
|--------|---------|
| Pipeline | Declarative pipeline support |
| Git | Git SCM integration |
| GitHub Integration | GitHub webhooks and status |
| Docker Pipeline | Docker build steps in pipeline |
| Docker Commons | Docker credential management |
| Credentials Binding | Inject credentials into builds |
| NodeJS | Node.js tool installer |
| Pipeline: Stage View | Visual pipeline stages |
| Blue Ocean | Modern UI (optional) |
| AWS Credentials | AWS credential management |
| Kubernetes CLI | kubectl in pipelines |

After installing, restart Jenkins:

```bash
sudo systemctl restart jenkins
```

---

## Configure Tools in Jenkins

Go to **Manage Jenkins → Tools**

### NodeJS Installation

1. Scroll to **NodeJS installations**
2. Click **Add NodeJS**
3. Name: `node-20`
4. Check **Install automatically**
5. Version: `NodeJS 20.x`
6. Global npm packages: `pnpm@10.33.0`

### Git Installation

1. Scroll to **Git installations**
2. Name: `Default`
3. Path: `/usr/bin/git`

### Docker Installation

1. Scroll to **Docker installations**
2. Name: `docker`
3. Check **Install automatically**

---

## Add Credentials

Go to **Manage Jenkins → Credentials → System → Global credentials → Add Credentials**

### DockerHub Credentials

| Field | Value |
|-------|-------|
| Kind | Username with password |
| Scope | Global |
| Username | `chafah` |
| Password | Your DockerHub password/token |
| ID | `dockerhub-credentials` |
| Description | DockerHub Login |

### AWS Credentials

| Field | Value |
|-------|-------|
| Kind | AWS Credentials |
| Scope | Global |
| Access Key ID | Your AWS access key |
| Secret Access Key | Your AWS secret key |
| ID | `aws-credentials` |
| Description | AWS EKS Access |

### GitHub Credentials (for private repos)

| Field | Value |
|-------|-------|
| Kind | Username with password |
| Scope | Global |
| Username | Your GitHub username |
| Password | GitHub Personal Access Token (PAT) |
| ID | `github-credentials` |
| Description | GitHub Access |

#### Generate a GitHub PAT:

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click **Generate new token**
3. Select scopes: `repo`, `admin:repo_hook`
4. Copy the token and use it as the password

---

## Connect Jenkins to GitHub

### Option A: Webhook (Automatic Triggers)

1. In GitHub, go to your repo → **Settings → Webhooks → Add webhook**
2. Payload URL: `http://<EC2_PUBLIC_IP>:8080/github-webhook/`
3. Content type: `application/json`
4. Events: **Just the push event** (or select individual events)
5. Click **Add webhook**

### Option B: Poll SCM (Fallback)

In your Jenkins job configuration:
- Build Triggers → **Poll SCM**
- Schedule: `H/5 * * * *` (every 5 minutes)

> **Webhook is preferred** — it triggers instantly on push. Polling adds delay and wastes resources.

---

## Create the Pipeline Job

### Step 1: New Item

1. Click **New Item** on the Jenkins dashboard
2. Name: `landmark-devops-pipeline`
3. Select **Pipeline**
4. Click **OK**

### Step 2: Configure Pipeline

#### General
- Check **GitHub project**
- Project URL: `https://github.com/LandmakTechnology/landmark_nodejsApp`

#### Build Triggers
- Check **GitHub hook trigger for GITScm polling**

#### Pipeline Definition
- Definition: **Pipeline script from SCM**
- SCM: **Git**
- Repository URL: `https://github.com/LandmakTechnology/landmark_nodejsApp.git`
- Credentials: Select `github-credentials`
- Branch Specifier: `*/main` (or `**` for all branches)
- Script Path: `Jenkinsfile`

### Step 3: Save and Build

1. Click **Save**
2. Click **Build Now** to test
3. Watch the pipeline stages in **Stage View**

---

## Jenkinsfile Explained

### Basic Structure

```groovy
pipeline {
    agent any                    // Run on any available agent

    stages {                     // Define pipeline stages
        stage('Build') {         // Stage name
            steps {              // Commands to run
                sh 'pnpm build'
            }
        }
    }

    post {                       // Actions after pipeline
        always {
            cleanWs()            // Clean workspace
        }
    }
}
```

### Key Sections

| Section | Purpose |
|---------|---------|
| `pipeline {}` | Top-level block, wraps everything |
| `agent` | Where to run (any, docker, label) |
| `environment` | Define environment variables |
| `stages` | Container for all stages |
| `stage('Name')` | A single stage (Build, Test, Deploy) |
| `steps` | Commands within a stage |
| `when` | Conditional execution |
| `post` | Actions after pipeline (always, success, failure) |

### Current Jenkinsfile

```groovy
pipeline {
    agent any

    stages {
        stage('Build') {
            steps {
                sh '''
                    npm install -g pnpm
                    pnpm install
                    pnpm build
                '''
            }
        }

        stage('Test') {
            steps {
                sh 'pnpm test'
            }
        }

        stage('Docker Build') {
            when {
                branch 'main'
            }
            steps {
                sh 'docker build -t landmark-devops:latest .'
            }
        }
    }

    post {
        always {
            cleanWs()
        }
    }
}
```

---

## Multi-Environment Pipeline

Full Jenkinsfile with CI, staging, and production deployments:

```groovy
pipeline {
    agent any

    environment {
        DOCKERHUB_CREDS = credentials('dockerhub-credentials')
        AWS_CREDS = credentials('aws-credentials')
        AWS_REGION = 'us-east-1'
        DOCKER_IMAGE = 'chafah/nodejs-app'
    }

    stages {
        stage('Install') {
            steps {
                sh '''
                    corepack enable
                    corepack prepare pnpm@10.33.0 --activate
                    pnpm install --no-frozen-lockfile
                '''
            }
        }

        stage('Build') {
            steps {
                sh 'pnpm build'
            }
        }

        stage('Test') {
            steps {
                sh 'pnpm test'
            }
        }

        stage('Docker Build & Push') {
            steps {
                script {
                    def branch = env.BRANCH_NAME.replaceAll('/', '-')
                    def date = sh(script: "date +'%Y-%m-%d-%H%M%S'", returnStdout: true).trim()

                    if (env.BRANCH_NAME == 'main' || env.BRANCH_NAME.startsWith('hotfix/')) {
                        env.IMAGE_TAG = "${branch}-${date}-prod"
                        env.DEPLOY_ENV = 'prod'
                    } else if (env.BRANCH_NAME.startsWith('release/')) {
                        env.IMAGE_TAG = "${branch}-${date}-staging"
                        env.DEPLOY_ENV = 'staging'
                    } else {
                        env.IMAGE_TAG = "${branch}-dev"
                        env.DEPLOY_ENV = 'dev'
                    }
                }
                sh '''
                    echo "$DOCKERHUB_CREDS_PSW" | docker login -u "$DOCKERHUB_CREDS_USR" --password-stdin
                    docker build -t $DOCKER_IMAGE:$IMAGE_TAG .
                    docker push $DOCKER_IMAGE:$IMAGE_TAG
                '''
            }
        }

        stage('Deploy to Staging') {
            when {
                branch pattern: 'release/.*', comparator: 'REGEXP'
            }
            steps {
                sh '''
                    aws configure set aws_access_key_id $AWS_CREDS_USR
                    aws configure set aws_secret_access_key $AWS_CREDS_PSW
                    aws configure set region $AWS_REGION
                    aws eks update-kubeconfig --name landmark-eks-stg --region $AWS_REGION
                    sed -i "s|image:.*|image: $DOCKER_IMAGE:$IMAGE_TAG|" k8s/05-service/deployment-service.yaml
                    kubectl apply -f k8s/05-service/deployment-service.yaml
                '''
            }
        }

        stage('Deploy to Production') {
            when {
                anyOf {
                    branch 'main'
                    branch pattern: 'hotfix/.*', comparator: 'REGEXP'
                }
            }
            steps {
                sh '''
                    aws configure set aws_access_key_id $AWS_CREDS_USR
                    aws configure set aws_secret_access_key $AWS_CREDS_PSW
                    aws configure set region $AWS_REGION
                    aws eks update-kubeconfig --name landmark-eks --region $AWS_REGION
                    sed -i "s|image:.*|image: $DOCKER_IMAGE:$IMAGE_TAG|" k8s/05-service/deployment-service.yaml
                    kubectl apply -f k8s/05-service/deployment-service.yaml
                '''
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            echo "Pipeline completed successfully! Image: ${env.DOCKER_IMAGE}:${env.IMAGE_TAG}"
        }
        failure {
            echo 'Pipeline failed! Check the logs above.'
        }
    }
}
```

### Branch Strategy

| Branch | Docker Tag | Deploys To |
|--------|-----------|------------|
| `feature/*`, `develop`, `bugfix/*` | `<branch>-dev` | No deployment |
| `release/*` | `<branch>-<date>-staging` | `landmark-eks-stg` |
| `main`, `hotfix/*` | `<branch>-<date>-prod` | `landmark-eks` |

---

## Deploy to EKS from Jenkins

### Prerequisites on Jenkins Server

```bash
# Verify tools are installed
aws --version
kubectl version --client
docker --version
```

### Configure AWS on Jenkins Server

```bash
# As jenkins user
sudo su - jenkins
aws configure
# Enter: Access Key, Secret Key, Region (us-east-1), Output (json)
```

### Test EKS Connectivity

```bash
sudo su - jenkins
aws eks update-kubeconfig --name landmark-eks --region us-east-1
kubectl get nodes
```

If you see your nodes listed, Jenkins can deploy to EKS.

---

## Webhook Configuration

### GitHub → Jenkins Webhook

1. **GitHub**: Repo → Settings → Webhooks → Add webhook
2. **Payload URL**: `http://<JENKINS_IP>:8080/github-webhook/`
3. **Content type**: `application/json`
4. **Secret**: (optional, for security)
5. **Events**: Push events
6. **Active**: ✓

### Verify Webhook

After pushing code:
1. Go to GitHub → Webhooks → Recent Deliveries
2. You should see a `200` response
3. Jenkins should trigger a build

### If Webhook Fails

Common issues:
- Jenkins not reachable from internet (check Security Group port 8080)
- URL typo (must end with `/github-webhook/`)
- Jenkins GitHub plugin not installed
- CSRF protection blocking (Manage Jenkins → Security → uncheck "Prevent Cross Site Request Forgery")

---

## Troubleshooting

### Jenkins Won't Start

```bash
sudo systemctl status jenkins
sudo journalctl -u jenkins -f

# Check Java
java -version

# Check port conflict
sudo netstat -tlnp | grep 8080
```

### Permission Denied on Docker

```bash
# Add jenkins to docker group
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins

# Verify
sudo su - jenkins -s /bin/bash
docker ps
```

### pnpm Not Found in Pipeline

Add to Jenkinsfile:
```groovy
stage('Install') {
    steps {
        sh '''
            export PATH=$PATH:/usr/local/bin
            npm install -g pnpm@10.33.0
            pnpm install
        '''
    }
}
```

Or install globally on the server:
```bash
sudo npm install -g pnpm@10.33.0
```

### Node.js Version Issues

```bash
# Check current version
node --version

# Install nvm for version management
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

### AWS EKS Authentication Failed

```bash
# As jenkins user
sudo su - jenkins -s /bin/bash

# Check AWS identity
aws sts get-caller-identity

# Update kubeconfig
aws eks update-kubeconfig --name landmark-eks --region us-east-1

# Test
kubectl get nodes
```

If `kubectl` returns unauthorized:
- The IAM user must be in the EKS `aws-auth` ConfigMap
- See the [CircleCI README](../.circleci/README.md#connect-circleci-to-aws) for IAM mapping steps

### Build Fails with "ERR_PNPM_IGNORED_BUILDS"

This project includes `pnpm.onlyBuiltDependencies` in `package.json` which resolves this. Ensure you're using pnpm 10.x:

```bash
pnpm --version
# Should be 10.33.0
```

### Disk Space Full

```bash
# Check disk usage
df -h

# Clean Docker
docker system prune -af

# Clean Jenkins workspace
sudo rm -rf /var/lib/jenkins/workspace/*

# Clean old builds (Manage Jenkins → Script Console):
# Jenkins.instance.getAllItems(Job).each { it.builds.findAll { it.number < it.parent.lastBuild.number - 10 }.each { it.delete() } }
```

---

## Best Practices

### Security

- Never hardcode credentials in Jenkinsfile — use `credentials()` binding
- Use GitHub PAT tokens instead of passwords
- Restrict Jenkins access with role-based security (install Role-Based Authorization Strategy plugin)
- Keep Jenkins and plugins updated
- Use HTTPS (set up Nginx reverse proxy with Let's Encrypt)

### Performance

- Use pnpm cache:
  ```groovy
  stage('Install') {
      steps {
          sh 'pnpm install --frozen-lockfile'
      }
  }
  ```
- Enable pipeline caching with `stash`/`unstash`
- Use lightweight checkout for large repos
- Set build discard policy (keep last 10 builds)

### Pipeline Design

- Use `when` blocks to skip unnecessary stages
- Use `parallel` for independent stages:
  ```groovy
  stage('Quality') {
      parallel {
          stage('Lint') { steps { sh 'pnpm lint' } }
          stage('Test') { steps { sh 'pnpm test' } }
      }
  }
  ```
- Add timeout to prevent hung builds:
  ```groovy
  options {
      timeout(time: 30, unit: 'MINUTES')
  }
  ```

### Notifications

Install the Slack Notification plugin:
```groovy
post {
    success {
        slackSend channel: '#deployments', color: 'good',
            message: "✅ ${env.JOB_NAME} #${env.BUILD_NUMBER} succeeded"
    }
    failure {
        slackSend channel: '#deployments', color: 'danger',
            message: "❌ ${env.JOB_NAME} #${env.BUILD_NUMBER} failed"
    }
}
```

### Backup Jenkins

```bash
# Backup Jenkins home directory
sudo tar -czf jenkins-backup-$(date +%Y%m%d).tar.gz /var/lib/jenkins/

# Key directories to backup:
# /var/lib/jenkins/config.xml          - Main config
# /var/lib/jenkins/credentials.xml     - Credentials
# /var/lib/jenkins/jobs/               - Job configs
# /var/lib/jenkins/plugins/            - Installed plugins
# /var/lib/jenkins/users/              - User accounts
```

---

## Quick Reference

### Useful Jenkins URLs

| URL | Purpose |
|-----|---------|
| `http://<IP>:8080/` | Dashboard |
| `http://<IP>:8080/manage` | Management |
| `http://<IP>:8080/credentials` | Credentials |
| `http://<IP>:8080/pluginManager` | Plugins |
| `http://<IP>:8080/script` | Script Console (Groovy) |
| `http://<IP>:8080/restart` | Restart Jenkins |
| `http://<IP>:8080/safeRestart` | Safe restart (finish running builds) |

### Jenkins CLI

```bash
# Download CLI
wget http://<IP>:8080/jnlpJars/jenkins-cli.jar

# List jobs
java -jar jenkins-cli.jar -s http://<IP>:8080/ -auth admin:<token> list-jobs

# Trigger build
java -jar jenkins-cli.jar -s http://<IP>:8080/ -auth admin:<token> build landmark-devops-pipeline
```

### Complete EC2 Setup Script

```bash
#!/bin/bash
# Save as setup-jenkins.sh and run: bash setup-jenkins.sh

sudo yum update -y
sudo yum install java-17-amazon-corretto git docker unzip -y
sudo wget -O /etc/yum.repos.d/jenkins.repo https://pkg.jenkins.io/redhat-stable/jenkins.repo
sudo rpm --import https://pkg.jenkins.io/redhat-stable/jenkins.io-2023.key
sudo yum install jenkins -y
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install nodejs -y
sudo npm install -g pnpm@10.33.0
sudo systemctl start docker jenkins
sudo systemctl enable docker jenkins
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && sudo mv kubectl /usr/local/bin/
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install
echo "============================================"
echo "Jenkins initial password:"
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
echo ""
echo "Access Jenkins at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8080"
echo "============================================"
```
