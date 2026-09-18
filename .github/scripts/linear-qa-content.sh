#!/usr/bin/env bash

qa_area_label() {
  case "$1" in
    contacts) echo "Contactos" ;;
    metrics) echo "Métricas" ;;
    dashboard) echo "Dashboard" ;;
    linear-qa) echo "Linear QA" ;;
    dynamodb) echo "DynamoDB" ;;
    integrations) echo "Integraciones" ;;
    bots) echo "Bots" ;;
    conversations) echo "Conversaciones" ;;
    *) echo "Plataforma" ;;
  esac
}

qa_action_label() {
  case "$1" in
    feat) echo "Verificar nueva funcionalidad" ;;
    fix) echo "Verificar corrección" ;;
    refactor) echo "Verificar refactor sin regresiones" ;;
    chore) echo "Verificar mantenimiento" ;;
    *) echo "Verificar cambio" ;;
  esac
}

spanish_qa_title() {
  local source_title="$1"
  local commit_type="" scope="" subject="" area="" action=""

  if [[ "$source_title" =~ ^([a-zA-Z]+)\(([^\)]+)\):\ (.+)$ ]]; then
    commit_type="${BASH_REMATCH[1]}"
    scope="${BASH_REMATCH[2]}"
    subject="${BASH_REMATCH[3]}"
  elif [[ "$source_title" =~ ^([a-zA-Z]+):\ (.+)$ ]]; then
    commit_type="${BASH_REMATCH[1]}"
    subject="${BASH_REMATCH[2]}"
  else
    printf 'QA: Verificar cambio en develop - %s' "$source_title"
    return
  fi

  area="$(qa_area_label "$scope")"
  action="$(qa_action_label "$commit_type")"

  case "${scope}:${subject}" in
    "contacts:add country and company fields to contact management")
      printf 'QA: %s - agregar campos de país y empresa' "$area"
      ;;
    "contacts:refine contact creation and update logic for country handling")
      printf 'QA: %s - validar creación y edición con país' "$area"
      ;;
    "metrics:enhance sales metrics retrieval with optional parameters")
      printf 'QA: %s - consulta de ventas con filtros opcionales' "$area"
      ;;
    "metrics:add channel-based metrics tracking and dashboard updates")
      printf 'QA: %s - mensajes enviados por canal en dashboard' "$area"
      ;;
    "linear-qa:implement scripts for Linear QA issue creation and project setup")
      printf 'QA: %s - scripts de creación de issues y setup del proyecto' "$area"
      ;;
    "linear-qa:streamline GraphQL queries and mutations in scripts")
      printf 'QA: %s - queries y mutaciones GraphQL en scripts' "$area"
      ;;
    "dynamodb:update type casting in stripReceiptItem function")
      printf 'QA: %s - corregir conversión de tipos en recibos SMS' "$area"
      ;;
    *)
      printf 'QA: %s - %s' "$area" "$action"
      ;;
  esac
}

qa_testing_focus() {
  local changed_files="$1"
  local focus=""

  if grep -q 'contacts' <<<"$changed_files"; then
    focus="${focus}
### Contactos
- Crear un contacto nuevo con país y empresa.
- Editar un contacto existente y confirmar que país/empresa se guardan.
- Buscar contactos y validar que los nuevos campos aparecen en listado y detalle.
- Probar importación o sincronización si el cambio la toca."
  fi

  if grep -q 'metrics\|dashboard' <<<"$changed_files"; then
    focus="${focus}
### Métricas y dashboard
- Abrir \`/dashboard\` y \`/metrics\` en develop.
- Cambiar el rango de fechas y confirmar que los KPIs cargan sin error.
- Validar que la card **Mensajes enviados** agrupa por canal y no por agente.
- Comparar totales con datos reales del tenant de prueba."
  fi

  if grep -q 'linear-qa\|\.github/scripts' <<<"$changed_files"; then
    focus="${focus}
### Automatización QA / Linear
- Confirmar que el proyecto **QA Develop** existe en Linear.
- Verificar labels **qa** y **needs-testing**.
- Simular merge a develop y confirmar creación automática del issue."
  fi

  if grep -q 'dynamodb\|sms' <<<"$changed_files"; then
    focus="${focus}
### SMS / DynamoDB
- Enviar o consultar un SMS de prueba si aplica al cambio.
- Revisar historial/DLR y confirmar que no hay errores de tipado en recibos."
  fi

  if [[ -z "$focus" ]]; then
    focus="
### Funcionalidad afectada
- Identificar la pantalla o flujo principal tocado por los archivos cambiados.
- Ejecutar el caso feliz completo de punta a punta.
- Repetir con un usuario distinto o tenant distinto si el cambio es multi-tenant."
  fi

  printf '%s' "$focus"
}

build_qa_issue_description() {
  local context_block="$1"
  local changed_files="$2"
  local develop_frontend_url="$3"
  local testing_focus
  testing_focus="$(qa_testing_focus "$changed_files")"

  cat <<EOF
## Contexto

${context_block}

## Entorno de prueba

- **Ambiente:** develop
- **Frontend:** ${develop_frontend_url}
- **API:** usar el backend de develop desplegado (no localhost, salvo prueba explícita del dev)

### Antes de empezar

1. Confirma que los workflows **Backend** y **Frontend** terminaron en verde para \`develop\`.
2. Inicia sesión con un usuario de prueba del tenant correcto.
3. Limpia caché del navegador o usa ventana privada si ves datos viejos.
4. Anota la hora de inicio y el tenant usado.

## Archivos cambiados

${changed_files}

## Instrucciones de prueba

${testing_focus}

### Validaciones transversales

- Revisar consola del navegador: no deben aparecer errores JS ni requests 4xx/5xx inesperados.
- Probar en desktop y, si aplica, en móvil o ancho reducido.
- Verificar textos en español e inglés si el cambio toca i18n.
- Confirmar que no se rompen flujos vecinos (login, navegación, guardado, listados).

### Evidencia requerida

- Capturas o video corto del flujo probado.
- Pasos numerados: acción → resultado esperado → resultado obtenido.
- Si falla, incluir URL, usuario/tenant, timestamp y mensaje de error.

## Checklist QA

- [ ] Deploy de develop verificado
- [ ] Flujo principal probado con caso feliz
- [ ] Regresiones revisadas en módulos relacionados
- [ ] Evidencia adjunta en este issue
- [ ] Resultado documentado (aprobado / rechazado)
- [ ] Si aprueba: mover a **Done**
- [ ] Si falla: crear bug con pasos de reproducción y enlazar aquí
EOF
}
