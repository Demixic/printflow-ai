import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { WORKFLOW_LABELS, type WorkflowStatus } from "@/lib/orders";
import { URGENCY_LABELS, type UrgencyLevel } from "@/lib/priority";

const STATUS_TONES: Record<WorkflowStatus, BadgeTone> = {
  awaiting_artwork: "amber",
  ready_for_press: "teal",
  on_hold: "slate",
  in_production: "accent",
  quality_check: "sky",
  ready_to_ship: "green",
  completed: "neutral",
};

export function StatusBadge({ status }: { status: WorkflowStatus }) {
  return (
    <Badge tone={STATUS_TONES[status]} dot>
      {WORKFLOW_LABELS[status]}
    </Badge>
  );
}

const URGENCY_TONES: Record<UrgencyLevel, BadgeTone> = {
  critical: "red",
  urgent: "amber",
  high: "accent",
  normal: "slate",
};

export function UrgencyBadge({ level }: { level: UrgencyLevel }) {
  return <Badge tone={URGENCY_TONES[level]}>{URGENCY_LABELS[level]}</Badge>;
}
