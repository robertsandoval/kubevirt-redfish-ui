# Kubevirt Systems Console Plugin

OpenShift dynamic console plugin for administering KubeVirt VMs exposed by
[redfish-controller](https://github.com/kubevirt/redfish-controller). Adds
**Compute → Kubevirt Systems** in the Administrator perspective (OpenShift 4.22+).

| | |
|---|---|
| Plugin name | `kubevirt-hosts` |
| Helm release | `kubevirt-systems` |
| Namespace | `kubevirt-redfish-console-plugin` |

## Prerequisites

- `oc` logged into an OpenShift cluster
- Helm 3
- `podman` or `docker`
- OpenShift 4.22+ with dynamic plugins
- OpenShift Virtualization / KubeVirt
- [redfish-controller](https://github.com/kubevirt/redfish-controller) installed
  (Secret with `config.yaml` and a Route for chassis/BMC discovery)

## Features

- List enrolled hosts (VMs matching redfish-controller chassis selectors)
- Guest IPs, MACs, power/ready, CPU/memory, copyable BMC addresses
- Create Halted Redfish-labeled VirtualMachines (pod or Multus)
- Enroll / unenroll existing VMs via selector labels
- Start / stop via `runStrategy` patches

BMC address format:

```text
redfish-virtualmedia+https://{route.host}/redfish/v1/Systems/{systemId}
```

## Deploy

Use the [Makefile](Makefile) in this repository. Defaults target the lab registry
`default-route-openshift-image-registry.apps.ocp.sandoval.lab`.

```bash
make help              # list targets and variables
make login build push  # registry login + image
make deploy            # helm upgrade --install
# or in one shot:
make all
```

Useful targets: `make status`, `make logs`, `make uninstall`, `make clean-namespace`.

Override examples:

```bash
make deploy IMAGE_TAG=0.1.1
make build REGISTRY_HOST=default-route-openshift-image-registry.apps.ocp.sandoval.lab
make all IMAGE_TAG=0.1.1 NAMESPACE=kubevirt-redfish-console-plugin
```

On Apple Silicon, `make build` targets `linux/amd64` automatically for OpenShift workers.

The chart creates the `ConsolePlugin`, serves the UI over HTTPS with an OpenShift
serving certificate, and (by default) enables the plugin on
`consoles.operator.openshift.io/cluster`.

Open the console → **Compute → Kubevirt Systems**.

Full chart options: [helm/kubevirt-hosts/README.md](helm/kubevirt-hosts/README.md).

## License

Apache-2.0
