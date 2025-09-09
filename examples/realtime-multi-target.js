/**
 * Real-time Multi-Target Monitor
 * 
 * Simple configuration for monitoring multiple contracts across multiple networks
 */

const { MultiNetworkScanner } = require('../lib/index');

// ========================================
// CONFIGURATION - EDIT THIS SECTION
// ========================================

// Networks to monitor (comment/uncomment as needed)
const NETWORKS_TO_MONITOR = [
  'bsc',
  'arbitrum',
  'base',
  // 'optimism',
  // 'polygon'
];

// Target contracts to watch (add as many as you need)
const TARGET_CONTRACTS = [
  '0x02d5251018c6fde7bbef8412585714fa7c1df3ac',
  '0x89046d34e70a65acab2152c26a0c8e493b5ba629',
  '0x5a77f0dfc729700300c22e7b0111a5cfbc32431b',
  // Add more contracts here...
];

// Custom RPC/WebSocket endpoints (optional - leave null to use defaults)
const CUSTOM_ENDPOINTS = {
  arbitrum: {
    rpcUrl: 'https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    wsUrl: 'wss://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY'
  },
  bsc: {
    rpcUrl: 'https://bnb-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    wsUrl: 'wss://bnb-mainnet.g.alchemy.com/v2/YOUR_API_KEY'
  },
  base: {
    rpcUrl: 'https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    wsUrl: 'wss://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY'
  },
  // Add custom endpoints for other networks if needed
  // bsc: { rpcUrl: '...', wsUrl: '...' }
};

// ========================================
// MONITORING CODE (no need to edit below)
// ========================================

async function monitor() {
  // Normalize contract addresses to lowercase
  const targets = TARGET_CONTRACTS.map(c => c.toLowerCase());
  
  console.log('🎯 MULTI-TARGET REAL-TIME MONITOR');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📡 Networks: ${NETWORKS_TO_MONITOR.join(', ')}`);
  console.log(`📜 Watching ${targets.length} contracts:`);
  targets.forEach((contract, i) => {
    console.log(`   ${i + 1}. ${contract}`);
  });
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Initialize scanner
  const scanner = new MultiNetworkScanner(NETWORKS_TO_MONITOR, CUSTOM_ENDPOINTS);
  
  // Track matches
  const matches = new Map();
  targets.forEach(contract => matches.set(contract, []));
  
  let totalSeen = 0;
  let totalMatches = 0;
  
  // Monitor delegations
  scanner.on('delegation', (delegation) => {
    totalSeen++;
    const delegatedTo = delegation.delegatedTo?.toLowerCase();
    
    // Quick status line for non-matches
    if (!targets.includes(delegatedTo)) {
      console.log(`[${delegation.network}] Block ${delegation.blockNumber} - Not a target`);
      return;
    }
    
    // Found a match!
    totalMatches++;
    matches.get(delegatedTo).push({
      network: delegation.network,
      authority: delegation.authority,
      txHash: delegation.txHash,
      block: delegation.blockNumber,
      time: new Date()
    });
    
    console.log('\n' + '🎯'.repeat(30));
    console.log('✅ TARGET CONTRACT MATCH!');
    console.log(`📡 Network: ${delegation.network.toUpperCase()}`);
    console.log(`📜 Contract: ${delegatedTo}`);
    console.log(`👤 Authority: ${delegation.authority}`);
    console.log(`📍 TX: ${delegation.txHash}`);
    console.log(`📦 Block: ${delegation.blockNumber}`);
    console.log(`⏰ Time: ${new Date().toLocaleTimeString()}`);
    console.log(`📊 Match #${totalMatches} (${totalSeen} total delegations seen)`);
    console.log('🎯'.repeat(30) + '\n');
  });
  
  // Error handling
  scanner.on('error', ({ network, error }) => {
    console.error(`[${network}] Error: ${error.message}`);
  });
  
  // Connection status
  scanner.on('connected', ({ network }) => {
    console.log(`✅ [${network}] Connected`);
  });
  
  // Start monitoring
  console.log('🚀 Starting monitors...\n');
  await scanner.startMonitoring();
  
  // Status update every 30 seconds
  setInterval(() => {
    console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Status:`);
    console.log(`   Monitoring: ${NETWORKS_TO_MONITOR.join(', ')}`);
    console.log(`   Total delegations seen: ${totalSeen}`);
    console.log(`   Matches found: ${totalMatches}`);
    
    // Show matches per contract
    if (totalMatches > 0) {
      console.log('   Matches by contract:');
      targets.forEach(contract => {
        const contractMatches = matches.get(contract);
        if (contractMatches.length > 0) {
          console.log(`     ${contract.substring(0, 10)}...: ${contractMatches.length} matches`);
        }
      });
    }
  }, 30000);
  
  // Keep running
  process.stdin.resume();
  
  // Shutdown handler
  process.on('SIGINT', async () => {
    console.log('\n\n📊 FINAL SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total delegations seen: ${totalSeen}`);
    console.log(`Total matches: ${totalMatches}`);
    
    if (totalMatches > 0) {
      console.log('\nMatches by contract:');
      targets.forEach(contract => {
        const contractMatches = matches.get(contract);
        if (contractMatches.length > 0) {
          console.log(`\n${contract}:`);
          contractMatches.forEach((m, i) => {
            console.log(`  ${i + 1}. [${m.network}] ${m.authority} (Block ${m.block})`);
          });
        }
      });
    }
    
    console.log('\nStopping monitors...');
    await scanner.stopMonitoring();
    process.exit(0);
  });
}

// Run
monitor().catch(console.error);