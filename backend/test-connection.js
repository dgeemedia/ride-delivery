/**
 * Supabase Connection Diagnostic Script
 * Run: node test-connection.js
 * Place this file in your /backend folder
 */

const net = require("net");
const { execSync } = require("child_process");
require("dotenv").config();

const TESTS = [
  {
    label: "Supabase Pooler (port 6543) — main connection",
    host: "aws-1-us-east-1.pooler.supabase.com",
    port: 6543,
  },
  {
    label: "Supabase Direct (port 5432) — migration connection",
    host: "db.ganrqdbgcqatlbkitaqh.supabase.co",
    port: 5432,
  },
  {
    label: "DNS check — pooler host",
    host: "aws-1-us-east-1.pooler.supabase.com",
    port: null,
    dnsOnly: true,
  },
];

const TIMEOUT_MS = 5000;

function testTCP(host, port) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();

    socket.setTimeout(TIMEOUT_MS);

    socket.connect(port, host, () => {
      const ms = Date.now() - start;
      socket.destroy();
      resolve({ success: true, ms });
    });

    socket.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ success: false, error: `Timed out after ${TIMEOUT_MS}ms` });
    });
  });
}

function testDNS(host) {
  try {
    const result = execSync(`nslookup ${host}`, { timeout: 5000 }).toString();
    const hasAddress = result.includes("Address") && !result.includes("can't find");
    return { success: hasAddress, output: result.trim() };
  } catch (e) {
    return { success: false, output: e.message };
  }
}

function checkEnv() {
  console.log("\n📋 ENV CHECK");
  console.log("─".repeat(50));
  const dbUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;

  if (!dbUrl) {
    console.log("  ❌ DATABASE_URL — NOT FOUND in .env");
  } else {
    const masked = dbUrl.replace(/:([^@]+)@/, ":****@");
    console.log(`  ✅ DATABASE_URL — ${masked}`);
  }

  if (!directUrl) {
    console.log("  ⚠️  DIRECT_URL  — NOT FOUND (optional but recommended)");
  } else {
    const masked = directUrl.replace(/:([^@]+)@/, ":****@");
    console.log(`  ✅ DIRECT_URL  — ${masked}`);
  }
}

async function runAll() {
  console.log("\n🔍 SUPABASE CONNECTION DIAGNOSTICS");
  console.log("=".repeat(50));

  checkEnv();

  console.log("\n🌐 NETWORK TESTS");
  console.log("─".repeat(50));

  for (const test of TESTS) {
    process.stdout.write(`  Testing: ${test.label} ... `);

    if (test.dnsOnly) {
      const result = testDNS(test.host);
      if (result.success) {
        console.log("✅ DNS resolved");
      } else {
        console.log(`❌ DNS FAILED\n     → ${result.output}`);
      }
      continue;
    }

    const result = await testTCP(test.host, test.port);
    if (result.success) {
      console.log(`✅ Connected in ${result.ms}ms`);
    } else {
      console.log(`❌ FAILED — ${result.error}`);
    }
  }

  console.log("\n💡 DIAGNOSIS");
  console.log("─".repeat(50));
  console.log("  If port 6543 ✅ but push is slow → Supabase project may be PAUSED");
  console.log("  If port 6543 ❌ → Firewall/VPN is blocking outbound connections");
  console.log("  If DNS ❌       → Network/DNS resolver issue");
  console.log("  If port 5432 ❌ → Normal — ISPs block direct Postgres, use 6543");
  console.log("\n  🔗 To wake a paused project: https://supabase.com/dashboard/projects");
  console.log("=".repeat(50) + "\n");
}

runAll();