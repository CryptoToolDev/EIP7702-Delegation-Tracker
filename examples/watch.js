/**
 * Example: Real-time monitoring of EIP-7702 delegations
 * 
 * This example demonstrates how to watch for new delegation setup transactions in real-time
 */

const { EIP7702Scanner } = require('../lib/scanner');

async function main() {
  // Get RPC URL from environment or use example
  const rpcUrl = process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY';
  const wsUrl = process.env.ETHEREUM_WS_URL; // Optional WebSocket URL
  
  if (rpcUrl.includes('YOUR_API_KEY')) {
    console.error('❌ Please provide a valid RPC URL');
    console.error('   Set ETHEREUM_RPC_URL environment variable or update the rpcUrl in this file');
    process.exit(1);
  }
  
  // Initialize scanner for Ethereum mainnet
  // You can change to 'bsc', 'arbitrum', 'base', 'optimism', or 'polygon'
  const scanner = new EIP7702Scanner('ethereum', rpcUrl, wsUrl);
  
  console.log('👁️  Starting real-time EIP-7702 delegation monitoring...\n');
  console.log('Network: Ethereum');
  console.log('Press Ctrl+C to stop\n');
  
  // Statistics
  let totalDelegations = 0;
  const authorities = new Set();
  const delegatedContracts = new Set();
  
  // Handle new delegations
  scanner.on('delegation', (delegation) => {
    totalDelegations++;
    authorities.add(delegation.authority);
    delegatedContracts.add(delegation.delegatedTo);
    
    console.log('═══════════════════════════════════════════════════════');
    console.log(`🆕 NEW DELEGATION #${totalDelegations}`);
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📍 Transaction: ${delegation.txHash}`);
    console.log(`📦 Block: ${delegation.blockNumber}`);
    console.log(`👤 Authority: ${delegation.authority}`);
    console.log(`📜 Delegated to: ${delegation.delegatedTo}`);
    console.log(`🔢 Nonce: ${delegation.nonce || 'N/A'}`);
    console.log(`⏰ Timestamp: ${new Date(delegation.timestamp * 1000).toLocaleString()}`);
    console.log('─────────────────────────────────────────────────────────');
    console.log(`📊 Stats: ${totalDelegations} total | ${authorities.size} unique authorities | ${delegatedContracts.size} unique contracts`);
    console.log('═══════════════════════════════════════════════════════\n');
  });
  
  // Handle errors
  scanner.on('error', (error) => {
    console.error('❌ Scanner error:', error.message);
  });
  
  // Handle connection events
  scanner.on('connected', () => {
    console.log('✅ Connected to network\n');
  });
  
  scanner.on('disconnected', () => {
    console.log('⚠️  Disconnected from network, attempting to reconnect...\n');
  });
  
  try {
    // Start monitoring
    await scanner.startMonitoring();
    
    // Keep the process running
    process.stdin.resume();
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n📊 Final Statistics:');
      console.log(`Total delegations detected: ${totalDelegations}`);
      console.log(`Unique authorities: ${authorities.size}`);
      console.log(`Unique delegated contracts: ${delegatedContracts.size}`);
      
      console.log('\nStopping monitor...');
      await scanner.stopMonitoring();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start monitoring:', error);
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);