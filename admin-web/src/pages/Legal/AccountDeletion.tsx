// admin-web/src/pages/Legal/AccountDeletion.tsx
import React from 'react';

const AccountDeletion: React.FC = () => {
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '48px 24px 80px', fontFamily: 'sans-serif', color: '#1a1a1a', lineHeight: 1.75 }}>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Legal document</p>
      <h1 style={{ fontSize: 32, fontWeight: 600, margin: '0 0 8px' }}>Delete Your Account</h1>
      <p style={{ fontSize: 15, color: '#6b7280', margin: '0 0 40px' }}>
        You can permanently delete your Diakite account and associated personal data at any time.
      </p>

      <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', marginBottom: 40 }} />

      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Option 1 — Delete in the app</h2>
      <ol style={{ fontSize: 15, paddingLeft: 20, marginBottom: 32 }}>
        <li>Open the Diakite app and sign in</li>
        <li>Go to <strong>Profile → Delete Account</strong></li>
        <li>Enter your password and type "DELETE" to confirm</li>
        <li>Your account will be permanently deleted</li>
      </ol>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Option 2 — Request deletion without the app</h2>
      <p style={{ fontSize: 15, marginBottom: 32 }}>
        Email{' '}
        <a href="mailto:privacy@diakiteride.com" style={{ color: '#2563EB' }}>privacy@diakiteride.com</a>{' '}
        from your account's registered email address, with the subject line "Account Deletion Request".
        We will process your request within 7 business days and confirm by email once complete.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>What data is deleted</h2>
      <p style={{ fontSize: 15, marginBottom: 12 }}>The following data is permanently deleted or anonymised:</p>
      <ul style={{ fontSize: 15, paddingLeft: 20, marginBottom: 32 }}>
        <li>Your name, email address, and phone number</li>
        <li>Your profile photo</li>
        <li>Saved addresses and preferences</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>What data is retained</h2>
      <p style={{ fontSize: 15, marginBottom: 32 }}>
        Trip, delivery, and payment records are retained in anonymised form for up to 7 years as required by
        Nigerian financial and tax regulations. This data can no longer be linked back to you once your account
        is deleted. See our{' '}
        <a href="/privacy" style={{ color: '#2563EB' }}>Privacy Policy</a> for full details.
      </p>

      <p style={{ fontSize: 14, color: '#6B7280' }}>
        Questions? Contact us at{' '}
        <a href="mailto:privacy@diakiteride.com" style={{ color: '#2563EB' }}>privacy@diakiteride.com</a>.
      </p>
    </div>
  );
};

export default AccountDeletion;