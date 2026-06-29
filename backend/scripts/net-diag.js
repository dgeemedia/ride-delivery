// net-diag.js — run with: node scripts/net-diag.js
//
// Tests raw TCP connectivity to Brevo's SMTP ports, independent of
// nodemailer/SMTP protocol logic. Helps tell network/firewall blocking
// apart from SMTP auth or TLS config problems.

const net = require('net');
const tls = require('tls');

const HOST = 'smtp-relay.brevo.com';
const PORTS = [465, 587, 2525]; // 2525 is Brevo's alt port, often unblocked

function testRawTcp(host, port, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = net.createConnection({ host, port });
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ port, ok: false, ms: Date.now() - start, note: 'TCP connect timed out — likely blocked outbound' });
    }, timeoutMs);

    socket.on('connect', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const ms = Date.now() - start;
      socket.end();
      resolve({ port, ok: true, ms, note: 'TCP connected fine' });
    });

    socket.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ port, ok: false, ms: Date.now() - start, note: `TCP error: ${err.code || err.message}` });
    });
  });
}

function testTlsHandshake(host, port, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const start = Date.now();
    let settled = false;

    const socket = tls.connect({ host, port, servername: host, timeout: timeoutMs }, () => {
      if (settled) return;
      settled = true;
      const ms = Date.now() - start;
      socket.end();
      resolve({ port, ok: true, ms, note: 'TLS handshake succeeded (implicit TLS works on this port)' });
    });

    socket.on('timeout', () => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ port, ok: false, ms: Date.now() - start, note: 'TLS handshake timed out' });
    });

    socket.on('error', (err) => {
      if (settled) return;
      settled = true;
      resolve({ port, ok: false, ms: Date.now() - start, note: `TLS error: ${err.code || err.message}` });
    });
  });
}

async function main() {
  console.log(`Testing connectivity to ${HOST} ...\n`);

  for (const port of PORTS) {
    const tcp = await testRawTcp(HOST, port);
    console.log(`[TCP  ] port ${port}: ${tcp.ok ? '✅' : '❌'} (${tcp.ms}ms) — ${tcp.note}`);

    if (tcp.ok && (port === 465 || port === 2525)) {
      const tlsResult = await testTlsHandshake(HOST, port);
      console.log(`[TLS  ] port ${port}: ${tlsResult.ok ? '✅' : '❌'} (${tlsResult.ms}ms) — ${tlsResult.note}`);
    }
    console.log('');
  }

  console.log('--- How to read this ---');
  console.log('• TCP fails on ALL ports        → your network/firewall/ISP is blocking outbound SMTP entirely.');
  console.log('• TCP works but TLS hangs (465)  → middlebox is intercepting the TLS handshake (seen in your last run).');
  console.log('• Port 587 TCP works             → switch to 587 + SMTP_SECURE=false as a workaround.');
  console.log('• Port 2525 works                → Brevo-specific alt port, also a workaround if 465/587 are blocked.');
  console.log('• Everything fails               → likely your local/corporate network blocks this outbound entirely; try a mobile hotspot to confirm, then deploy and test from the actual server (Render) instead.');
}

main();