# CircleCI - Comprehensive Lecture Notes

## Table of Contents
1. [What is CI/CD?](#what-is-cicd)
2. [What is CircleCI?](#what-is-circleci)
3. [CircleCI vs Other CI/CD Tools](#circleci-vs-other-cicd-tools)
4. [Creating a CircleCI Account](#creating-a-circleci-account)
5. [Connecting Your Repository](#connecting-your-repository)
6. [CircleCI Configuration File Structure](#circleci-configuration-file-structure)
7. [Writing a config.yml Step by Step](#writing-a-configyml-step-by-step)
8. [CircleCI Concepts Deep Dive](#circleci-concepts-deep-dive)
9. [Environment Variables and Secrets](#environment-variables-and-secrets)
10. [Docker Integration](#docker-integration)
11. [Deploying to AWS EKS](#deploying-to-aws-eks)
12. [Orbs (Reusable Packages)](#orbs-reusable-packages)
13. [Caching and Optimization](#caching-and-optimization)
14. [CircleCI Settings and Configuration](#circleci-settings-and-configuration)
15. [Real-World Pipeline Example](#real-world-pipeline-example)
16. [Troubleshooting Common Issues](#troubleshooting-common-issues)

---

## What is CI/CD?

### Continuous Integration (CI)
CI is the practice of automatically building and testing code every time a developer pushes changes to a shared repository. The goal is to detect bugs early and improve software quality.

**CI involves:**
- Developers push code to a shared repository (GitHub, Bitbucket, GitLab)
- An automated system detects the change
- The system builds the application
- Automated tests run against the build
- Developers get immediate feedback (pass/fail)

### Continuous Delivery (CD)
CD extends CI by automatically deploying all code changes to a staging or production environment after the build and test stages pass.

**CD involves:**
- Code that passes CI is automatically packaged (e.g., Docker image)
- The package is deployed to staging/production
- Deployment can be automatic or require manual approval

### Why CI/CD?
- **Faster feedback**: Know within minutes if your code breaks something
- **Reduced risk**: Small, frequent deployments are less risky than big releases
- **Consistency**: Same process every time, no human error
- **Developer productivity**: Automate repetitive tasks

---

## What is CircleCI?

CircleCI is a cloud-based CI/CD platform that automates the build, test, and deployment process. It integrates with GitHub, Bitbucket, and GitLab.

**Key Features:**
- Cloud-hosted (no server to manage) or self-hosted option
- Docker-native (runs jobs in Docker containers)
- Parallelism (run tests in parallel to speed up pipelines)
- Orbs (reusable configuration packages)
- Caching (speed up builds by caching dependencies)
- Workflows (orchestrate multiple jobs with dependencies)

---

## CircleCI vs Other CI/CD Tools

| Feature | CircleCI | Jenkins | GitHub Actions |
|---------|----------|---------|----------------|
| Hosting | Cloud/Self-hosted | Self-hosted | Cloud |
| Config File | `.circleci/config.yml` | `Jenkinsfile` | `.github/workflows/*.yml` |
| Docker Support | Native | Plugin | Native |
| Free Tier | 6,000 min/month | Free (self-hosted) | 2,000 min/month |
| Learning Curve | Medium | High | Low |
| Orbs/Marketplace | Yes (Orbs) | Yes (Plugins) | Yes (Actions) |

---

## Creating a CircleCI Account

### Step 1: Sign Up
1. Go to [https://circleci.com](https://circleci.com)
2. Click **"Sign Up"**
3. Choose **"Sign Up with GitHub"** (recommended) or Bitbucket/GitLab
4. Authorize CircleCI to access your repositories

### Step 2: Select an Organization
1. After login, select your GitHub organization or personal account
2. CircleCI will list all your repositories

### Step 3: Set Up a Project
1. Find your repository in the list (e.g., `landmark_nodejsApp`)
2. Click **"Set Up Project"**
3. CircleCI will look for a `.circleci/config.yml` file in your repo
4. If it exists, it will start running the pipeline
5. If not, CircleCI offers a template to get started

### Step 4: First Pipeline Run
- Once the config file is detected, CircleCI triggers the first build
- You can see the pipeline status in the CircleCI dashboard
- Green = passed, Red = failed

---

## Connecting Your Repository

### GitHub Integration
1. In CircleCI dashboard, go to **Projects**
2. Click **"Set Up Project"** next to your repo
3. CircleCI automatically sets up a webhook on your GitHub repo
4. Every push/PR will now trigger the pipeline

### Webhook (Automatic)
CircleCI creates a webhook in your GitHub repo settings:
- `Settings → Webhooks → CircleCI webhook`
- This sends events (push, PR) to CircleCI to trigger builds

### Deploy Keys
CircleCI adds a deploy key to your repo for read access:
- `Settings → Deploy Keys → CircleCI deploy key`
- This allows CircleCI to checkout your code

---

## CircleCI Configuration File Structure

The configuration lives in `.circleci/config.yml` at the root of your repository.

### Basic Structure:
```yaml
version: 2.1          # CircleCI config version

orbs:                  # Reusable packages (optional)
  node: circleci/node@5.0

jobs:                  # Define individual jobs
  build:
    docker:            # Execution environment
      - image: cimg/node:22.0
    steps:             # Steps to execute
      - checkout
      - run: npm install
      - run: npm test

workflows:             # Orchestrate jobs
  my-pipeline:
    jobs:
      - build
```

### Key Sections Explained:

| Section | Purpose |
|---------|---------|
| `version` | Config file version (always use 2.1) |
| `orbs` | Import reusable config packages |
| `jobs` | Define what to do (build, test, deploy) |
| `workflows` | Define when and in what order jobs run |
| `executors` | Reusable execution environments |
| `commands` | Reusable step sequences |

---

## Writing a config.yml Step by Step

### Step 1: Set the Version
```yaml
version: 2.1
```
Always use version 2.1 — it supports orbs, reusable commands, and modern features.

### Step 2: Define Jobs

A **job** is a collection of steps that run in a specific environment.

```yaml
jobs:
  build:
    docker:
      - image: cimg/node:22.0    # Primary container
    steps:
      - checkout                  # Pull code from repo
      - run: npm install -g pnpm  # Install pnpm
      - run: pnpm install         # Install dependencies
      - run: pnpm build           # Build the app
      - run: pnpm test            # Run tests
```

**Explanation:**
- `docker` → Specifies the Docker image to run the job in
- `cimg/node:22.0` → CircleCI's convenience image with Node.js 22
- `checkout` → Built-in step that clones your repository
- `run` → Execute a shell command

### Step 3: Define Multiple Jobs

```yaml
jobs:
  build:
    docker:
      - image: cimg/node:22.0
    steps:
      - checkout
      - run: npm install -g pnpm
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test

  docker-build:
    docker:
      - image: cimg/base:2024.01
    steps:
      - checkout
      - setup_remote_docker        # Enable Docker commands
      - run: docker build -t landmark-devops:latest .
```

**Key Points:**
- `setup_remote_docker` → Required to run Docker commands inside CircleCI
- Each job runs in its own fresh environment (no shared state)

### Step 4: Define Workflows

A **workflow** orchestrates the order and conditions for running jobs.

```yaml
workflows:
  ci-cd:
    jobs:
      - build
      - docker-build:
          requires:
            - build              # Only run after build passes
          filters:
            branches:
              only: main         # Only on main branch
```

**Explanation:**
- `requires` → This job depends on another job completing successfully
- `filters` → Control which branches/tags trigger this job
- `only: main` → Only run on the main branch

### Step 5: Complete config.yml for This Project

```yaml
version: 2.1

jobs:
  build:
    docker:
      - image: cimg/node:22.0
    steps:
      - checkout
      - run: npm install -g pnpm
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test

  docker-build:
    docker:
      - image: cimg/base:2024.01
    steps:
      - checkout
      - setup_remote_docker
      - run: docker build -t landmark-devops:latest .

workflows:
  ci-cd:
    jobs:
      - build
      - docker-build:
          requires:
            - build
          filters:
            branches:
              only: main
```

---

## CircleCI Concepts Deep Dive

### Executors (Execution Environments)

CircleCI supports multiple executor types:

#### 1. Docker Executor (Most Common)
```yaml
jobs:
  build:
    docker:
      - image: cimg/node:22.0       # Primary container
      - image: cimg/mysql:8.0       # Secondary (service) container
        environment:
          MYSQL_ROOT_PASSWORD: test
```
- Fastest startup
- Best for most applications
- Can run multiple containers (app + database)

#### 2. Machine Executor
```yaml
jobs:
  build:
    machine:
      image: ubuntu-2204:current
```
- Full VM (Linux/Windows/macOS)
- Use when you need full OS access
- Docker is pre-installed (no need for `setup_remote_docker`)

#### 3. macOS Executor
```yaml
jobs:
  build:
    macos:
      xcode: "15.0"
```
- For iOS/macOS builds

### Steps

Common built-in steps:

| Step | Purpose |
|------|---------|
| `checkout` | Clone the repository |
| `run` | Execute a shell command |
| `setup_remote_docker` | Enable Docker-in-Docker |
| `save_cache` | Save files for future builds |
| `restore_cache` | Restore previously cached files |
| `store_artifacts` | Save build artifacts |
| `store_test_results` | Upload test results for dashboard |
| `persist_to_workspace` | Share files between jobs |
| `attach_workspace` | Retrieve files from another job |

### Workspace (Sharing Data Between Jobs)

```yaml
jobs:
  build:
    docker:
      - image: cimg/node:22.0
    steps:
      - checkout
      - run: pnpm install && pnpm build
      - persist_to_workspace:
          root: .
          paths:
            - dist/
            - node_modules/

  deploy:
    docker:
      - image: cimg/node:22.0
    steps:
      - attach_workspace:
          at: .
      - run: echo "Deploy the dist/ folder"
```

---

## Environment Variables and Secrets

### Setting Environment Variables in CircleCI Dashboard

1. Go to **Project Settings** → **Environment Variables**
2. Click **"Add Environment Variable"**
3. Enter the name and value

**Common variables to set:**
| Variable | Purpose |
|----------|---------|
| `AWS_ACCESS_KEY_ID` | AWS authentication |
| `AWS_SECRET_ACCESS_KEY` | AWS authentication |
| `AWS_DEFAULT_REGION` | AWS region (e.g., us-east-1) |
| `DOCKER_USERNAME` | Docker Hub login |
| `DOCKER_PASSWORD` | Docker Hub password |
| `AWS_ACCOUNT_ID` | For ECR image push |

### Using Environment Variables in config.yml

```yaml
jobs:
  deploy:
    docker:
      - image: cimg/base:2024.01
    environment:
      APP_ENV: production          # Job-level env var
    steps:
      - run:
          name: Deploy to AWS
          command: |
            echo "Deploying to region: $AWS_DEFAULT_REGION"
            echo "Account: $AWS_ACCOUNT_ID"
```

### Contexts (Shared Environment Variables)

Contexts let you share env vars across multiple projects:

1. Go to **Organization Settings** → **Contexts**
2. Create a context (e.g., `aws-credentials`)
3. Add variables to the context
4. Reference in workflow:

```yaml
workflows:
  ci-cd:
    jobs:
      - deploy:
          context: aws-credentials
```

---

## Docker Integration

### Building and Pushing Docker Images

```yaml
jobs:
  docker-build-push:
    docker:
      - image: cimg/base:2024.01
    steps:
      - checkout
      - setup_remote_docker:
          version: "20.10.24"
      - run:
          name: Build Docker Image
          command: |
            docker build -t landmark-devops:$CIRCLE_SHA1 .
            docker tag landmark-devops:$CIRCLE_SHA1 landmark-devops:latest
      - run:
          name: Push to Docker Hub
          command: |
            echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin
            docker push $DOCKER_USERNAME/landmark-devops:$CIRCLE_SHA1
            docker push $DOCKER_USERNAME/landmark-devops:latest
```

### Pushing to AWS ECR (Elastic Container Registry)

```yaml
jobs:
  push-to-ecr:
    docker:
      - image: cimg/aws:2024.03
    steps:
      - checkout
      - setup_remote_docker
      - run:
          name: Build and Push to ECR
          command: |
            # Login to ECR
            aws ecr get-login-password --region us-east-1 | \
              docker login --username AWS --password-stdin \
              $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

            # Build
            docker build -t landmark-devops .

            # Tag
            docker tag landmark-devops:latest \
              $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/landmark-devops:$CIRCLE_SHA1

            # Push
            docker push \
              $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/landmark-devops:$CIRCLE_SHA1
```

---

## Deploying to AWS EKS

### Full Deployment Job

```yaml
jobs:
  deploy-to-eks:
    docker:
      - image: cimg/aws:2024.03
    steps:
      - checkout
      - run:
          name: Install kubectl
          command: |
            curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
            chmod +x kubectl
            sudo mv kubectl /usr/local/bin/
      - run:
          name: Configure kubectl
          command: |
            aws eks update-kubeconfig --region us-east-1 --name landmark-eks
      - run:
          name: Deploy to Kubernetes
          command: |
            # Update image tag in deployment
            kubectl set image deployment/landmark-app \
              app=$AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/landmark-devops:$CIRCLE_SHA1 \
              -n landmark-devops

            # Wait for rollout
            kubectl rollout status deployment/landmark-app -n landmark-devops
```

---

## Orbs (Reusable Packages)

Orbs are reusable packages of CircleCI configuration. They simplify complex setups.

### Using Orbs

```yaml
version: 2.1

orbs:
  node: circleci/node@5.2        # Node.js orb
  docker: circleci/docker@2.4    # Docker orb
  aws-eks: circleci/aws-eks@2.2  # AWS EKS orb
  aws-ecr: circleci/aws-ecr@9.0  # AWS ECR orb

jobs:
  build:
    executor: node/default
    steps:
      - checkout
      - node/install-packages:
          pkg-manager: pnpm
      - run: pnpm build
      - run: pnpm test

workflows:
  ci-cd:
    jobs:
      - build
      - aws-ecr/build-and-push-image:
          requires:
            - build
          repo: landmark-devops
          tag: $CIRCLE_SHA1
      - aws-eks/update-container-image:
          requires:
            - aws-ecr/build-and-push-image
          cluster-name: landmark-eks
          container-image-updates: "app=$AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/landmark-devops:$CIRCLE_SHA1"
          resource-name: deployment/landmark-app
```

### Popular Orbs

| Orb | Purpose |
|-----|---------|
| `circleci/node` | Node.js setup and caching |
| `circleci/docker` | Docker build and push |
| `circleci/aws-ecr` | Push images to ECR |
| `circleci/aws-eks` | Deploy to EKS |
| `circleci/aws-cli` | AWS CLI commands |
| `circleci/slack` | Send Slack notifications |
| `circleci/kubernetes` | kubectl commands |

---

## Caching and Optimization

### Caching Dependencies

```yaml
jobs:
  build:
    docker:
      - image: cimg/node:22.0
    steps:
      - checkout
      - restore_cache:
          keys:
            - pnpm-deps-{{ checksum "pnpm-lock.yaml" }}
            - pnpm-deps-
      - run: npm install -g pnpm && pnpm install
      - save_cache:
          key: pnpm-deps-{{ checksum "pnpm-lock.yaml" }}
          paths:
            - node_modules/
            - ~/.pnpm-store
      - run: pnpm build
      - run: pnpm test
```

**How caching works:**
1. `restore_cache` → Looks for a cache matching the key
2. If found, restores the cached files (skips install)
3. If not found, runs install normally
4. `save_cache` → Saves the files for next time

### Parallelism (Run Tests Faster)

```yaml
jobs:
  test:
    docker:
      - image: cimg/node:22.0
    parallelism: 4    # Split tests across 4 containers
    steps:
      - checkout
      - run: |
          TEST_FILES=$(circleci tests glob "**/*.test.ts" | circleci tests split)
          pnpm vitest run $TEST_FILES
```

---

## CircleCI Settings and Configuration

### Project Settings (Dashboard)

Navigate to **Project Settings** in the CircleCI dashboard:

#### 1. Environment Variables
- Store secrets (AWS keys, Docker credentials)
- Never hardcode secrets in config.yml

#### 2. SSH Keys
- Add deploy keys for private repos
- Add user keys for write access

#### 3. Advanced Settings
- **Auto-cancel redundant builds**: Cancel older builds when new commits arrive
- **Build forked pull requests**: Allow PRs from forks to trigger builds
- **Only build pull requests**: Don't build every branch push

#### 4. API Permissions
- Generate API tokens for programmatic access
- Useful for triggering builds from external systems

### Organization Settings

#### 1. Security
- Enable/disable orb usage
- Restrict which orbs can be used

#### 2. Contexts
- Create shared environment variable groups
- Restrict context access to specific teams

#### 3. Self-Hosted Runners
- Run jobs on your own infrastructure
- Useful for compliance or performance requirements

### Branch Protection

```yaml
workflows:
  ci-cd:
    jobs:
      - build:
          filters:
            branches:
              only:
                - main
                - develop
              ignore:
                - /feature\/.*/    # Ignore feature branches
```

### Scheduled Pipelines (Cron Jobs)

Set up in **Project Settings → Triggers**:
- Name: `nightly-build`
- Schedule: `0 0 * * *` (midnight daily)
- Branch: `main`
- Parameters: (optional)

Or in config:
```yaml
workflows:
  nightly:
    triggers:
      - schedule:
          cron: "0 0 * * *"
          filters:
            branches:
              only: main
    jobs:
      - build
      - deploy
```

---

## Real-World Pipeline Example

Complete CI/CD pipeline for this Node.js app deploying to AWS EKS:

```yaml
version: 2.1

orbs:
  aws-cli: circleci/aws-cli@4.0
  node: circleci/node@5.2

jobs:
  # Job 1: Build and Test
  build-and-test:
    docker:
      - image: cimg/node:22.0
    steps:
      - checkout
      - restore_cache:
          keys:
            - deps-{{ checksum "pnpm-lock.yaml" }}
      - run: npm install -g pnpm
      - run: pnpm install
      - save_cache:
          key: deps-{{ checksum "pnpm-lock.yaml" }}
          paths:
            - node_modules/
      - run: pnpm build
      - run: pnpm test
      - persist_to_workspace:
          root: .
          paths:
            - dist/

  # Job 2: Build and Push Docker Image to ECR
  docker-push:
    docker:
      - image: cimg/aws:2024.03
    steps:
      - checkout
      - attach_workspace:
          at: .
      - setup_remote_docker
      - run:
          name: Build and Push to ECR
          command: |
            aws ecr get-login-password --region $AWS_DEFAULT_REGION | \
              docker login --username AWS --password-stdin \
              $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com

            docker build -t landmark-devops:$CIRCLE_SHA1 .

            docker tag landmark-devops:$CIRCLE_SHA1 \
              $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/landmark-devops:$CIRCLE_SHA1

            docker tag landmark-devops:$CIRCLE_SHA1 \
              $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/landmark-devops:latest

            docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/landmark-devops:$CIRCLE_SHA1
            docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/landmark-devops:latest

  # Job 3: Deploy to EKS
  deploy:
    docker:
      - image: cimg/aws:2024.03
    steps:
      - checkout
      - run:
          name: Install kubectl
          command: |
            curl -LO "https://dl.k8s.io/release/v1.28.0/bin/linux/amd64/kubectl"
            chmod +x kubectl && sudo mv kubectl /usr/local/bin/
      - run:
          name: Deploy to EKS
          command: |
            aws eks update-kubeconfig --region $AWS_DEFAULT_REGION --name landmark-eks

            kubectl set image deployment/landmark-app \
              app=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/landmark-devops:$CIRCLE_SHA1 \
              -n landmark-devops

            kubectl rollout status deployment/landmark-app -n landmark-devops --timeout=300s

workflows:
  ci-cd-pipeline:
    jobs:
      - build-and-test
      - docker-push:
          requires:
            - build-and-test
          filters:
            branches:
              only: main
          context: aws-credentials
      - deploy:
          requires:
            - docker-push
          filters:
            branches:
              only: main
          context: aws-credentials
```

---

## Troubleshooting Common Issues

### 1. "No configuration was found"
- Ensure file is at `.circleci/config.yml` (exact path)
- Check YAML indentation (use spaces, not tabs)

### 2. "Docker: command not found"
- Add `setup_remote_docker` step before Docker commands

### 3. "Permission denied" on AWS
- Check environment variables are set in Project Settings
- Verify IAM role has correct permissions

### 4. "Out of memory" during build
- Use a larger resource class:
```yaml
jobs:
  build:
    docker:
      - image: cimg/node:22.0
    resource_class: large    # 4 vCPU, 8GB RAM
```

### 5. Build is slow
- Add caching for dependencies
- Use parallelism for tests
- Enable "Auto-cancel redundant builds"

### 6. "Cannot connect to Docker daemon"
- Ensure `setup_remote_docker` is before any `docker` commands
- Use `version` parameter if needed:
```yaml
- setup_remote_docker:
    version: "20.10.24"
```

---

## CircleCI Built-in Environment Variables

| Variable | Description |
|----------|-------------|
| `CIRCLE_SHA1` | Current commit SHA |
| `CIRCLE_BRANCH` | Current branch name |
| `CIRCLE_BUILD_NUM` | Build number |
| `CIRCLE_PROJECT_REPONAME` | Repository name |
| `CIRCLE_PR_NUMBER` | Pull request number |
| `CIRCLE_USERNAME` | GitHub username who triggered |
| `CIRCLE_WORKFLOW_ID` | Current workflow ID |

---

## Summary

### Steps to Set Up CircleCI for Any Project:
1. Create a CircleCI account (sign up with GitHub)
2. Connect your repository
3. Create `.circleci/config.yml` in your repo
4. Define jobs (build, test, deploy)
5. Define workflows (order and conditions)
6. Set environment variables in Project Settings
7. Push to trigger the pipeline
8. Monitor in the CircleCI dashboard

### Best Practices:
- Always cache dependencies
- Use orbs to simplify configuration
- Keep secrets in environment variables, never in code
- Use contexts for shared credentials
- Enable auto-cancel for redundant builds
- Use `requires` to create job dependencies
- Filter deployments to specific branches only
