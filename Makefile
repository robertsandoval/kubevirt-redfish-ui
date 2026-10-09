# Kubevirt-Hosts console plugin — build / push / Helm helpers
#
# Examples:
#   make login build push deploy
#   make deploy IMAGE_TAG=0.1.1
#   make status uninstall

SHELL := /bin/bash

# OpenShift internal registry (external push route)
REGISTRY_HOST ?= default-route-openshift-image-registry.apps.ocp.sandoval.lab
# In-cluster pull reference used by Deployment
CLUSTER_REGISTRY ?= image-registry.openshift-image-registry.svc:5000

NAMESPACE ?= kubevirt-redfish-console-plugin
IMAGE_NAME ?= kubevirt-hosts-console-plugin
IMAGE_TAG ?= 0.1.0
# Helm release name (what you see in "Release … does not exist")
RELEASE_NAME ?= kubevirt-systems
# ConsolePlugin / Deployment name from chart values (plugin.name)
PLUGIN_NAME ?= kubevirt-hosts
CHART_DIR ?= helm/kubevirt-hosts

PUSH_IMAGE := $(REGISTRY_HOST)/$(NAMESPACE)/$(IMAGE_NAME):$(IMAGE_TAG)
PULL_IMAGE := $(CLUSTER_REGISTRY)/$(NAMESPACE)/$(IMAGE_NAME):$(IMAGE_TAG)

CONTAINER_RUNTIME := $(shell command -v podman 2>/dev/null || command -v docker 2>/dev/null)
TLS_VERIFY ?= false

# Apple Silicon → build linux/amd64 for OpenShift worker nodes
IS_APPLE_SILICON := $(shell uname -m | grep -q arm64 && echo true || echo false)
PLATFORM ?= $(if $(filter true,$(IS_APPLE_SILICON)),linux/amd64,)

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  %-18s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "Variables (override with VAR=value):"
	@echo "  REGISTRY_HOST=$(REGISTRY_HOST)"
	@echo "  CLUSTER_REGISTRY=$(CLUSTER_REGISTRY)"
	@echo "  NAMESPACE=$(NAMESPACE)"
	@echo "  IMAGE_TAG=$(IMAGE_TAG)"
	@echo "  PUSH_IMAGE=$(PUSH_IMAGE)"
	@echo "  PULL_IMAGE=$(PULL_IMAGE)"
	@echo ""

.PHONY: check-tools
check-tools:
ifndef CONTAINER_RUNTIME
	$(error Neither podman nor docker found)
endif
	@command -v oc >/dev/null || { echo "oc not found"; exit 1; }
	@command -v helm >/dev/null || { echo "helm not found"; exit 1; }

.PHONY: login
login: check-tools ## oc registry login (podman/docker)
	@echo "Logging into $(REGISTRY_HOST) as $$(oc whoami)..."
	@$(CONTAINER_RUNTIME) login -u "$$(oc whoami)" -p "$$(oc whoami -t)" \
		$(REGISTRY_HOST) --tls-verify=$(TLS_VERIFY)

.PHONY: namespace
namespace: ## Ensure project/namespace and ImageStream exist
	@oc get project $(NAMESPACE) >/dev/null 2>&1 || oc new-project $(NAMESPACE)
	@oc project $(NAMESPACE) >/dev/null
	@oc get imagestream $(IMAGE_NAME) -n $(NAMESPACE) >/dev/null 2>&1 || \
		oc create imagestream $(IMAGE_NAME) -n $(NAMESPACE)
	@echo "Namespace $(NAMESPACE) ready"

.PHONY: build
build: check-tools ## Build plugin container image
	@echo "Building $(PUSH_IMAGE) with $(CONTAINER_RUNTIME)"
	@# BuildKit enables Dockerfile cache mounts (yarn package cache)
ifeq ($(PLATFORM),)
	DOCKER_BUILDKIT=1 $(CONTAINER_RUNTIME) build -t $(PUSH_IMAGE) .
else
	@echo "Platform: $(PLATFORM)"
	DOCKER_BUILDKIT=1 $(CONTAINER_RUNTIME) build --platform $(PLATFORM) -t $(PUSH_IMAGE) .
endif

.PHONY: push
push: check-tools namespace ## Push image to OpenShift registry
	@echo "Pushing $(PUSH_IMAGE)"
	$(CONTAINER_RUNTIME) push --tls-verify=$(TLS_VERIFY) $(PUSH_IMAGE)

.PHONY: image
image: login build push ## login + build + push

.PHONY: helm-lint
helm-lint: check-tools ## Lint the Helm chart
	helm lint $(CHART_DIR)

.PHONY: helm-template
helm-template: check-tools ## Render Helm manifests (dry-run)
	helm template $(RELEASE_NAME) $(CHART_DIR) \
		--namespace $(NAMESPACE) \
		--set plugin.image=$(PULL_IMAGE) \
		--set plugin.imagePullPolicy=Always

.PHONY: deploy
deploy: check-tools namespace ## Helm upgrade --install the console plugin
	helm upgrade --install $(RELEASE_NAME) $(CHART_DIR) \
		--namespace $(NAMESPACE) \
		--create-namespace \
		--set plugin.image=$(PULL_IMAGE) \
		--set plugin.imagePullPolicy=Always \
		--wait \
		--timeout 5m
	@echo ""
	@echo "Deployed. Open the console → Compute → Kubevirt Systems"
	@echo "Image: $(PULL_IMAGE)"

.PHONY: all
all: image deploy ## Build, push, and deploy

.PHONY: status
status: ## Show Deployment / ConsolePlugin / pods
	@echo "=== Helm release ==="
	@helm status $(RELEASE_NAME) -n $(NAMESPACE) 2>/dev/null || echo "(release $(RELEASE_NAME) not found)"
	@echo ""
	@echo "=== ConsolePlugin ==="
	@oc get consoleplugin $(PLUGIN_NAME) 2>/dev/null || echo "(not found)"
	@echo ""
	@echo "=== Deployment ==="
	@oc get deploy,svc,pods -n $(NAMESPACE) -l app.kubernetes.io/name=$(PLUGIN_NAME) 2>/dev/null || \
		oc get deploy,svc,pods -n $(NAMESPACE) 2>/dev/null || true
	@echo ""
	@echo "=== Console plugins list ==="
	@oc get consoles.operator.openshift.io cluster -o jsonpath='{.spec.plugins}' 2>/dev/null; echo

.PHONY: logs
logs: ## Tail plugin Deployment logs
	oc logs -n $(NAMESPACE) -l app.kubernetes.io/name=$(PLUGIN_NAME) -f --tail=100

.PHONY: uninstall
uninstall: check-tools ## Helm uninstall (keeps namespace)
	helm uninstall $(RELEASE_NAME) -n $(NAMESPACE) || true
	@# Also remove legacy release name if present
	@helm uninstall kubevirt-hosts -n $(NAMESPACE) 2>/dev/null || true
	@echo "Removed Helm release $(RELEASE_NAME) from $(NAMESPACE)"

.PHONY: undeploy
undeploy: uninstall ## Alias for uninstall

.PHONY: clean-namespace
clean-namespace: uninstall ## Uninstall and delete the namespace
	oc delete project $(NAMESPACE) --wait=false 2>/dev/null || true
	@echo "Delete requested for project $(NAMESPACE)"
