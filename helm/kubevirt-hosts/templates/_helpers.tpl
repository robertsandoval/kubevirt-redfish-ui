{{/*
Expand the name of the chart / plugin.
*/}}
{{- define "kubevirt-hosts.name" -}}
{{- default (default .Chart.Name .Release.Name) .Values.plugin.name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "kubevirt-hosts.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "kubevirt-hosts.labels" -}}
helm.sh/chart: {{ include "kubevirt-hosts.chart" . }}
{{ include "kubevirt-hosts.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "kubevirt-hosts.selectorLabels" -}}
app: {{ include "kubevirt-hosts.name" . }}
app.kubernetes.io/name: {{ include "kubevirt-hosts.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: {{ include "kubevirt-hosts.name" . }}
{{- end }}

{{/*
Create the name secret containing the certificate
*/}}
{{- define "kubevirt-hosts.certificateSecret" -}}
{{ default (printf "%s-cert" (include "kubevirt-hosts.name" .)) .Values.plugin.certificateSecretName }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "kubevirt-hosts.serviceAccountName" -}}
{{- if .Values.plugin.serviceAccount.create }}
{{- default (include "kubevirt-hosts.name" .) .Values.plugin.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.plugin.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the patcher
*/}}
{{- define "kubevirt-hosts.patcherName" -}}
{{- printf "%s-patcher" (include "kubevirt-hosts.name" .) }}
{{- end }}

{{/*
Create the name of the patcher service account to use
*/}}
{{- define "kubevirt-hosts.patcherServiceAccountName" -}}
{{- if .Values.plugin.patcherServiceAccount.create }}
{{- default (printf "%s-patcher" (include "kubevirt-hosts.name" .)) .Values.plugin.patcherServiceAccount.name }}
{{- else }}
{{- default "default" .Values.plugin.patcherServiceAccount.name }}
{{- end }}
{{- end }}
