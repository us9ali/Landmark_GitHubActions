# CircleCI Pipeline — Landmark DevOps Demo

This document covers the complete setup of CircleCI for this project, including account creation, GitHub integration, AWS connectivity, environment variables, and pipeline architecture.

---

## Table of Contents

1. [Pipeline Overview](#pipeline-overview)
2. [Create a CircleCI Account](#create-a-circleci-account)
3. [Link Your GitHub Repository](#link-your-github-repository)
4. [Environment Variables & Secrets](#environment-variables--secrets)
5. [Connect CircleCI to AWS](#connect-circleci-to-aws)
6. [Connect CircleCI to DockerHub](#connect-circleci-to-dockerhub)
7. [Pipeline Architecture](#pipeline-architecture)
8. [Branch Strategy & Workflow Triggers](#branch-strategy--workflow-triggers)
9. [How the Pipeline Works](#how-the-pipeline-works)
10. [Orbs Used](#orbs-used)
11. [Troubleshooting](#troubleshooting)
12. [Additional Considerations](#additional-considerations)

---

## Pipeline Overview

The CircleCI pipeline mirrors the GitHub Actions setup with three workflows:

| Workflow | Trigger Branches | Environment | EKS Cluster | Docker Tag |
|----------|-----------------|-------------|-------------|------------|
| `ci-dev` | All except `main`, `release/*`, `hotfix/*` | dev | — (no deploy) | `<branch>-dev` |
| `deploy-to-staging` | `release/*` | staging | `landmark-eks-stg` | `<branch>-<date>-<time>-staging` |
| `deploy-to-prod` | `main`, `hotfix/*` | production | `landmark-eks` | `<branch>-<date>-<time>-prod` |

---

## Create a CircleCI Account

1. Go to [https://circleci.com/signup](https://circleci.com/signup)
2. Click **Sign Up with GitHub**
3. Authorize CircleCI to access your GitHub account
4. Select your GitHub organization (e.g., `LandmakTechnology`)
5. You will be redirected to the CircleCI dashboard

> **Note:** CircleCI's free tier includes 6,000 build minutes/month for Linux.

---

## Link Your GitHub Repository

### Step 1: Set Up Project

1. In the CircleCI dashboard, click **Projects** in the left sidebar
2. Find `landmark_nodejsApp` in the list
3. Click **Set Up Project**
4. Select **Fastest** → "Use the `.circleci/config.yml` in my repo"
5. Select the `main` branch
6. Click **Set Up Project**

### Step 2: Verify Detection

CircleCI will automatically detect the `.circleci/config.yml` file in your repository and begin running the pipeline on the next push.

### Step 3: GitHub Webhook (Automatic)

When you link the project, CircleCI automatically creates a webhook in your GitHub repository:
- Go to GitHub → Repository → Settings → Webhooks
- You should see a CircleCI webhook pointing to `https://circleci.com/hooks/github`

> **If the webhook is missing:** Go to CircleCI → Project Settings → Advanced → click "Re-add webhook"

---

## Environment Variables & Secrets

### Where to Set Them

1. Go to CircleCI Dashboard
2. Click on your project (`landmark_nodejsApp`)
3. Click the **gear icon** (Project Settings)
4. Click **Environment Variables** in the left sidebar
5. Click **Add Environment Variable** for each one

### Required Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `DOCKERHUB_USERNAME` | `chafah` | DockerHub login |
| `DOCKERHUB_PASSWORD` | Your DockerHub password or access token | DockerHub authentication |
| `AWS_ACCESS_KEY_ID` | Your AWS access key | AWS authentication |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret key | AWS authentication |
| `AWS_REGION` | `us-east-1` | AWS region for EKS clusters |
| `AWS_DEFAULT_REGION` | `us-east-1` | Required by aws-cli orb |

### How to Add Each Variable

1. Click **Add Environment Variable**
2. Enter the **Name** (e.g., `DOCKERHUB_USERNAME`)
3. Enter the **Value** (e.g., `chafah`)
4. Click **Add Environment Variable**
5. Repeat for all variables

> **Security:** CircleCI masks environment variables in build logs. Values are encrypted at rest and never exposed in the UI after creation.

---

## Connect CircleCI to AWS

### Step 1: Create an IAM User

```bash
aws iam create-user --user-name circleci-deployer
```

### Step 2: Attach Required Policies

```bash
# EKS access
aws iam attach-user-policy \
  --user-name circleci-deployer \
  --policy-arn arn:aws:iam::aws:policy/AmazonEKSClusterPolicy

# Describe clusters
aws iam put-user-policy \
  --user-name circleci-deployer \
  --policy-name EKSAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "eks:DescribeCluster",
          "eks:ListClusters"
        ],
        "Resource": "*"
      }
    ]
  }'
```

### Step 3: Generate Access Keys

```bash
aws iam create-access-key --user-name circleci-deployer
```

Save the `AccessKeyId` and `SecretAccessKey` — add them as CircleCI environment variables.

### Step 4: Map IAM User to EKS Cluster

The IAM user must be authorized in the EKS cluster's `aws-auth` ConfigMap:

```bash
# For production cluster
aws eks update-kubeconfig --name landmark-eks --region us-east-1

kubectl edit configmap aws-auth -n kube-system
```

Add under `mapUsers`:

```yaml
mapUsers: |
  - userarn: arn:aws:iam::<ACCOUNT_ID>:user/circleci-deployer
    username: circleci-deployer
    groups:
      - system:masters
```

Repeat for the staging cluster (`landmark-eks-stg`).

> **Alternative:** Use EKS Access Entries (newer method):
> ```bash
> aws eks create-access-entry \
>   --cluster-name landmark-eks \
>   --principal-arn arn:aws:iam::<ACCOUNT_ID>:user/circleci-deployer \
>   --type STANDARD
>
> aws eks associate-access-policy \
>   --cluster-name landmark-eks \
>   --principal-arn arn:aws:iam::<ACCOUNT_ID>:user/circleci-deployer \
>   --policy-arn arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy \
>   --access-scope type=cluster
> ```

---

## Connect CircleCI to DockerHub

### Option A: Password (Simple)

Set `DOCKERHUB_PASSWORD` to your DockerHub account password.

### Option B: Access Token (Recommended)

1. Go to [https://hub.docker.com/settings/security](https://hub.docker.com/settings/security)
2. Click **New Access Token**
3. Name: `circleci-landmark`
4. Permissions: **Read & Write**
5. Click **Generate**
6. Copy the token
7. Set `DOCKERHUB_PASSWORD` in CircleCI to this token

> **Why tokens?** They can be revoked individually, don't expose your main password, and can have limited permissions.

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CI-DEV WORKFLOW                           │
│  Trigger: feature/*, develop, bugfix/* (all except main/release)│
│                                                                 │
│  ┌──────────────┐     ┌──────────────────┐                     │
│  │ build-and-   │────▶│ docker-build-dev │                     │
│  │ test         │     │ (push dev tag)   │                     │
│  └──────────────┘     └──────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   DEPLOY-TO-STAGING WORKFLOW                     │
│  Trigger: release/*                                             │
│                                                                 │
│  ┌──────────────┐     ┌────────────────────┐     ┌───────────┐ │
│  │ build-and-   │────▶│ docker-build-      │────▶│ deploy-   │ │
│  │ test         │     │ staging            │     │ staging   │ │
│  └──────────────┘     └────────────────────┘     └───────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    DEPLOY-TO-PROD WORKFLOW                       │
│  Trigger: main, hotfix/*                                        │
│                                                                 │
│  ┌──────────────┐     ┌────────────────────┐     ┌───────────┐ │
│  │ build-and-   │────▶│ docker-build-      │────▶│ deploy-   │ │
│  │ test         │     │ prod               │     │ prod      │ │
│  └──────────────┘     └────────────────────┘     └───────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Branch Strategy & Workflow Triggers

| Branch Pattern | Workflow | What Happens |
|---------------|----------|--------------|
| `feature/*`, `develop`, `bugfix/*` | `ci-dev` | Build, test, push Docker image tagged `dev` |
| `release/1.0`, `release/2.0` | `deploy-to-staging` | Build, test, push staging image, deploy to `landmark-eks-stg` |
| `main` | `deploy-to-prod` | Build, test, push prod image, deploy to `landmark-eks` |
| `hotfix/critical-fix` | `deploy-to-prod` | Build, test, push prod image, deploy to `landmark-eks` |

### Typical Git Flow

```
feature/new-feature  →  develop  →  release/1.0  →  main
                                                       ↑
                                          hotfix/fix  ─┘
```

---

## How the Pipeline Works

### 1. Build & Test Job

- Checks out code
- Installs pnpm 10.33.0 via corepack
- Restores dependency cache (based on `pnpm-lock.yaml` hash)
- Installs dependencies
- Builds the application (Vite frontend + esbuild backend)
- Runs all tests (Vitest — 59 test cases)

### 2. Docker Build Job

- Checks out code
- Sets up remote Docker engine
- Logs into DockerHub
- Builds the Docker image with appropriate `NODE_ENV` build arg
- Tags with branch-date-time-environment format
- Pushes to DockerHub (`chafah/nodejs-app`)

### 3. Deploy Job (Staging/Prod)

- Installs AWS CLI and kubectl
- Configures kubectl to connect to the appropriate EKS cluster
- Uses `sed` to update the image tag in `k8s/05-service/deployment-service.yaml`
- Applies the Kubernetes manifest (`kubectl apply`)

---

## Orbs Used

| Orb | Version | Purpose |
|-----|---------|---------|
| `circleci/aws-cli` | 4.1 | Install and configure AWS CLI |
| `circleci/aws-eks` | 2.2 | EKS-specific helpers |
| `circleci/kubernetes` | 1.3 | Install kubectl |

> **What are Orbs?** Reusable packages of CircleCI configuration (like GitHub Actions marketplace actions). They simplify common tasks.

---

## Troubleshooting

### Pipeline Not Triggering

- Verify the webhook exists: GitHub → Repo → Settings → Webhooks
- Check CircleCI project is following the correct branch
- Ensure `.circleci/config.yml` is on the branch you're pushing to

### Docker Build Fails

```
error: Cannot connect to the Docker daemon
```
- Ensure `setup_remote_docker` step is present before any `docker` commands

### AWS/EKS Connection Fails

```
error: You must be logged in to the server (Unauthorized)
```
- Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set in CircleCI
- Verify the IAM user is mapped in the EKS `aws-auth` ConfigMap
- Check the cluster name matches (`landmark-eks` or `landmark-eks-stg`)

### pnpm Install Fails

```
ERR_PNPM_IGNORED_BUILDS
```
- The `package.json` has `"pnpm": { "onlyBuiltDependencies": ["esbuild"] }` which resolves this
- Ensure `pnpm-lock.yaml` is committed to the repo

### Cache Issues

If dependencies seem stale:
- Go to CircleCI → Project → Project Settings → Clear Cache
- Or change the cache key prefix in the config

### Branch Filter Not Working

CircleCI uses regex for branch filters:
- `main` → exact match
- `/^release\/.*/` → matches `release/1.0`, `release/v2`, etc.
- `/^hotfix\/.*/` → matches `hotfix/fix-login`, etc.

---

## Additional Considerations

### Security Best Practices

- **Never** hardcode credentials in `config.yml`
- Use CircleCI **Contexts** for shared secrets across projects:
  1. Go to Organization Settings → Contexts
  2. Create a context (e.g., `aws-production`)
  3. Add environment variables to the context
  4. Reference in workflow: `context: aws-production`
- Rotate AWS access keys every 90 days
- Use DockerHub access tokens instead of passwords
- Restrict IAM permissions to minimum required

### Contexts (Shared Secrets)

For multi-project setups, use CircleCI Contexts:

```yaml
workflows:
  deploy-to-prod:
    jobs:
      - deploy-prod:
          context:
            - aws-credentials
            - dockerhub-credentials
```

### Approval Gates (Manual Approval)

Add a manual approval step before production deployment:

```yaml
workflows:
  deploy-to-prod:
    jobs:
      - build-and-test
      - docker-build-prod:
          requires: [build-and-test]
      - hold-for-approval:
          type: approval
          requires: [docker-build-prod]
      - deploy-prod:
          requires: [hold-for-approval]
```

### Notifications

Configure Slack/email notifications:

1. Go to Project Settings → Notifications
2. Add Slack webhook or email addresses
3. Choose which events trigger notifications (success, failure, etc.)

### Resource Classes

For faster builds, upgrade the resource class:

```yaml
jobs:
  build-and-test:
    executor: node
    resource_class: large  # 4 vCPU, 8GB RAM (requires paid plan)
```

### Parallelism (Faster Tests)

Split tests across multiple containers:

```yaml
jobs:
  build-and-test:
    parallelism: 3
    steps:
      - run:
          command: |
            TESTS=$(circleci tests glob "server/**/*.test.ts" | circleci tests split)
            pnpm vitest run $TESTS
```

### Caching Strategy

The pipeline caches `node_modules` based on `pnpm-lock.yaml` hash. If the lockfile changes, a fresh install runs. This significantly speeds up subsequent builds.

### Docker Layer Caching (DLC)

Enable DLC for faster Docker builds (requires paid plan):

```yaml
jobs:
  docker-build-prod:
    steps:
      - setup_remote_docker:
          docker_layer_caching: true
```

### Scheduled Pipelines

Run nightly builds or periodic security scans:

1. Go to Project Settings → Triggers
2. Click **Add Trigger**
3. Set schedule (e.g., daily at midnight)
4. Select branch and pipeline parameters

### Comparing CircleCI vs GitHub Actions

| Feature | CircleCI | GitHub Actions |
|---------|----------|----------------|
| Config location | `.circleci/config.yml` | `.github/workflows/*.yml` |
| Reusable packages | Orbs | Actions (Marketplace) |
| Branch filters | In workflow section | In `on:` trigger |
| Secrets | Project env vars / Contexts | Repository secrets |
| Caching | `save_cache` / `restore_cache` | `actions/cache` |
| Docker builds | `setup_remote_docker` | `docker/build-push-action` |
| Manual approval | `type: approval` | `environment: production` with protection rules |
| Free tier | 6,000 min/month | 2,000 min/month |

---

## Quick Reference Commands

```bash
# Validate config locally
circleci config validate

# Run a job locally (requires CircleCI CLI)
circleci local execute --job build-and-test

# Install CircleCI CLI
curl -fLSs https://raw.githubusercontent.com/CircleCI-Public/circleci-cli/master/install.sh | bash

# Trigger pipeline via API
curl -X POST https://circleci.com/api/v2/project/github/LandmakTechnology/landmark_nodejsApp/pipeline \
  -H "Circle-Token: <YOUR_PERSONAL_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"branch": "main"}'
```
