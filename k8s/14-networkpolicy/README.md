# Network Policy

## What is a NetworkPolicy?

A NetworkPolicy is a firewall for pods. It controls which pods can talk to each other and what external traffic is allowed in or out. By default, all pods in Kubernetes can communicate with every other pod — NetworkPolicies restrict that.

## Definitions

| Term | What It Is |
|------|-----------|
| **Ingress** | Incoming traffic TO a pod |
| **Egress** | Outgoing traffic FROM a pod |
| **podSelector** | Selects which pods the policy applies to (by labels) |
| **namespaceSelector** | Allows/denies traffic from pods in specific namespaces |
| **ipBlock** | Allows/denies traffic from specific IP ranges (CIDR) |
| **policyTypes** | Declares whether the policy covers Ingress, Egress, or both |

## How NetworkPolicies Work

```
┌─────────────────────────────────────────────────────────┐
│  Without NetworkPolicy:                                  │
│  ALL pods can talk to ALL pods (open by default)         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  With NetworkPolicy:                                     │
│  Only EXPLICITLY allowed traffic gets through            │
│                                                          │
│  Internet ──► [allow-app-ingress] ──► landmark-app       │
│                                           │              │
│                                    [allow-app-to-db]     │
│                                           │              │
│                                           ▼              │
│                                      landmark-db         │
│                                      (no internet)       │
└─────────────────────────────────────────────────────────┘
```

## Prerequisites

NetworkPolicies require a **CNI plugin** that supports them:
- **AWS EKS:** Install the VPC CNI plugin (installed by default) + enable network policy support
- **Calico:** Full NetworkPolicy support
- **Cilium:** Full support with extended features

### Enable Network Policy on EKS

```bash
# EKS VPC CNI supports network policies starting v1.14+
# Verify your VPC CNI version
kubectl describe daemonset aws-node -n kube-system | grep Image

# Enable network policy (if using VPC CNI v1.14+)
kubectl set env daemonset aws-node -n kube-system ENABLE_NETWORK_POLICY=true
```

## What's in This Folder

| Policy | Name | What It Does |
|--------|------|-------------|
| Deny All | `default-deny-all` | Blocks all traffic in the namespace (start here) |
| App Ingress | `allow-app-ingress` | Allows internet traffic to the app on port 3000 |
| App → DB | `allow-app-to-db` | Allows only app pods to reach the DB on port 3306 |
| App Egress | `allow-app-egress` | App can only talk to DB and DNS |
| From Monitoring | `allow-from-monitoring` | Allows monitoring namespace to scrape the app |
| DB Restrict | `db-restrict-access` | DB only accepts traffic from app, only egress is DNS |

## The Zero-Trust Approach

1. **Start with deny-all** — block everything
2. **Whitelist only what's needed** — open specific paths

```yaml
# Step 1: Deny all
spec:
  podSelector: {}       # All pods
  policyTypes:
    - Ingress
    - Egress

# Step 2: Allow specific traffic
spec:
  podSelector:
    matchLabels:
      app: landmark-app
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
```

## Common Patterns

### Allow traffic from specific pods only

```yaml
ingress:
  - from:
      - podSelector:
          matchLabels:
            app: landmark-app
```

### Allow traffic from a specific namespace

```yaml
ingress:
  - from:
      - namespaceSelector:
          matchLabels:
            name: monitoring
```

### Allow traffic from an IP range

```yaml
ingress:
  - from:
      - ipBlock:
          cidr: 10.0.0.0/16
          except:
            - 10.0.1.0/24
```

### Allow DNS (required for almost all egress policies)

```yaml
egress:
  - to:
      - namespaceSelector: {}
        podSelector:
          matchLabels:
            k8s-app: kube-dns
    ports:
      - protocol: UDP
        port: 53
```

> **Important:** If you set an egress policy, you MUST allow DNS or pods can't resolve service names.

## How to Run

```bash
kubectl apply -f networkpolicy.yaml

# Verify
kubectl get networkpolicies -n landmark-devops
kubectl describe networkpolicy default-deny-all -n landmark-devops
```

## How to Test

```bash
# Test connectivity from app to db (should work)
kubectl exec -it deploy/landmark-app -n landmark-devops -- \
  nc -zv landmark-db.landmark-devops.svc.cluster.local 3306

# Test connectivity from a random pod to db (should be blocked)
kubectl run test --rm -it --image=busybox -n landmark-devops -- \
  nc -zv landmark-db.landmark-devops.svc.cluster.local 3306

# Test external access (should be blocked for db)
kubectl exec -it deploy/landmark-db -n landmark-devops -- \
  wget -qO- --timeout=3 https://google.com || echo "Blocked as expected"
```

## Troubleshooting

```bash
# Policy not working (traffic still allowed)
# 1. Check if your CNI supports NetworkPolicies
kubectl get pods -n kube-system | grep -E "calico|cilium|aws-node"

# 2. Verify policy is applied to the right pods
kubectl describe networkpolicy allow-app-to-db -n landmark-devops
# Check "PodSelector" and "Allowing ingress traffic" sections

# 3. Check pod labels match the policy selectors
kubectl get pods -n landmark-devops --show-labels

# 4. Policies are additive — if ANY policy allows traffic, it's allowed
# Make sure default-deny-all is applied first

# 5. DNS issues after applying egress policy
# Symptom: pods can't resolve service names
# Fix: add DNS egress rule (port 53 UDP to kube-dns)
```

## Key Points

- NetworkPolicies are **additive** — if any policy allows traffic, it goes through
- An **empty podSelector `{}`** applies to ALL pods in the namespace
- Without any NetworkPolicy, all traffic is allowed (open by default)
- Always **allow DNS egress** (port 53) when restricting egress
- Policies are **namespace-scoped** — they only affect pods in their namespace
- You need a **CNI that supports NetworkPolicies** (VPC CNI v1.14+, Calico, or Cilium)
- Use `default-deny-all` as your baseline, then add allow rules
