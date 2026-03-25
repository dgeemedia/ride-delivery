// admin-web/src/utils/notificationRouter.ts
//
// Maps every notification type + its data payload to the correct admin route.
// Used by both the bell dropdown and the full notifications page so the
// routing logic lives in exactly one place.

export interface NotificationData {
  rideId?:          string;
  deliveryId?:      string;
  driverProfileId?: string;
  partnerProfileId?: string;
  ticketId?:        string;
  ticketNumber?:    string;
  companyId?:       string;
  accountId?:       string;
  userId?:          string;
  [key: string]:    unknown;
}

/**
 * Returns the admin route to navigate to when a notification is clicked.
 * Returns null for generic notifications with no specific destination.
 */
export const getNotificationRoute = (
  type: string,
  data: NotificationData = {}
): string | null => {
  switch (type) {
    // ── Rides ──────────────────────────────────────────────────────────────
    case 'ride_requested':
    case 'ride_accepted':
    case 'ride_arrived':
    case 'ride_started':
    case 'ride_completed':
    case 'ride_cancelled':
      return data.rideId ? `/rides/${data.rideId}` : '/rides';

    // ── Deliveries ─────────────────────────────────────────────────────────
    case 'delivery_requested':
    case 'delivery_assigned':
    case 'delivery_picked_up':
    case 'delivery_in_transit':
    case 'delivery_completed':
    case 'delivery_cancelled':
      return data.deliveryId ? `/deliveries/${data.deliveryId}` : '/deliveries';

    // ── Driver approval ────────────────────────────────────────────────────
    case 'driver_approved':
    case 'driver_rejected':
      return data.driverProfileId
        ? `/drivers/${data.driverProfileId}`
        : '/drivers/pending';

    // ── Partner approval ───────────────────────────────────────────────────
    case 'partner_approved':
    case 'partner_rejected':
      return data.partnerProfileId
        ? `/partners/${data.partnerProfileId}`
        : '/partners/pending';

    // ── Support tickets ────────────────────────────────────────────────────
    case 'ticket_resolved':
    case 'ticket_reply':
      return data.ticketId
        ? `/support/tickets/${data.ticketId}`
        : '/support/tickets';

    // ── SHIELD ─────────────────────────────────────────────────────────────
    case 'shield_auto_activated':
    case 'shield_activated':
    case 'shield_deactivated':
      return '/shield';

    // ── Corporate ──────────────────────────────────────────────────────────
    case 'corporate_registered':
    case 'corporate_activated':
    case 'corporate_suspended':
      return data.companyId ? `/corporate/${data.companyId}` : '/corporate';

    // ── DuoPay ─────────────────────────────────────────────────────────────
    case 'duopay_activated':
    case 'duopay_suspended':
    case 'duopay_defaulted':
    case 'duopay_waived':
    case 'duopay_reactivated':
    case 'duopay_limit_upgrade':
      return '/duopay/defaults';

    case 'duopay_repayment':
      return '/duopay';

    // ── Payments / wallet ──────────────────────────────────────────────────
    case 'payment_received':
    case 'payment_refunded':
    case 'wallet_credited':
    case 'wallet_debited':
      return data.userId ? `/users/${data.userId}` : '/payments';

    // ── Account management ─────────────────────────────────────────────────
    case 'account_suspended':
    case 'account_activated':
      return data.userId ? `/users/${data.userId}` : '/users';

    // ── Driver / partner onboarding ────────────────────────────────────────
    case 'onboarding_bonus':
      return data.userId ? `/users/${data.userId}` : '/users';

    // ── Broadcasts — no specific destination ───────────────────────────────
    case 'admin_broadcast':
    default:
      return null;
  }
};

/** Returns a human-friendly label for a notification type (for the filter UI). */
export const getTypeLabel = (type: string): string => {
  const map: Record<string, string> = {
    ride_completed:      'Ride completed',
    ride_cancelled:      'Ride cancelled',
    ride_requested:      'New ride request',
    delivery_completed:  'Delivery completed',
    delivery_cancelled:  'Delivery cancelled',
    driver_approved:     'Driver approved',
    driver_rejected:     'Driver rejected',
    partner_approved:    'Partner approved',
    partner_rejected:    'Partner rejected',
    ticket_reply:        'Ticket reply',
    ticket_resolved:     'Ticket resolved',
    shield_auto_activated: 'SHIELD activated',
    corporate_registered:  'Corporate registered',
    corporate_activated:   'Corporate activated',
    corporate_suspended:   'Corporate suspended',
    duopay_suspended:      'DuoPay suspended',
    duopay_waived:         'DuoPay waived',
    payment_received:      'Payment received',
    account_suspended:     'Account suspended',
    account_activated:     'Account activated',
    admin_broadcast:       'Broadcast',
  };
  return map[type] ?? type.replace(/_/g, ' ');
};

/** Returns a Tailwind color class pair for a notification type. */
export const getTypeBadgeColor = (type: string): { bg: string; text: string } => {
  if (type.startsWith('ride_'))         return { bg: 'bg-blue-100',   text: 'text-blue-700'   };
  if (type.startsWith('delivery_'))     return { bg: 'bg-purple-100', text: 'text-purple-700' };
  if (type.startsWith('driver_'))       return { bg: 'bg-amber-100',  text: 'text-amber-700'  };
  if (type.startsWith('partner_'))      return { bg: 'bg-orange-100', text: 'text-orange-700' };
  if (type.startsWith('ticket_'))       return { bg: 'bg-teal-100',   text: 'text-teal-700'   };
  if (type.startsWith('shield_'))       return { bg: 'bg-green-100',  text: 'text-green-700'  };
  if (type.startsWith('corporate_'))    return { bg: 'bg-indigo-100', text: 'text-indigo-700' };
  if (type.startsWith('duopay_'))       return { bg: 'bg-emerald-100',text: 'text-emerald-700'};
  if (type.startsWith('payment_') || type.startsWith('wallet_'))
                                        return { bg: 'bg-green-100',  text: 'text-green-700'  };
  if (type.startsWith('account_'))      return { bg: 'bg-red-100',    text: 'text-red-700'    };
  return                                       { bg: 'bg-gray-100',   text: 'text-gray-600'   };
};