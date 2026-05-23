# ServiceAccount & RBAC

## Definitions

| Term | What It Is | Analogy |
|------|-----------|---------|
| **ServiceAccount (SA)** | An identity assigned to a pod | An employee badge |
| **Role** | A set of permissions (verbs on resources) | A job description |
| **RoleBinding** | Links a Role to a ServiceAccount | Assigning the job to the employee |
| **ClusterRole** | Like Role but works across ALL namespaces | A company-wide access pass |
| **ClusterRoleBinding** | Links a ClusterRole to a SA | Giving someone company-wide access |
| **IRSA** | IAM Roles for Service Accounts (AWS-specific) | Giving a pod AWS permissions |

## What is a ServiceAccount?

A ServiceAccount provides an identity for pods. It controls:
1. **What K8s API actions** a pod can perform (via RBAC)
2. **What AWS services** a pod can access (via IRSA on EKS)

Every namespace has a `default` ServiceAccount with **no permissions**. You should always create a dedicated SA for your apps.

## How It Works

```
┌──────────────────┐       ┌──────────────────┐
│  ServiceAccount  │◄──────│   RoleBinding    │
│  landmark-app-sa │       │  (connects them) │
└──────────────────┘       └────────┬─────────┘
        │                           │
        ▼                           ▼
┌──────────────────┐       ┌──────────────────┐
│  Pod / Deployment│       │      Role        │
│  (uses the SA)   │       │  (permissions)   │
└──────────────────┘       └──────────────────┘
```

## Using a ServiceAccount in a Pod

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  serviceAccountName: landmark-app-sa    # Assign the SA here
  containers:
    - name: app
      image: landmark-devops:latest
```

## Using a ServiceAccount in a Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      serviceAccountName: landmark-app-sa   # All pods get this SA
      containers:
        - name: app
          image: landmark-devops:latest
```

## IRSA — Giving Pods AWS Permissions (EKS)

On EKS, you can link a ServiceAccount to an IAM Role so pods can access AWS services (S3, DynamoDB, etc.) without hardcoding credentials.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: landmark-app-sa
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::075120018043:role/landmark-app-role
```

The pod automatically gets temporary AWS credentials via the SA token.

## What's in This Folder

| Resource | Name | Purpose |
|----------|------|---------|
| ServiceAccount | `landmark-app-sa` | Identity for the app pods (with IRSA annotation) |
| Role | `landmark-app-role` | Can read configmaps, secrets, pods, deployments |
| RoleBinding | `landmark-app-rolebinding` | Links the role to the SA |
| Pod | `landmark-app-pod` | Example pod using the SA |
| Deployment | `landmark-app` | Example deployment using the SA |

## How to Run

```bash
kubectl apply -f serviceaccount.yaml

# Verify
kubectl get sa -n landmark-devops
kubectl get roles -n landmark-devops
kubectl get rolebindings -n landmark-devops
```

## How to Test Permissions

```bash
# Check if the SA can get configmaps
kubectl auth can-i get configmaps \
  --as=system:serviceaccount:landmark-devops:landmark-app-sa \
  -n landmark-devops
# Expected: yes

# Check if the SA can delete pods (should be denied)
kubectl auth can-i delete pods \
  --as=system:serviceaccount:landmark-devops:landmark-app-sa \
  -n landmark-devops
# Expected: no

# List all permissions for the SA
kubectl auth can-i --list \
  --as=system:serviceaccount:landmark-devops:landmark-app-sa \
  -n landmark-devops
```

## Troubleshooting

```bash
# Pod getting "Forbidden" errors when calling K8s API
# 1. Check the SA is assigned
kubectl get pod landmark-app-pod -n landmark-devops -o jsonpath='{.spec.serviceAccountName}'

# 2. Check the Role has the right permissions
kubectl describe role landmark-app-role -n landmark-devops

# 3. Check the RoleBinding exists
kubectl describe rolebinding landmark-app-rolebinding -n landmark-devops

# 4. Verify the token is mounted
kubectl exec landmark-app-pod -n landmark-devops -- ls /var/run/secrets/kubernetes.io/serviceaccount/
```

## Key Points

- Every pod runs as a ServiceAccount — if you don't specify one, it uses `default`
- `default` SA has **no permissions** — always create a dedicated SA
- Follow **least privilege** — only grant the verbs and resources the app actually needs
- Use **IRSA** on EKS to give pods AWS permissions without access keys
- `automountServiceAccountToken: false` disables token mounting (use for pods that don't need API access)
- Role/RoleBinding = namespace-scoped, ClusterRole/ClusterRoleBinding = cluster-wide
