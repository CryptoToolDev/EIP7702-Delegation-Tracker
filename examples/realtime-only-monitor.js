/**
 * Real-time Only Monitor for Specific Contract
 * 
 * This example ONLY monitors real-time delegations (no historical scanning)
 * Target contract: 0x5a77f0dfc729700300c22e7b0111a5cfbc32431b on BSC
 */

const { EIP7702Scanner } = require('../lib/scanner');

// Configuration
const TARGET_CONTRACT = '0x89046d34e70a65acab2152c26a0c8e493b5ba629';
const BSC_WS_URL = 'wss://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY';
const BSC_RPC_URL = 'https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY';

async function monitorRealtime() {
  console.log('🔴 REAL-TIME ONLY MONITOR');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📜 Target Contract: ${TARGET_CONTRACT}`);
  console.log(`🌐 Network: Arbitrum`);
  console.log(`🔌 WebSocket: Alchemy`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Initialize scanner - using 'arbitrum' network with Arbitrum URLs
  const scanner = new EIP7702Scanner('arbitrum', BSC_RPC_URL, BSC_WS_URL);
  
  // Track authorities
  const authorities = new Set();
  let count = 0;
  
  // Monitor ONLY real-time delegations
  scanner.on('delegation', (delegation) => {
    console.log(`\n⚡ REAL-TIME EVENT: Block ${delegation.blockNumber}`);
    
    // Check if it's for our target contract
    if (delegation.delegatedTo?.toLowerCase() === TARGET_CONTRACT.toLowerCase()) {
      count++;
      const isNew = !authorities.has(delegation.authority);
      authorities.add(delegation.authority);
      
      console.log('✅ MATCH FOUND!');
      console.log(`👤 Authority: ${delegation.authority} ${isNew ? '(NEW!)' : '(existing)'}`);
      console.log(`📍 TX: ${delegation.txHash}`);
      console.log(`📊 Count: ${count} delegations | ${authorities.size} unique authorities`);
    } else {
      console.log(`❌ Different contract: ${delegation.delegatedTo}`);
    }
  });
  
  scanner.on('error', (error) => {
    console.error('❌ Error:', error.message);
  });
  
  scanner.on('connected', () => {
    console.log('✅ WebSocket connected\n');
    console.log('👀 Watching for NEW blocks only (no historical scan)...\n');
  });
  
  // Start watching blocks
  console.log('🚀 Starting real-time monitoring...');
  await scanner.watchBlocks();
  
  // Status ping every 30 seconds
  setInterval(() => {
    console.log(`⏰ [${new Date().toLocaleTimeString()}] Still watching... | ${count} matches found`);
  }, 30000);
  
  // Keep running
  process.stdin.resume();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nStopping...');
    scanner.stop();
    process.exit(0);
  });
}

// Run
monitorRealtime().catch(console.error);