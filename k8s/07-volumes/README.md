# Volumes: AWS EBS with PV, PVC & StorageClass

## Definitions

| Term | What It Is | Analogy |
|------|-----------|---------|
| **Volume** | Storage attached to a pod | A USB drive plugged into a computer |
| **PersistentVolume (PV)** | A piece of storage provisioned in the cluster | The actual hard disk |
| **PersistentVolumeClaim (PVC)** | A request for storage by a pod | A purchase order for a hard disk |
| **StorageClass** | A template that defines how to create volumes | The catalog you order from |
| **CSI Driver** | Plugin that connects K8s to a storage backend (EBS, EFS, etc.) | The driver software for the disk |

## Why Do We Need Volumes?

- Containers are **ephemeral** — when a pod restarts, all data inside is lost
- Volumes provide **persistent storage** that survives pod restarts, crashes, and rescheduling
- Use cases: databases, file uploads, application logs, shared config files

## Volume Types in Kubernetes

| Type | Persistence | Use Case |
|------|-------------|----------|
| `emptyDir` | Deleted when pod dies | Temp files, caches, inter-container sharing |
| `hostPath` | Tied to a specific node | Local dev only (never in production) |
| `persistentVolumeClaim` | Survives pod restarts | Databases, uploads, anything that must persist |
| `configMap` / `secret` | Read-only config files | Mounting config as files |

## Access Modes

| Mode | Short | Meaning |
|------|-------|---------|
| `ReadWriteOnce` | RWO | One node can read/write (EBS) |
| `ReadOnlyMany` | ROX | Many nodes can read |
| `ReadWriteMany` | RWX | Many nodes can read/write (requires EFS/NFS) |

> **EBS only supports RWO** — if you need RWX, use AWS EFS.

## Reclaim Policies

| Policy | What Happens When PVC is Deleted |
|--------|----------------------------------|
| `Retain` | PV and EBS volume are kept (manual cleanup needed) |
| `Delete` | PV and EBS volume are automatically deleted |

## Prerequisites: Install the AWS EBS CSI Driver

The EBS CSI driver is **required** for EBS volumes on EKS. Without it, PVCs will stay in `Pending`.

### Step 1: Create IAM Role for the EBS CSI Driver

```bash
eksctl create iamserviceaccount \
  --cluster=landmark-eks \
  --namespace=kube-system \
  --name=ebs-csi-controller-sa \
  --attach-policy-arn=arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy \
  --override-existing-serviceaccounts \
  --region us-east-1 \
  --approve
```

### Step 2: Install the EBS CSI Driver as an EKS Add-on

```bash
eksctl create addon \
  --name aws-ebs-csi-driver \
  --cluster landmark-eks \
  --region us-east-1 \
  --service-account-role-arn arn:aws:iam::075120018043:role/AmazonEKS_EBS_CSI_DriverRole \
  --force
```

### Step 3: Verify the Driver is Running

```bash
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver
```

## What's in This Folder

| Resource | Name | Purpose |
|----------|------|---------|
| StorageClass | `ebs-gp3` | Provisions gp3 EBS volumes dynamically |
| PVC | `landmark-db-pvc` | Requests 20Gi for database |
| PVC | `landmark-app-pvc` | Requests 5Gi for app uploads |
| Deployment | `landmark-db` | MySQL with EBS volume mounted at `/var/lib/mysql` |
| Deployment | `landmark-app` | App with EBS volume for uploads + emptyDir for logs |
| PV (optional) | `landmark-db-pv-static` | For pre-existing EBS volumes |

## How Volume Mounting Works

```
┌─────────────────────────────────────────────────────┐
│  Deployment spec                                     │
│                                                      │
│  volumes:                    ◄── Define the volume   │
│    - name: db-storage                                │
│      persistentVolumeClaim:                          │
│        claimName: landmark-db-pvc  ◄── Link to PVC  │
│                                                      │
│  containers:                                         │
│    volumeMounts:             ◄── Mount into container│
│      - name: db-storage          (must match above) │
│        mountPath: /var/lib/mysql  ◄── Path inside    │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  PVC (landmark-db-pvc)      │
│  storageClassName: ebs-gp3  │──── References StorageClass
│  storage: 20Gi              │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  StorageClass (ebs-gp3)     │
│  provisioner: ebs.csi.aws.com ──── Creates EBS volume
│  type: gp3                  │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  AWS EBS Volume (gp3, 20Gi) │
│  Created automatically       │
└─────────────────────────────┘
```

## Mounting Examples

### Mount a single volume

```yaml
spec:
  containers:
    - name: mysql
      volumeMounts:
        - name: db-storage
          mountPath: /var/lib/mysql
  volumes:
    - name: db-storage
      persistentVolumeClaim:
        claimName: landmark-db-pvc
```

### Mount multiple volumes to one container

```yaml
spec:
  containers:
    - name: app
      volumeMounts:
        - name: uploads
          mountPath: /app/uploads       # Persistent (EBS)
        - name: logs
          mountPath: /app/logs          # Temporary (emptyDir)
  volumes:
    - name: uploads
      persistentVolumeClaim:
        claimName: landmark-app-pvc
    - name: logs
      emptyDir: {}
```

### Mount with subPath (avoid overwriting existing files)

```yaml
volumeMounts:
  - name: app-data
    mountPath: /app/logs
    subPath: logs           # Only mounts the "logs" subdirectory from the volume
```

## Important Notes

1. **Strategy must be `Recreate`** — When using RWO volumes, you cannot use `RollingUpdate` because the old pod holds the volume lock. Use `strategy.type: Recreate`.

2. **`WaitForFirstConsumer`** — The volume is NOT created until a pod is scheduled. This ensures the EBS volume is created in the same AZ as the node.

3. **One volume per pod (RWO)** — EBS can only attach to one node. If you need shared storage across multiple pods, use EFS.

4. **Volume expansion** — With `allowVolumeExpansion: true`, you can edit the PVC to request more storage:
   ```bash
   kubectl edit pvc landmark-db-pvc -n landmark-devops
   # Change storage from 20Gi to 50Gi — no downtime needed
   ```

5. **Never use `hostPath` in production** — It ties your pod to a specific node and data is lost if the node dies.

## How to Run

```bash
# Apply everything
kubectl apply -f pv-pvc-storageclass.yaml

# Verify
kubectl get storageclass
kubectl get pvc -n landmark-devops
kubectl get pv
kubectl get pods -n landmark-devops

# Check volume is mounted inside the pod
kubectl exec -it deploy/landmark-db -n landmark-devops -- df -h /var/lib/mysql
```

## Troubleshooting

```bash
# PVC stuck in Pending
kubectl describe pvc landmark-db-pvc -n landmark-devops
# Common causes:
#   - EBS CSI driver not installed
#   - StorageClass doesn't exist
#   - WaitForFirstConsumer: no pod scheduled yet (this is normal, wait for deployment)

# Pod stuck in ContainerCreating
kubectl describe pod <pod-name> -n landmark-devops
# Look for:
#   - "AttachVolume.Attach failed" → IAM permissions or wrong AZ
#   - "FailedMount" → volume is still attached to another node

# Check EBS CSI driver
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver
kubectl logs -n kube-system -l app=ebs-csi-controller

# Force detach a stuck volume (last resort)
kubectl delete volumeattachment <attachment-name>
```

## Key Points

- **EBS CSI Driver is required** on EKS — the old `kubernetes.io/aws-ebs` provisioner is deprecated
- `volumes[].name` must match `volumeMounts[].name` — this is how K8s links them
- `mountPath` is where the volume appears inside the container
- `claimName` in the volume spec must match an existing PVC name
- Use `Recreate` strategy with RWO volumes to avoid mount conflicts
- `WaitForFirstConsumer` ensures the EBS volume is in the correct AZ
- Use `allowVolumeExpansion: true` to resize without recreating
- `Retain` keeps data safe even if PVC is deleted
- For multi-pod shared storage, use AWS EFS (not EBS)
