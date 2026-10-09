# kubevirt-hosts Helm chart

Deploys the **Kubevirt Systems** OpenShift dynamic console plugin and enables it on the cluster console.

## What it installs

| Resource | Purpose |
|----------|---------|
| `Deployment` + `Service` | Serves plugin assets over HTTPS (OpenShift serving cert) |
| `ConfigMap` | nginx config listening on port `9443` |
| `ConsolePlugin` | Registers the plugin with the OpenShift console |
| Patcher `Job` (optional) | Adds `kubevirt-hosts` to `consoles.operator.openshift.io/cluster` |

## Prerequisites

- OpenShift 4.22+
- Helm 3
- A built/pushed plugin image (see root [README](../../README.md))
- `cluster-admin` (or equivalent) to create `ConsolePlugin` and patch the console operator

## Install

```bash
# Build and push the plugin image first
podman build -t quay.io/<org>/kubevirt-hosts-console-plugin:0.1.0 -f Dockerfile .
podman push quay.io/<org>/kubevirt-hosts-console-plugin:0.1.0

# Deploy
helm upgrade --install kubevirt-systems ./helm/kubevirt-hosts \
  --namespace kubevirt-redfish-console-plugin \
  --create-namespace \
  --set plugin.image=quay.io/<org>/kubevirt-hosts-console-plugin:0.1.0
```

Then open the OpenShift web console → **Compute → Kubevirt Systems**.

## Values

| Key | Default | Description |
|-----|---------|-------------|
| `plugin.image` | `quay.io/kubevirt/kubevirt-hosts-console-plugin:0.1.0` | Plugin container image |
| `plugin.name` | `kubevirt-hosts` | ConsolePlugin / Service name |
| `plugin.replicas` | `2` | Deployment replicas |
| `plugin.port` | `9443` | HTTPS listen port |
| `plugin.jobs.patchConsoles.enabled` | `true` | Auto-enable plugin on the cluster console |
| `plugin.jobs.patchConsoles.image` | `registry.redhat.io/openshift4/ose-cli:latest` | Image with `oc` for the patcher Job (no `jq` required) |

## Manual console enable

If you disable the patcher job:

```bash
helm upgrade --install kubevirt-systems ./helm/kubevirt-hosts \
  --namespace kubevirt-redfish-console-plugin \
  --create-namespace \
  --set plugin.image=quay.io/<org>/kubevirt-hosts-console-plugin:0.1.0 \
  --set plugin.jobs.patchConsoles.enabled=false

oc patch consoles.operator.openshift.io cluster --type=json \
  -p='[{"op":"add","path":"/spec/plugins/-","value":"kubevirt-hosts"}]'
```

## Uninstall

```bash
helm uninstall kubevirt-systems -n kubevirt-redfish-console-plugin
oc delete namespace kubevirt-redfish-console-plugin
# Optionally remove from console plugins list
oc get consoles.operator.openshift.io cluster -o jsonpath='{.spec.plugins}'
```
