import React from 'react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '48px 24px 80px', fontFamily: 'sans-serif', color: '#1a1a1a', lineHeight: 1.75 }}>

      {/* Header */}
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Legal document · Version 1.0</p>
      <h1 style={{ fontSize: 32, fontWeight: 600, margin: '0 0 8px' }}>Privacy Policy</h1>
      <p style={{ fontSize: 15, color: '#6b7280', margin: '0 0 40px' }}>
        Effective date: June 14, 2026 · Last updated: June 14, 2026
        <br />
        This policy applies to all Diakite products: ride-hailing, package delivery, and partner services.
      </p>

      <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', marginBottom: 40 }} />

      {/* Plain-language callout */}
      <div style={{ background: '#EFF6FF', borderLeft: '4px solid #3B82F6', borderRadius: 0, padding: '14px 18px', marginBottom: 40, fontSize: 14, color: '#1E40AF' }}>
        <strong>Plain-language summary:</strong> We collect only what we need to match you with drivers or couriers,
        process payments, and keep our platform safe. We never sell your personal data to advertisers.
        You can request a copy of your data, correct it, or delete it at any time.
      </div>

      {/* Table of Contents */}
      <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px 24px', marginBottom: 48 }}>
        <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF', margin: '0 0 14px' }}>Contents</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
          {[
            ['#s1', '1. Who we are'],
            ['#s6', '6. Data sharing'],
            ['#s2', '2. Information we collect'],
            ['#s7', '7. Cookies & tracking'],
            ['#s3', '3. How we use your data'],
            ['#s8', '8. Your rights'],
            ['#s4', '4. Legal bases'],
            ['#s9', "9. Children's privacy"],
            ['#s5', '5. Data retention'],
            ['#s10', '10. Contact us'],
          ].map(([href, label]) => (
            <a key={href} href={href} style={{ fontSize: 14, color: '#2563EB', textDecoration: 'none', lineHeight: 2 }}>{label}</a>
          ))}
        </div>
      </div>

      <Section id="s1" num={1} title="Who we are">
        <p>
          Diakite Technologies Ltd ("Diakite", "we", "us", or "our") operates the Diakite rider app, driver app,
          partner portal, and this administration platform. We are the data controller for personal information
          processed through these products.
        </p>
        <p>
          Our registered office is in Lagos, Nigeria. Where our services extend to other jurisdictions, we comply with
          applicable local data protection laws, including the Nigeria Data Protection Act 2023 (NDPA) and, where
          applicable, the EU General Data Protection Regulation (GDPR).
        </p>
      </Section>

      <Section id="s2" num={2} title="Information we collect">
        <p>
          We collect information in three ways: directly from you, automatically when you use our platform, and
          from third parties such as payment processors and mapping services.
        </p>
        <Table
          headers={['Category', 'Examples', 'Source']}
          rows={[
            ['Account data', 'Full name, email address, phone number, profile photo, date of birth', 'Provided by you at signup'],
            ['Location data', 'Pickup/drop-off coordinates, real-time GPS during trips, home and saved places', 'Device GPS; provided by you'],
            ['Trip & delivery data', 'Route taken, distance, duration, timestamps, fare, item descriptions', 'Automatically collected'],
            ['Payment data', 'Card type and last 4 digits, billing address, transaction IDs', 'Payment processor (we never store full card numbers)'],
            ['Identity verification (drivers/partners)', "Government-issued ID, vehicle registration, driver's licence, insurance, facial biometric check", 'Provided by you; third-party verification service'],
            ['Communications', 'In-app messages, support tickets, call recordings (where disclosed)', 'Collected during interactions'],
            ['Device & usage data', 'IP address, device model, OS version, app version, crash logs', 'Automatically collected'],
            ['Safety data', 'Accelerometer readings during trips, emergency SOS events, incident reports', 'Automatically collected; provided by you'],
          ]}
        />
        <Callout type="warn">
          Location data is collected in the background during an active trip or delivery. You can revoke background
          location permission at any time in your device settings; however, doing so will prevent real-time
          tracking features from working.
        </Callout>
      </Section>

      <Section id="s3" num={3} title="How we use your information">
        <p>
          We use personal information only for the purposes described below. We do not use your data for automated
          profiling that produces legal effects, nor for advertising on behalf of third parties.
        </p>
        <Table
          headers={['Purpose', 'Data used', 'Legal basis']}
          rows={[
            ['Matching you with a driver or courier', 'Location, account data, trip history', 'Contract performance'],
            ['Processing payments and issuing receipts', 'Payment data, trip data', 'Contract performance'],
            ['Verifying driver and partner identities', 'Identity documents, biometric check', 'Legal obligation; legitimate interests'],
            ['Providing customer support', 'Account data, communications, trip data', 'Contract performance'],
            ['Safety monitoring and incident response', 'Location, safety data, device data', 'Legitimate interests; legal obligation'],
            ['Fraud detection and platform integrity', 'Device data, usage data, payment data', 'Legitimate interests'],
            ['Improving our products and algorithms', 'Aggregated, anonymised usage data', 'Legitimate interests'],
            ['Sending service notifications', 'Account data (email/phone)', 'Contract performance'],
            ['Sending optional promotional messages', 'Account data (email/phone)', 'Consent (opt out at any time)'],
            ['Complying with legal and regulatory obligations', 'Any relevant data', 'Legal obligation'],
          ]}
        />
      </Section>

      <Section id="s4" num={4} title="Legal bases for processing">
        <p>Where the GDPR or NDPA applies, we rely on the following legal bases:</p>
        <LegalBasis color="#DBEAFE" textColor="#1E40AF" label="Contract">
          Processing necessary to fulfil your ride or delivery booking and related payment.
        </LegalBasis>
        <LegalBasis color="#D1FAE5" textColor="#065F46" label="Legitimate interests">
          Safety monitoring, fraud prevention, product analytics, and platform abuse prevention — balanced against
          your rights and expectations as a user of a transport service.
        </LegalBasis>
        <LegalBasis color="#FEF3C7" textColor="#92400E" label="Legal obligation">
          Complying with Nigerian transport regulations, tax laws, law-enforcement requests, and court orders.
        </LegalBasis>
        <LegalBasis color="#FEE2E2" textColor="#991B1B" label="Consent">
          Marketing messages, optional location personalisation, and sharing data with optional third-party
          integrations. You may withdraw consent at any time without affecting prior processing.
        </LegalBasis>
      </Section>

      <Section id="s5" num={5} title="Data retention">
        <p>We retain personal data only as long as necessary for the purpose it was collected, or as required by law.</p>
        <Table
          headers={['Data type', 'Retention period']}
          rows={[
            ['Account data (active user)', 'Duration of account + 30 days after deletion request'],
            ['Trip and delivery records', '7 years (financial and tax compliance)'],
            ['Payment transaction records', '7 years (statutory accounting requirements)'],
            ['Identity verification documents (drivers)', 'Duration of active status + 2 years'],
            ['Support communications', '3 years from case closure'],
            ['Location history', '90 days rolling, then aggregated and anonymised'],
            ['Safety incident data', '5 years or until legal proceedings conclude'],
            ['Device and analytics logs', '13 months rolling'],
          ]}
        />
        <p>
          When the retention period expires, data is securely deleted or irreversibly anonymised.
          You may request early deletion subject to our legal obligations (see Section 8).
        </p>
      </Section>

      <Section id="s6" num={6} title="Data sharing and disclosure">
        <p>We do not sell, rent, or trade your personal information. We share data only in the limited circumstances below.</p>
        <p>
          <strong>With drivers and couriers —</strong> When you book, your pickup location, drop-off destination,
          first name, and profile photo are shared with the assigned driver or courier to complete your trip.
        </p>
        <p>
          <strong>With service providers (processors) —</strong> We use carefully vetted sub-processors including
          cloud hosting, payment processing, mapping &amp; routing, SMS/push notifications, identity verification,
          analytics, and customer support tooling. All processors are bound by data processing agreements requiring
          them to process data only on our instructions.
        </p>
        <p>
          <strong>With authorities and for legal compliance —</strong> We may disclose data to Nigerian law
          enforcement, regulatory bodies, or courts when required by a valid legal instrument. Where permitted,
          we will notify you before complying.
        </p>
        <p>
          <strong>In a business transfer —</strong> If Diakite is acquired or merges with another entity, your
          data may be transferred as part of that transaction. We will notify you at least 30 days in advance and
          provide opt-out options where legally possible.
        </p>
        <Callout type="success">
          We never share your data with advertisers or allow third parties to serve targeted ads using your Diakite data.
        </Callout>
      </Section>

      <Section id="s7" num={7} title="Cookies and tracking technologies">
        <p>
          Our web properties (including this admin portal) use cookies and similar technologies for authentication,
          security, and performance monitoring.
        </p>
        <Table
          headers={['Cookie type', 'Purpose', 'Can be disabled?']}
          rows={[
            ['Strictly necessary', 'Session authentication, CSRF protection, load balancing', 'No — required for the site to function'],
            ['Functional', 'Remembering your language and display preferences', 'Yes, via cookie settings'],
            ['Analytics', 'Aggregated usage statistics to improve our services', 'Yes, via cookie settings'],
            ['Security monitoring', 'Bot detection and fraud signals', 'No — required for platform safety'],
          ]}
        />
        <p>
          Our mobile apps do not use browser cookies. Mobile analytics use a resettable advertising identifier
          provided by your device OS, which you can reset or opt out of in your device privacy settings.
        </p>
      </Section>

      <Section id="s8" num={8} title="Your rights">
        <p>
          Depending on your location, you have some or all of the following rights regarding your personal data.
          We will respond to all verified requests within 30 days.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, margin: '20px 0' }}>
          {[
            ['Access', 'Request a copy of the personal data we hold about you.'],
            ['Correction', 'Ask us to correct inaccurate or incomplete data.'],
            ['Deletion', 'Request erasure of your data, subject to legal retention obligations.'],
            ['Portability', 'Receive your data in a structured, machine-readable format.'],
            ['Objection', 'Object to processing based on legitimate interests, including direct marketing.'],
            ['Restriction', 'Request that we limit processing while a dispute is resolved.'],
            ['Withdraw consent', 'Withdraw consent at any time where processing is consent-based.'],
            ['Automated decisions', 'Request human review of any solely automated decision that significantly affects you.'],
          ].map(([title, desc]) => (
            <div key={title} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
              <strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>{title}</strong>
              <p style={{ fontSize: 13, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>{desc}</p>
            </div>
          ))}
        </div>
        <p>
          To exercise any right, email us at{' '}
          <a href="mailto:privacy@diakiteride.com" style={{ color: '#2563EB' }}>privacy@diakiteride.com</a> or use the
          in-app data request form. We may need to verify your identity before processing your request. You also
          have the right to lodge a complaint with the Nigeria Data Protection Commission (NDPC) or a relevant
          supervisory authority in your country.
        </p>
      </Section>

      <Section id="s9" num={9} title="Children's privacy">
        <p>
          Our services are not directed at children under 18 years of age. We do not knowingly collect personal
          information from anyone under 18. If you believe a minor has provided us with personal information,
          please contact us immediately and we will delete it promptly.
        </p>
      </Section>

      <Section id="s10" num={10} title="Contact us">
        <p>
          If you have questions, concerns, or requests about this policy or how we handle your data, please
          email us at{' '}
          <a href="mailto:privacy@diakiteride.com" style={{ color: '#2563EB', fontWeight: 500 }}>privacy@diakiteride.com</a>.
          We will respond to all enquiries within 5 business days.
        </p>
        <p style={{ fontSize: 14, color: '#6B7280', marginTop: 24 }}>
          We may update this policy from time to time. Material changes will be communicated by in-app notification
          and email at least 14 days before taking effect. Continued use of our services after that date
          constitutes acceptance of the updated policy.
        </p>
      </Section>

    </div>
  );
};

/* ──────────────── Helper sub-components ──────────────── */

const Section: React.FC<{ id: string; num: number; title: string; children: React.ReactNode }> = ({ id, num, title, children }) => (
  <div id={id} style={{ marginBottom: 48, scrollMarginTop: 24 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: '#F3F4F6',
        border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#6B7280', flexShrink: 0,
      }}>{num}</div>
      <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{title}</h2>
    </div>
    {children}
  </div>
);

const Table: React.FC<{ headers: string[]; rows: string[][] }> = ({ headers, rows }) => (
  <div style={{ overflowX: 'auto', margin: '16px 0 20px' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr>
          {headers.map(h => (
            <th key={h} style={{ background: '#F9FAFB', padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 13, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6', verticalAlign: 'top', lineHeight: 1.6 }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Callout: React.FC<{ type: 'info' | 'warn' | 'success'; children: React.ReactNode }> = ({ type, children }) => {
  const styles = {
    info:    { bg: '#EFF6FF', border: '#3B82F6', color: '#1E40AF' },
    warn:    { bg: '#FFFBEB', border: '#F59E0B', color: '#92400E' },
    success: { bg: '#ECFDF5', border: '#10B981', color: '#065F46' },
  };
  const s = styles[type];
  return (
    <div style={{ background: s.bg, borderLeft: `4px solid ${s.border}`, padding: '14px 18px', margin: '16px 0 20px', fontSize: 14, color: s.color, lineHeight: 1.7 }}>
      {children}
    </div>
  );
};

const LegalBasis: React.FC<{ color: string; textColor: string; label: string; children: React.ReactNode }> = ({ color, textColor, label, children }) => (
  <p style={{ fontSize: 15, margin: '0 0 12px' }}>
    <span style={{ display: 'inline-block', background: color, color: textColor, fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 6, marginRight: 8, verticalAlign: 'middle' }}>{label}</span>
    {children}
  </p>
);

export default PrivacyPolicy;