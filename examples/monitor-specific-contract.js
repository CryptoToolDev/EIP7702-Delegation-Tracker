/**
 * Monitor Specific Contract for New Authorities
 * 
 * This example monitors BSC network for new authorities delegating to
 * contract address: 0x5a77f0dfc729700300c22e7b0111a5cfbc32431b
 */

const { EIP7702Scanner } = require('../lib/scanner');

// Configuration
const TARGET_CONTRACT = '0x5a77f0dfc729700300c22e7b0111a5cfbc32431b';
const BSC_WS_URL = 'wss://bnb-mainnet.g.alchemy.com/v2/YOUR_API_KEY';
const BSC_RPC_URL = 'https://bnb-mainnet.g.alchemy.com/v2/YOUR_API_KEY';

async function monitorContract() {
  console.log('🔍 EIP-7702 Authority Monitor for Specific Contract');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📜 Target Contract: ${TARGET_CONTRACT}`);
  console.log(`🌐 Network: BSC (Chain ID: 56)`);
  console.log(`🔌 WebSocket: ${BSC_WS_URL.substring(0, 50)}...`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Initialize scanner with custom BSC endpoint
  const scanner = new EIP7702Scanner(
    'bsc',
    BSC_RPC_URL,
    BSC_WS_URL
  );
  
  // Track unique authorities for this contract
  const authorities = new Set();
  const delegationHistory = [];
  let totalDelegations = 0;
  
  // Monitor for delegations
  scanner.on('delegation', (delegation) => {
    // Check if this delegation is to our target contract
    if (delegation.delegatedTo?.toLowerCase() === TARGET_CONTRACT.toLowerCase()) {
      totalDelegations++;
      const isNewAuthority = !authorities.has(delegation.authority);
      
      // Add to tracking
      authorities.add(delegation.authority);
      delegationHistory.push({
        ...delegation,
        timestamp: new Date(delegation.timestamp * 1000),
        isNew: isNewAuthority
      });
      
      // Display delegation
      console.log('═══════════════════════════════════════════════════════════');
      if (isNewAuthority) {
        console.log('🆕 NEW AUTHORITY DETECTED!');
      } else {
        console.log('🔄 EXISTING AUTHORITY RE-DELEGATING');
      }
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`👤 Authority: ${delegation.authority}`);
      console.log(`📍 Transaction: ${delegation.txHash}`);
      console.log(`📦 Block: ${delegation.blockNumber}`);
      console.log(`🔢 Nonce: ${delegation.nonce || 'N/A'}`);
      console.log(`⏰ Time: ${new Date(delegation.timestamp * 1000).toLocaleString()}`);
      console.log('─────────────────────────────────────────────────────────');
      console.log(`📊 Stats: ${authorities.size} unique authorities | ${totalDelegations} total delegations`);
      console.log('═══════════════════════════════════════════════════════════\n');
      
      // Optional: Alert for new authorities
      if (isNewAuthority) {
        handleNewAuthority(delegation.authority, delegation);
      }
    }
  });
  
  // Handle errors
  scanner.on('error', (error) => {
    console.error('❌ Scanner error:', error.message);
    // Optionally implement reconnection logic here
  });
  
  // Connection events
  scanner.on('connected', () => {
    console.log('✅ Connected to BSC network via Alchemy WebSocket\n');
  });
  
  scanner.on('disconnected', () => {
    console.log('⚠️  Disconnected from BSC network, attempting reconnection...\n');
  });
  
  // Start monitoring
  console.log('🚀 Starting real-time monitoring...\n');
  await scanner.watchBlocks();
  
  // Also scan recent blocks for historical data (optional)
  console.log('📜 Scanning last 100 blocks for historical delegations...\n');
  try {
    const currentBlock = await scanner.provider.getBlockNumber();
    const startBlock = currentBlock - 100;
    
    for (let block = startBlock; block <= currentBlock; block++) {
      const delegations = await scanner.scanBlock(block);
      
      delegations.forEach(delegation => {
        if (delegation.delegatedTo?.toLowerCase() === TARGET_CONTRACT.toLowerCase()) {
          if (!authorities.has(delegation.authority)) {
            authorities.add(delegation.authority);
            console.log(`📜 Historical authority found: ${delegation.authority} (Block: ${block})`);
          }
        }
      });
    }
    
    console.log(`\n✅ Historical scan complete. Found ${authorities.size} unique authorities.\n`);
  } catch (error) {
    console.error('Error scanning historical blocks:', error.message);
  }
  
  // Status updates every minute
  setInterval(() => {
    console.log(`⏰ [${new Date().toLocaleTimeString()}] Monitoring... | ${authorities.size} authorities | ${totalDelegations} delegations`);
  }, 60000);
  
  // Keep process running
  process.stdin.resume();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n📊 Final Report:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Contract: ${TARGET_CONTRACT}`);
    console.log(`Network: BSC`);
    console.log(`Total Unique Authorities: ${authorities.size}`);
    console.log(`Total Delegations: ${totalDelegations}`);
    
    if (authorities.size > 0) {
      console.log('\n📋 All Authorities:');
      Array.from(authorities).forEach((auth, index) => {
        console.log(`  ${index + 1}. ${auth}`);
      });
    }
    
    console.log('\nStopping monitor...');
    scanner.stop();
    process.exit(0);
  });
}

// Handler for new authorities (customize as needed)
function handleNewAuthority(authority, delegation) {
  // This is where you would:
  // - Send notifications (email, Discord, Telegram, etc.)
  // - Store in database
  // - Trigger webhooks
  // - Log to file
  // - etc.
  
  console.log('🔔 ALERT: New authority detected!');
  console.log(`   Authority: ${authority}`);
  console.log(`   First delegation TX: ${delegation.txHash}`);
  
  // Example: Send to webhook
  /*
  fetch('https://your-webhook.com/new-authority', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'new_authority',
      contract: TARGET_CONTRACT,
      authority,
      delegation,
      timestamp: Date.now()
    })
  }).catch(console.error);
  */
  
  // Example: Log to file
  /*
  const fs = require('fs');
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: 'new_authority',
    authority,
    txHash: delegation.txHash,
    blockNumber: delegation.blockNumber
  };
  fs.appendFileSync('new-authorities.log', JSON.stringify(logEntry) + '\n');
  */
}

// Run the monitor
monitorContract().catch(error => {
  console.error('Failed to start monitor:', error);
  process.exit(1);
});