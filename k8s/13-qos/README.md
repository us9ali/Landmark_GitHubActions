# Quality of Service (QoS) in Kubernetes

## What is QoS?

QoS (Quality of Service) is how Kubernetes decides **which pods to kill first** when a node runs out of memory or CPU. Every pod is automatically assigned a QoS class based on its resource `requests` and `limits`.

When a node is under pressure, Kubernetes evicts pods in this order:
```
BestEffort (killed first) → Burstable → Guaranteed (killed last)
```

## Definitions

| Term | What It Is |
|------|-----------|
| **requests** | The minimum resources guaranteed to the container. The scheduler uses this to find a node with enough capacity. |
| **limits** | The maximum resources a container can use. If exceeded: CPU is throttled, memory causes OOMKill. |
| **QoS Class** | Automatically assigned based on requests/limits. Determines eviction priority. |
| **LimitRange** | Sets default/min/max resource values for a namespace. Prevents misconfigured pods. |
| **ResourceQuota** | Caps the total resources a namespace can consume. Prevents one team from hogging the cluster. |
| **OOMKill** | Out Of Memory Kill — kernel kills the container when it exceeds memory limits. |
| **CPU Throttling** | Container is slowed down (not killed) when it hits CPU limits. |

## The Three QoS Classes

### 1. Guaranteed (Highest Priority)

**Rule:** `requests == limits` for ALL containers in the pod.

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "512Mi"     # Same as requests
    cpu: "500m"         # Same as requests
```

| Property | Value |
|----------|-------|
| Eviction priority | Last to be evicted |
| Performance | Predictable, no throttling surprises |
| Use for | Databases, payment services, critical APIs |

### 2. Burstable (Medium Priority)

**Rule:** `requests < limits` (or at least one container has requests set).

```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"     # Higher than requests
    cpu: "500m"         # Higher than requests
```

| Property | Value |
|----------|-------|
| Eviction priority | Evicted after BestEffort, before Guaranteed |
| Performance | Can burst above requests when resources are available |
| Use for | Web apps, APIs, workers with variable load |

### 3. BestEffort (Lowest Priority)

**Rule:** No `requests` AND no `limits` set on ANY container.

```yaml
# No resources block at all
containers:
  - name: batch-job
    image: busybox
```

| Property | Value |
|----------|-------|
| Eviction priority | First to be evicted |
| Performance | Gets whatever is leftover on the node |
| Use for | Batch jobs, dev/test, non-critical tasks |

## Quick Reference

| QoS Class | Condition | Eviction Order | Best For |
|-----------|-----------|----------------|----------|
| **Guaranteed** | requests == limits (all containers) | Last (safest) | Production critical workloads |
| **Burstable** | requests < limits (at least one set) | Middle | Standard web apps |
| **BestEffort** | No requests, no limits | First (risky) | Dev/test, batch jobs |

## How to Check a Pod's QoS Class

```bash
kubectl get pod <pod-name> -n landmark-devops -o jsonpath='{.status.qosClass}'

# Or describe it
kubectl describe pod <pod-name> -n landmark-devops | grep "QoS Class"
```

## What's in This Folder

| Resource | Name | Purpose |
|----------|------|---------|
| Pod | `qos-guaranteed` | Example of Guaranteed QoS |
| Pod | `qos-burstable` | Example of Burstable QoS |
| Pod | `qos-besteffort` | Example of BestEffort QoS |
| Deployment | `landmark-app-guaranteed` | Production deployment with Guaranteed QoS |
| Deployment | `landmark-app-burstable` | Web app deployment with Burstable QoS |
| LimitRange | `landmark-limit-range` | Default resource values for the namespace |
| ResourceQuota | `landmark-resource-quota` | Total resource cap for the namespace |

## LimitRange — Prevent BestEffort Pods

A LimitRange sets defaults so pods without resource specs don't become BestEffort:

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: landmark-limit-range
  namespace: landmark-devops
spec:
  limits:
    - type: Container
      default:              # Applied as limits if not specified
        memory: "256Mi"
        cpu: "250m"
      defaultRequest:       # Applied as requests if not specified
        memory: "128Mi"
        cpu: "100m"
```

With this in place, any pod without resources defined gets `Burstable` instead of `BestEffort`.

## ResourceQuota — Cap Namespace Usage

Prevents a namespace from consuming all cluster resources:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: landmark-resource-quota
spec:
  hard:
    requests.cpu: "4"
    requests.memory: "4Gi"
    limits.cpu: "8"
    limits.memory: "8Gi"
    pods: "20"
```

## How to Run

```bash
kubectl apply -f qos.yaml

# Verify QoS classes
kubectl get pods -n landmark-devops -o custom-columns=NAME:.metadata.name,QOS:.status.qosClass

# Check LimitRange
kubectl describe limitrange landmark-limit-range -n landmark-devops

# Check ResourceQuota usage
kubectl describe resourcequota landmark-resource-quota -n landmark-devops
```

## Recommendations

| Environment | Recommended QoS | Why |
|-------------|-----------------|-----|
| Production (critical) | Guaranteed | Predictable, never evicted first |
| Production (standard) | Burstable | Cost-effective, can handle spikes |
| Dev/Test | Burstable or BestEffort | Save resources, acceptable risk |
| Batch/CronJobs | BestEffort | Runs when resources are free |

## Troubleshooting

```bash
# Pod getting OOMKilled
kubectl describe pod <pod-name> -n landmark-devops
# Look for: "OOMKilled" in Last State
# Fix: increase memory limits

# Pod being evicted
kubectl get events -n landmark-devops --field-selector reason=Evicted
# Fix: increase requests or upgrade to Guaranteed QoS

# Pod rejected due to ResourceQuota
kubectl describe resourcequota -n landmark-devops
# Fix: delete unused pods or increase the quota

# Check node resource pressure
kubectl describe node <node-name> | grep -A5 "Conditions"
# Look for: MemoryPressure=True or DiskPressure=True
```

## Key Points

- QoS is **automatically assigned** — you don't set it directly, it's determined by requests/limits
- **Always set requests and limits** in production to avoid BestEffort
- `requests` = scheduling guarantee, `limits` = hard ceiling
- CPU over-limit = throttled (slowed), Memory over-limit = OOMKilled (terminated)
- Use **LimitRange** to enforce defaults and prevent misconfigured pods
- Use **ResourceQuota** to prevent one namespace from starving others
- Guaranteed QoS costs more (reserved resources) but gives stability
- Burstable is the best balance of cost and performance for most workloads
