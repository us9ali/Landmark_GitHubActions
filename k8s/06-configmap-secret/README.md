# ConfigMap & Secret

## What is a ConfigMap?

A ConfigMap stores non-sensitive configuration data as key-value pairs. It decouples configuration from container images so you can change settings without rebuilding.

## What is a Secret?

A Secret stores sensitive data (passwords, tokens, keys). Secrets are base64-encoded (not encrypted by default) and can be encrypted at rest with additional configuration.

## What's in This Folder

| Resource | Name | Purpose |
|----------|------|---------|
| ConfigMap | `app-config` | Multiple app settings (NODE_ENV, APP_PORT, LOG_LEVEL, etc.) |
| ConfigMap | `app-feature-flags` | Single value config (ENABLE_NOTIFICATIONS) |
| Secret | `app-secrets` | Sensitive data (DATABASE_URL, API_KEY, JWT_SECRET) |
| Deployment | `landmark-app` | Uses both referencing styles |

## Two Ways to Use ConfigMaps/Secrets in a Deployment

### 1. Reference the ENTIRE ConfigMap/Secret (all keys become env vars)

```yaml
envFrom:
  - configMapRef:
      name: app-config          # Every key in app-config becomes an env var
  - configMapRef:
      name: app-feature-flags
  - secretRef:
      name: app-secrets         # Every key in app-secrets becomes an env var
```

This injects ALL key-value pairs as environment variables into the container.

### 2. Reference a SINGLE value from a ConfigMap/Secret

```yaml
env:
  - name: MY_NODE_ENV             # Custom env var name in the container
    valueFrom:
      configMapKeyRef:
        name: app-config          # ConfigMap name
        key: NODE_ENV             # Specific key to pull
  - name: MY_DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: app-secrets
        key: DATABASE_URL
```

This gives you control over which keys to inject and what to name them.

### When to Use Which?

| Approach | Use When |
|----------|----------|
| `envFrom` (entire) | You want all config values injected automatically |
| `valueFrom` (single) | You need to rename keys, or only need specific values |

> You can use BOTH in the same container (as shown in `configmap-secret.yaml`).

## How to Run

```bash
kubectl apply -f configmap-secret.yaml

# Verify resources
kubectl get configmaps -n landmark-devops
kubectl get secrets -n landmark-devops
kubectl get deployment landmark-app -n landmark-devops
```

## How to Verify Env Vars in the Pod

```bash
# Exec into a running pod and check env vars
kubectl exec -it deploy/landmark-app -n landmark-devops -- env | grep -E "NODE_ENV|APP_PORT|DATABASE_URL|ENABLE_NOTIFICATIONS"
```

## How to Access

```bash
# View ConfigMap data
kubectl describe configmap app-config -n landmark-devops
kubectl describe configmap app-feature-flags -n landmark-devops

# View Secret data (base64 encoded)
kubectl get secret app-secrets -n landmark-devops -o yaml

# Decode a secret value
kubectl get secret app-secrets -n landmark-devops -o jsonpath='{.data.DATABASE_URL}' | base64 -d
```

## Troubleshooting

```bash
# Pod stuck in CreateContainerConfigError
kubectl describe pod <pod-name> -n landmark-devops
# Look for: "configmaps not found" or "secrets not found"
# Fix: ensure ConfigMap/Secret exists in the SAME namespace as the pod

# Pod running but env var missing
kubectl exec -it deploy/landmark-app -n landmark-devops -- env | sort
# Check if the key name matches what you expect

# Create a secret from the command line
kubectl create secret generic app-secrets \
  --from-literal=DATABASE_URL='mysql://user:pass@db:3306/mydb' \
  --from-literal=API_KEY='my-key' \
  -n landmark-devops
```

## Key Points

- ConfigMap = non-sensitive config, Secret = sensitive data
- `envFrom` injects ALL keys from a ConfigMap/Secret as env vars
- `valueFrom` with `configMapKeyRef`/`secretKeyRef` injects a SINGLE key
- You can combine both approaches in the same container spec
- `stringData` in Secrets auto-encodes to base64 (easier to write)
- Secrets are NOT encrypted by default — enable encryption at rest in production
- Never commit real secrets to Git — use sealed-secrets or external secret managers
