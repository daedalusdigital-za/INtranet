import { NotificationEvent, ShipmentFilter, ShipmentStatus } from './models';

/** What the client sees. Internal statuses are folded into client-friendly ones. */
export const STATUS_LABEL: Record<ShipmentStatus, string> = {
  BOOKED: 'Waiting for confirmation',
  CONFIRMED: 'Confirmed',
  PLANNED: 'Scheduled for collection',
  WAYBILL_ISSUED: 'Scheduled for collection',
  COLLECTED: 'Collected',
  IN_TRANSIT: 'On the road',
  ARRIVING: 'Arriving soon',
  DELIVERED: 'Delivered',
  COLLECTION_FAILED: 'Collection missed',
  DELIVERY_FAILED: 'Delivery attempt failed',
  REJECTED: 'Declined',
  CANCELLED: 'Cancelled',
};

export type StatusTone = 'neutral' | 'info' | 'moving' | 'done' | 'problem' | 'closed';

export const STATUS_TONE: Record<ShipmentStatus, StatusTone> = {
  BOOKED: 'neutral',
  CONFIRMED: 'info',
  PLANNED: 'info',
  WAYBILL_ISSUED: 'info',
  COLLECTED: 'moving',
  IN_TRANSIT: 'moving',
  ARRIVING: 'moving',
  DELIVERED: 'done',
  COLLECTION_FAILED: 'problem',
  DELIVERY_FAILED: 'problem',
  REJECTED: 'closed',
  CANCELLED: 'closed',
};

/** Stages on the route strip, in order. */
export const STAGES = ['Booked', 'Confirmed', 'Collected', 'On the road', 'Delivered'] as const;

export function stageIndex(s: ShipmentStatus): number {
  switch (s) {
    case 'BOOKED': return 0;
    case 'CONFIRMED': case 'PLANNED': case 'WAYBILL_ISSUED': case 'COLLECTION_FAILED': return 1;
    case 'COLLECTED': return 2;
    case 'IN_TRANSIT': case 'ARRIVING': case 'DELIVERY_FAILED': return 3;
    case 'DELIVERED': return 4;
    default: return -1;
  }
}

export const FILTER_STATUSES: Record<ShipmentFilter, ShipmentStatus[] | null> = {
  active: ['BOOKED', 'CONFIRMED', 'PLANNED', 'WAYBILL_ISSUED', 'COLLECTED', 'IN_TRANSIT', 'ARRIVING', 'COLLECTION_FAILED', 'DELIVERY_FAILED'],
  awaiting: ['BOOKED'],
  scheduled: ['CONFIRMED', 'PLANNED', 'WAYBILL_ISSUED'],
  onTheRoad: ['COLLECTED', 'IN_TRANSIT', 'ARRIVING'],
  attention: ['COLLECTION_FAILED', 'DELIVERY_FAILED'],
  delivered: ['DELIVERED'],
  closed: ['REJECTED', 'CANCELLED'],
  all: null,
};

export const NOTIFICATION_LABEL: Record<NotificationEvent, string> = {
  BOOKED: 'We receive your booking',
  CONFIRMED: 'We confirm your booking',
  REJECTED: 'We decline a booking',
  COLLECTED: 'Your goods are collected',
  ARRIVING: 'The truck is close to the delivery address',
  DELIVERED: 'Your goods are delivered (proof of delivery attached)',
  PROBLEM: 'A collection or delivery fails',
  CANCELLED: 'A shipment is cancelled',
};
