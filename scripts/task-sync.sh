#!/usr/bin/env bash

set -euo pipefail

TASKS_FILE="${TASKS_FILE:-tasks.txt}"
TASK_ID_PATTERN='T-[0-9][0-9][0-9]'

usage() {
  cat <<'EOF'
Usage:
  scripts/task-sync.sh create <task-id>
  scripts/task-sync.sh start <task-id>
  scripts/task-sync.sh block <task-id> <reason>
  scripts/task-sync.sh review <task-id> [pr-number]
  scripts/task-sync.sh done <task-id> [pr-number]
  scripts/task-sync.sh show <task-id>

GitHub Issues are canonical. tasks.txt is the local agent queue/cache.
This script uses gh to create, label, and close issues while keeping tasks.txt
in sync with the local task state.
EOF
}

die() {
  echo "error: $*" >&2
  exit 1
}

require_file() {
  [[ -f "$TASKS_FILE" ]] || die "missing $TASKS_FILE"
}

require_gh() {
  command -v gh >/dev/null 2>&1 || die "gh CLI is required"
}

today() {
  date +%F
}

task_exists() {
  grep -Eq "^- \[[^]]\] $1 " "$TASKS_FILE"
}

task_title() {
  awk -v task="$1" '
    $0 ~ "^- \\[[^]]\\] " task " " {
      sub("^- \\[[^]]\\] " task " ", "", $0)
      print $0
      exit
    }
  ' "$TASKS_FILE"
}

task_field() {
  awk -v task="$1" -v field="$2" -v task_id_pattern="$TASK_ID_PATTERN" '
    function is_task_header(line, pattern) {
      pattern = "^- \\[[^]]\\] " task_id_pattern " "
      return line ~ pattern
    }

    $0 ~ "^- \\[[^]]\\] " task " " { in_task=1; next }
    in_task && ($0 ~ "^## " || is_task_header($0)) { in_task=0 }
    in_task && $0 ~ "^  " field ":" {
      sub("^  " field ": ?", "", $0)
      print $0
      exit
    }
  ' "$TASKS_FILE"
}

extract_task_block() {
  awk -v task="$1" -v task_id_pattern="$TASK_ID_PATTERN" '
    function is_task_header(line, pattern) {
      pattern = "^- \\[[^]]\\] " task_id_pattern " "
      return line ~ pattern
    }

    $0 ~ "^- \\[[^]]\\] " task " " {
      in_task=1
    }

    in_task && ($0 ~ "^## " || (is_task_header($0) && $0 !~ "^- \\[[^]]\\] " task " ")) {
      exit
    }

    in_task {
      print
    }
  ' "$TASKS_FILE"
}

rewrite_file() {
  local tmp
  tmp="$(mktemp)"
  cat >"$tmp"
  mv "$tmp" "$TASKS_FILE"
}

update_field() {
  local task_id="$1"
  local field="$2"
  local value="$3"

  awk -v task="$task_id" -v field="$field" -v value="$value" -v task_id_pattern="$TASK_ID_PATTERN" '
    function is_task_header(line, pattern) {
      pattern = "^- \\[[^]]\\] " task_id_pattern " "
      return line ~ pattern
    }

    $0 ~ "^- \\[[^]]\\] " task " " { in_task=1 }
    in_task && ($0 ~ "^## " || (is_task_header($0) && $0 !~ "^- \\[[^]]\\] " task " ")) {
      in_task=0
    }

    if (in_task && $0 ~ "^  " field ":") {
      print "  " field ": " value
      next
    }

    print
  ' "$TASKS_FILE" | rewrite_file
}

update_checkbox() {
  local task_id="$1"
  local marker="$2"

  awk -v task="$task_id" -v marker="$marker" '
    $0 ~ "^- \\[[^]]\\] " task " " {
      sub("^- \\[[^]]\\]", "- [" marker "]", $0)
    }
    { print }
  ' "$TASKS_FILE" | rewrite_file
}

slugify() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
}

find_existing_issue() {
  local title="$1"

  gh issue list \
    --state all \
    --search "\"$title\" in:title" \
    --limit 20 \
    --json number,title \
    --jq ".[] | select(.title == \"$title\") | .number" \
    | head -n1
}

render_issue_body() {
  local task_id="$1"
  local title="$2"
  local status priority files blocked_reason

  status="$(task_field "$task_id" status)"
  priority="$(task_field "$task_id" priority)"
  files="$(extract_task_block "$task_id" | awk '/^  files:/{flag=1;next}/^  acceptance:/{flag=0}flag')"
  blocked_reason="$(task_field "$task_id" blocked_reason)"

  {
    echo "Task ID: $task_id"
    echo
    echo "Local tracker: \`tasks.txt\`"
    echo
    echo "Status: ${status:-todo}"
    echo "Priority: ${priority:-medium}"
    if [[ -n "${blocked_reason:-}" ]]; then
      echo "Blocked reason: $blocked_reason"
    fi
    echo
    echo "## Summary"
    echo
    echo "$title"
    echo
    echo "## Acceptance"
    extract_task_block "$task_id" | awk '/^  acceptance:/{flag=1;next}flag{print substr($0,3)}'
    if [[ -n "${files:-}" ]]; then
      echo
      echo "## Likely Files"
      echo "$files" | sed 's/^  //'
    fi
  }
}

ensure_issue() {
  local task_id="$1"
  local title issue_number existing body_file

  issue_number="$(task_field "$task_id" github)"
  if [[ -n "${issue_number:-}" ]]; then
    issue_number="${issue_number#\#}"
    echo "$issue_number"
    return
  fi

  require_gh
  title="$task_id $(task_title "$task_id")"
  existing="$(find_existing_issue "$title")"
  if [[ -n "${existing:-}" ]]; then
    issue_number="$existing"
  else
    body_file="$(mktemp)"
    render_issue_body "$task_id" "$(task_title "$task_id")" >"$body_file"
    issue_number="$(gh issue create \
      --title "$title" \
      --body-file "$body_file" \
      --label "codex" \
      --label "task")"
    issue_number="${issue_number##*/}"
    rm -f "$body_file"
  fi

  update_field "$task_id" github "#$issue_number"
  update_field "$task_id" last_updated "$(today)"
  echo "$issue_number"
}

mark_in_section_done() {
  local task_id="$1"
  local completed="$2"
  local block tmp_block without_block

  tmp_block="$(mktemp)"
  without_block="$(mktemp)"
  extract_task_block "$task_id" >"$tmp_block"

  awk -v task="$task_id" -v task_id_pattern="$TASK_ID_PATTERN" '
    function is_task_header(line, pattern) {
      pattern = "^- \\[[^]]\\] " task_id_pattern " "
      return line ~ pattern
    }

    $0 ~ "^- \\[[^]]\\] " task " " {
      in_task=1
      next
    }

    in_task && ($0 ~ "^## " || (is_task_header($0) && $0 !~ "^- \\[[^]]\\] " task " ")) {
      in_task=0
    }

    !in_task { print }
  ' "$TASKS_FILE" >"$without_block"

  awk -v block_file="$tmp_block" '
    BEGIN {
      while ((getline line < block_file) > 0) {
        block = block line "\n"
      }
      close(block_file)
    }

    {
      print
      if ($0 == "## Done") {
        printf "%s", block
      }
    }
  ' "$without_block" | rewrite_file

  rm -f "$tmp_block" "$without_block"
  update_field "$task_id" completed "$completed"
}

create_issue_cmd() {
  local task_id="$1"
  ensure_issue "$task_id" >/dev/null
}

start_cmd() {
  local task_id="$1"
  local issue_number title slug branch

  issue_number="$(ensure_issue "$task_id")"
  title="$(task_title "$task_id")"
  slug="$(slugify "$title")"
  branch="codex/${task_id}-${slug}"

  gh issue edit "$issue_number" --add-label "in-progress" >/dev/null
  update_checkbox "$task_id" "~"
  update_field "$task_id" status "in_progress"
  update_field "$task_id" owner "codex"
  update_field "$task_id" branch "$branch"
  update_field "$task_id" last_updated "$(today)"
}

block_cmd() {
  local task_id="$1"
  local reason="$2"
  local issue_number

  issue_number="$(ensure_issue "$task_id")"
  gh issue edit "$issue_number" --add-label "blocked" >/dev/null
  update_checkbox "$task_id" "~"
  update_field "$task_id" status "blocked"
  update_field "$task_id" blocked_reason "$reason"
  update_field "$task_id" last_updated "$(today)"
}

review_cmd() {
  local task_id="$1"
  local pr_number="${2:-}"
  local issue_number

  issue_number="$(ensure_issue "$task_id")"
  gh issue edit "$issue_number" --add-label "review" >/dev/null
  update_checkbox "$task_id" "~"
  update_field "$task_id" status "review"
  update_field "$task_id" pr "${pr_number:-}"
  update_field "$task_id" blocked_reason ""
  update_field "$task_id" last_updated "$(today)"
}

done_cmd() {
  local task_id="$1"
  local pr_number="${2:-}"
  local issue_number comment

  issue_number="$(ensure_issue "$task_id")"
  comment="Completed by Codex."
  if [[ -n "${pr_number:-}" ]]; then
    comment="$comment See PR #$pr_number."
  fi

  gh issue close "$issue_number" --reason completed --comment "$comment" >/dev/null
  update_checkbox "$task_id" "x"
  update_field "$task_id" status "done"
  update_field "$task_id" pr "${pr_number:-}"
  update_field "$task_id" blocked_reason ""
  update_field "$task_id" last_updated "$(today)"
  mark_in_section_done "$task_id" "$(today)"
}

show_cmd() {
  extract_task_block "$1"
}

main() {
  local command="${1:-}"
  local task_id="${2:-}"

  require_file

  case "$command" in
    create|start|block|review|done|show) ;;
    ""|-h|--help|help)
      usage
      exit 0
      ;;
    *)
      usage
      die "unknown command: $command"
      ;;
  esac

  [[ -n "$task_id" ]] || die "missing task id"
  task_exists "$task_id" || die "task not found: $task_id"

  case "$command" in
    create)
      create_issue_cmd "$task_id"
      ;;
    start)
      start_cmd "$task_id"
      ;;
    block)
      [[ $# -ge 3 ]] || die "missing blocked reason"
      block_cmd "$task_id" "${*:3}"
      ;;
    review)
      review_cmd "$task_id" "${3:-}"
      ;;
    done)
      done_cmd "$task_id" "${3:-}"
      ;;
    show)
      show_cmd "$task_id"
      ;;
  esac
}

main "$@"
