# Kubevirt Systems Console Plugin

OpenShift dynamic console plugin for administering KubeVirt VMs exposed by
[redfish-controller](../redfish-controller). Adds **Compute → Kubevirt Systems**
in the Administrator perspective (OpenShift 4.22+).

| | |
|---|---|
| Plugin name | `kubevirt-hosts` |
| Helm release | `kubevirt-systems` |
| Namespace | `kubevirt-redfish-console-plugin` |
| Stack | TypeScript, React 18, PatternFly 6, Yarn 4, Webpack 5 |

## Prerequisites

- Node.js 22+ and [Yarn 4](https://yarnpkg.com/) (repo uses Yarn via `packageManager` / `.yarn/releases`)
- `oc` logged into an OpenShift cluster
- Helm 3
- `podman` or `docker`
- OpenShift 4.22+ with dynamic plugins
- OpenShift Virtualization / KubeVirt
- [redfish-controller](../redfish-controller) installed (Secret with `config.yaml` and a Route for chassis/BMC discovery)

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

## Local development

Install dependencies, then run the plugin and a local console against your cluster.

```bash
yarn install

# Terminal 1 — plugin webpack dev server (port 9001, CORS enabled)
yarn start

# Terminal 2 — OpenShift console container (requires oc login)
yarn start-console
```

Open http://localhost:9000 → **Compute → Kubevirt Systems**, or go directly to
http://localhost:9000/kubevirt-hosts.

| Port | Service |
|------|---------|
| 9001 | Plugin webpack-dev-server |
| 9000 | Local OpenShift console (`start-console.sh`) |

Notes:

- You must be logged in with `oc` so `start-console.sh` can discover the API server and bearer token.
- Changes to `console-extensions.json` require restarting `yarn start` (no HMR for extensions).
- After adding or changing user-facing strings, run `yarn i18n` to refresh `locales/`.

Optional: a [devcontainer](.devcontainer) can run console + plugin with ports 9000/9001 forwarded.

### Useful scripts

| Command | Description |
|---------|-------------|
| `yarn start` | Dev server on `:9001` |
| `yarn start-console` | Console container on `:9000` |
| `yarn build` | Production webpack build → `dist/` |
| `yarn lint` | ESLint + Stylelint (auto-fix) |
| `yarn test` | Jest unit tests |
| `yarn coverage` | Jest with coverage |
| `yarn test-e2e` | Playwright (headed) |
| `yarn test-e2e-headless` | Playwright (headless) |
| `yarn i18n` | Regenerate locale files |

## Deploy to OpenShift

Defaults target the lab registry
`default-route-openshift-image-registry.apps.ocp.sandoval.lab`.

From this directory:

```bash
make help              # list targets and variables
make login build push  # registry login + image
make deploy            # helm upgrade --install
# or in one shot:
make all
```

From the parent [kubevirt](..) workspace:

```bash
make install-ui      # same as: make -C redfish-admin-ui all
make uninstall-ui
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

## Project layout

```text
src/
  components/          # HostsPage, CreateHostPage, HostDetailPage, modals
  hooks/               # React hooks
  utils/               # Helpers
  models.ts / types.ts
console-extensions.json
package.json           # consolePlugin metadata + exposedModules
webpack.config.ts
locales/               # i18n (plugin__kubevirt-hosts)
helm/kubevirt-hosts/   # OpenShift deployment chart
integration-tests/     # Playwright e2e
```

## License

Apache-2.0
