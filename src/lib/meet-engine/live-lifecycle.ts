/**
 * Live Meet Lifecycle & State Machine
 * Manages official event progress in real-time:
 * SCHEDULED -> CALL_ROOM -> IN_WATER -> UNDER_REVIEW -> OFFICIAL
 * Includes audit logging for last-minute scratches and relay substitutions.
 */

export type EventLiveStatus =
  | 'SCHEDULED' // Programada
  | 'CALL_ROOM' // Cámara de Llamadas
  | 'IN_WATER' // En el Agua
  | 'UNDER_REVIEW' // En Revisión (Mesa Técnica)
  | 'OFFICIAL'; // Resultados Oficiales

export interface EventStatusMetadata {
  status: EventLiveStatus;
  label: string;
  badgeVariant: 'outline' | 'secondary' | 'default' | 'destructive';
  colorClass: string;
}

export const EVENT_STATUS_CONFIG: Record<EventLiveStatus, EventStatusMetadata> = {
  SCHEDULED: {
    status: 'SCHEDULED',
    label: 'Programada',
    badgeVariant: 'outline',
    colorClass: 'text-muted-foreground border-border',
  },
  CALL_ROOM: {
    status: 'CALL_ROOM',
    label: 'Cámara de Llamadas',
    badgeVariant: 'secondary',
    colorClass: 'text-amber-600 bg-amber-500/10 border-amber-500/30',
  },
  IN_WATER: {
    status: 'IN_WATER',
    label: 'En el Agua',
    badgeVariant: 'default',
    colorClass: 'text-primary bg-primary/10 border-primary animate-pulse font-bold',
  },
  UNDER_REVIEW: {
    status: 'UNDER_REVIEW',
    label: 'En Revisión (Mesa)',
    badgeVariant: 'secondary',
    colorClass: 'text-purple-600 bg-purple-500/10 border-purple-500/30',
  },
  OFFICIAL: {
    status: 'OFFICIAL',
    label: 'Oficial',
    badgeVariant: 'default',
    colorClass: 'text-emerald-700 bg-emerald-500/15 border-emerald-500/40 font-bold',
  },
};

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO
  user: string;
  action: 'STATUS_CHANGE' | 'SCRATCH' | 'RELAY_SUB' | 'TIME_OVERRIDE' | 'DQ_APPLIED';
  eventId: string;
  eventNumber?: string;
  heatNumber?: number;
  details: string;
  previousState?: string | null;
  newState?: string | null;
}

export interface LiveScratchRequest {
  meetId: string;
  eventId: string;
  swimmerId?: string;
  swimmerName: string;
  heatNumber: number;
  laneNumber: number;
  reason: string;
  performedBy?: string;
  actorName?: string;
}

export interface LiveRelaySubRequest {
  meetId: string;
  eventId: string;
  relayId: string;
  legNumber: 1 | 2 | 3 | 4;
  outgoingSwimmerName: string;
  incomingSwimmerId?: string;
  incomingSwimmerName: string;
  reason: string;
  performedBy?: string;
  actorName?: string;
}

const AUDIT_STORAGE_KEY = 'swim_lane_coach_live_audit_log';

// In-memory fallback for environments without localStorage
const inMemoryAuditLogs: Record<string, AuditLogEntry[]> = {};

/**
 * Retrieves the persisted live audit log from storage.
 */
export function getLiveAuditLog(meetId: string): AuditLogEntry[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(`${AUDIT_STORAGE_KEY}_${meetId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return inMemoryAuditLogs[meetId] ?? [];
    }
  }
  return inMemoryAuditLogs[meetId] ?? [];
}

/**
 * Appends a new audit log entry with timestamp and actor tracking.
 * Accepts either:
 * - logLiveAuditEvent(meetId, entry)
 * - logLiveAuditEvent({ meetId, actorName, actionType, description, ... })
 */
export function logLiveAuditEvent(
  meetIdOrConfig: string | ({ meetId?: string; actorName?: string; actionType?: string; description?: string } & Partial<AuditLogEntry>),
  maybeEntry?: Omit<AuditLogEntry, 'id' | 'timestamp'>
): AuditLogEntry {
  let targetMeetId = '';
  let payload: Omit<AuditLogEntry, 'id' | 'timestamp'>;

  if (typeof meetIdOrConfig === 'string') {
    targetMeetId = meetIdOrConfig;
    payload = maybeEntry!;
  } else {
    targetMeetId = meetIdOrConfig.meetId ?? 'default_meet';
    payload = {
      user: meetIdOrConfig.actorName ?? meetIdOrConfig.user ?? 'Mesa Técnica',
      action: (meetIdOrConfig.actionType as any) ?? meetIdOrConfig.action ?? 'STATUS_CHANGE',
      eventId: meetIdOrConfig.eventId ?? '',
      details: meetIdOrConfig.description ?? meetIdOrConfig.details ?? '',
      ...(meetIdOrConfig.eventNumber !== undefined ? { eventNumber: meetIdOrConfig.eventNumber } : {}),
      ...(meetIdOrConfig.heatNumber !== undefined ? { heatNumber: meetIdOrConfig.heatNumber } : {}),
      ...(meetIdOrConfig.previousState !== undefined ? { previousState: meetIdOrConfig.previousState } : {}),
      ...(meetIdOrConfig.newState !== undefined ? { newState: meetIdOrConfig.newState } : {}),
    };
  }

  const fullEntry: AuditLogEntry = {
    ...payload,
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };

  const current = getLiveAuditLog(targetMeetId);
  const updated = [fullEntry, ...current].slice(0, 500);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(`${AUDIT_STORAGE_KEY}_${targetMeetId}`, JSON.stringify(updated));
    } catch {
      inMemoryAuditLogs[targetMeetId] = updated;
    }
  } else {
    inMemoryAuditLogs[targetMeetId] = updated;
  }

  return fullEntry;
}

/**
 * Transitions an event along the live lifecycle, recording audit trail.
 */
export function transitionEventStatus(
  meetId: string,
  eventId: string,
  eventNumber: string,
  newStatus: EventLiveStatus,
  previousStatus: EventLiveStatus,
  user: string
): AuditLogEntry {
  const prevLabel = EVENT_STATUS_CONFIG[previousStatus]?.label ?? previousStatus;
  const newLabel = EVENT_STATUS_CONFIG[newStatus]?.label ?? newStatus;

  return logLiveAuditEvent(meetId, {
    action: 'STATUS_CHANGE',
    eventId,
    eventNumber,
    user,
    details: `Prueba ${eventNumber}: cambio de estado de "${prevLabel}" a "${newLabel}".`,
    previousState: previousStatus,
    newState: newStatus,
  });
}

/**
 * Registers a last-minute scratch with traceability.
 */
export function recordLiveScratch(req: LiveScratchRequest): AuditLogEntry {
  const actor = req.performedBy ?? req.actorName ?? 'Mesa Técnica';
  return logLiveAuditEvent(req.meetId, {
    action: 'SCRATCH',
    eventId: req.eventId,
    heatNumber: req.heatNumber,
    user: actor,
    details: `Baja de última hora: ${req.swimmerName} (Serie ${req.heatNumber}, Carril ${req.laneNumber}). Motivo: ${req.reason}.`,
    previousState: 'ACTIVE',
    newState: 'SCRATCHED',
  });
}

/**
 * Registers a last-minute relay leg substitution with traceability.
 */
export function recordLiveRelaySub(req: LiveRelaySubRequest): AuditLogEntry {
  const actor = req.performedBy ?? req.actorName ?? 'Mesa Técnica';
  return logLiveAuditEvent(req.meetId, {
    action: 'RELAY_SUB',
    eventId: req.eventId,
    user: actor,
    details: `Sustitución en relevo posta #${req.legNumber}: sale ${req.outgoingSwimmerName}, entra ${req.incomingSwimmerName}. Motivo: ${req.reason}.`,
    previousState: req.outgoingSwimmerName,
    newState: req.incomingSwimmerName,
  });
}
