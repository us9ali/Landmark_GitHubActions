# Volumes: AWS EBS with PV, PVC & StorageClass

## What are Volumes?

Containers are ephemeral — when a pod dies, its data is lost. Volumes provide persistent storage that survives pod restarts and rescheduling.

**Three objects work together:**
- `StorageClass` — Defines HOW volumes are dynamically provisioned (e.g., AWS EBS gp3)
- `PersistentVolumeClaim (PVC)` — A request for storage ("I need 20Gi")
- `PersistentVolume (PV)` — The actual storage resource (created automatically with dynamic provisioning)

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

> **Note:** The role ARN above is created in Step 1. Verify with:
> `aws iam list-roles --query "Roles[?contains(RoleName,'EBS')]" --output table`

### Step 3: Verify the Driver is Running

```bash
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver
```

## What's in This Folder

| Resource | Name | Purpose |
|----------|------|---------|
| StorageClass | `ebs-gp3` | Provisions gp3 EBS volumes dynamically |
| PVC | `landmark-db-pvc` | Requests 20Gi of EBS storage |
| Deployment | `landmark-db` | MySQL deployment that mounts the EBS volume |
| PV (optional) | `landmark-db-pv-static` | For pre-existing EBS volumes |

## Dynamic Provisioning (Recommended)

With dynamic provisioning, you only need a **StorageClass** and a **PVC**. The PV is created automatically.

```yaml
# StorageClass — tells K8s to use EBS CSI driver with gp3 volumes
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: ebs-gp3
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  fsType: ext4
allowVolumeExpansion: true
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
```

```yaml
# PVC — requests storage, EBS volume is auto-created
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: landmark-db-pvc
  namespace: landmark-devops
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: ebs-gp3
  resources:
    requests:
      storage: 20Gi
```

## Mounting the Volume to a Deployment

```yaml
spec:
  containers:
    - name: mysql
      image: mysql:8.0
      volumeMounts:
        - name: db-storage
          mountPath: /var/lib/mysql    # Where data is stored inside the container
  volumes:
    - name: db-storage
      persistentVolumeClaim:
        claimName: landmark-db-pvc    # Must match the PVC name
```

**Key points for mounting:**
- `volumes[].name` must match `volumeMounts[].name`
- `mountPath` is the directory inside the container where the EBS volume appears
- `claimName` references the PVC that provisions the actual EBS disk

## Static Provisioning (Pre-existing EBS Volume)

If you already have an EBS volume, create a PV manually pointing to it:

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: landmark-db-pv-static
spec:
  capacity:
    storage: 20Gi
  accessModes:
    - ReadWriteOnce
  storageClassName: ebs-gp3
  csi:
    driver: ebs.csi.aws.com
    volumeHandle: vol-xxxxxxxxxxxxxxxxx   # Your EBS volume ID
    fsType: ext4
  nodeAffinity:
    required:
      nodeSelectorTerms:
        - matchExpressions:
            - key: topology.ebs.csi.aws.com/zone
              operator: In
              values:
                - us-east-1a   # Must match the AZ of the EBS volume
```

> **Important:** The EBS volume must be in the same AZ as the node that mounts it.

## How to Run

```bash
# Apply everything
kubectl apply -f pv-pvc-storageclass.yaml

# Verify
kubectl get storageclass
kubectl get pvc -n landmark-devops
kubectl get pv
kubectl get pods -n landmark-devops
```

## Troubleshooting

```bash
# PVC stuck in Pending
kubectl describe pvc landmark-db-pvc -n landmark-devops
# Common causes:
#   - EBS CSI driver not installed (most common)
#   - StorageClass doesn't exist
#   - No nodes in the AZ (WaitForFirstConsumer waits for a pod to be scheduled)

# Check if EBS CSI driver is running
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver

# Check CSI driver logs
kubectl logs -n kube-system -l app=ebs-csi-controller

# Volume not mounting — check pod events
kubectl describe pod <pod-name> -n landmark-devops
# Look for: "AttachVolume.Attach failed" or "FailedMount"

# IAM permission issues
# Ensure the EBS CSI controller service account has the correct IAM role
kubectl describe sa ebs-csi-controller-sa -n kube-system
```

## Key Points

- **EBS CSI Driver is required** on EKS — the old `kubernetes.io/aws-ebs` provisioner is deprecated
- `WaitForFirstConsumer` delays volume creation until a pod needs it (ensures correct AZ)
- EBS volumes are `ReadWriteOnce` only — one node at a time
- Use `allowVolumeExpansion: true` to resize volumes later without recreating
- `Retain` reclaim policy keeps the EBS volume even after PVC deletion
- For multi-AZ read-write access, use EFS instead of EBS
