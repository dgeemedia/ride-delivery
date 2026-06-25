// backend/src/services/termii.service.js
//
// Termii SMS delivery — fills the gap referenced by otp.service.js
// (`termiiService.send(...)`) which was never implemented.
'use strict';

const TERMII_API_KEY   = process.env.TERMII_API_KEY;
const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID ?? 'Diakite';
const TERMII_BASE_URL  = 'https://api.ng.termii.com/api/sms/send';

if (!TERMII_API_KEY) {
  console.warn(
    '[termii.service] WARNING: TERMII_API_KEY is not set.\n' +
    '  SMS delivery will fail until this is configured in your .env file.'
  );
}

/**
 * Send an SMS via Termii.
 * @param {string} to - Phone number in international format, e.g. 2348012345678
 * @param {string} message - Message body
 */
exports.send = async (to, message) => {
  if (!TERMII_API_KEY) {
    throw new Error(
      'SMS delivery is not configured on this server. ' +
      'Please contact support or try again later.'
    );
  }

  // Termii expects numbers without a leading "+", e.g. 2348012345678
  const normalizedTo = to.replace(/^\+/, '');

  let response;
  try {
    response = await fetch(TERMII_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to:        normalizedTo,
        from:      TERMII_SENDER_ID,
        sms:       message,
        type:      'plain',
        api_key:   TERMII_API_KEY,
        channel:   'generic',
      }),
    });
  } catch (err) {
    console.error('[termii.service] Network error calling Termii:', err.message);
    throw new Error('Could not reach SMS provider. Please try again shortly.');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Unexpected response from SMS provider.');
  }

  if (!response.ok || data.code === 'ERROR' || data.message_id === undefined) {
    console.error('[termii.service] Termii send failed:', data);
    throw new Error(data?.message ?? 'Failed to send SMS.');
  }

  return data;
};