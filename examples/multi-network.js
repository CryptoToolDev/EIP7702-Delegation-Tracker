/**
 * Multi-Network Monitoring Example
 * 
 * Shows how to monitor multiple networks simultaneously
 */

const { MultiNetworkScanner } = require('../lib/index');

async function main() {
  console.log('🌐 Multi-Network EIP-7702 Delegation Monitor\n');
  
  // Configure RPC endpoints (REQUIRED for each network)
  const rpcConfig = {
    ethereum: {
      rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
      wsUrl: process.env.ETHEREUM_WS_URL // Optional
    },
    bsc: {
      rpcUrl: process.env.BSC_RPC_URL || 'https://bnb-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
      wsUrl: process.env.BSC_WS_URL // Optional
    },
    arbitrum: {
      rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
      wsUrl: process.env.ARBITRUM_WS_URL // Optional
    },
    base: {
      rpcUrl: process.env.BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
      wsUrl: process.env.BASE_WS_URL // Optional
    }
  };
  
  // Check if any RPC URLs need configuration
  const needsConfig = Object.entries(rpcConfig).some(([network, config]) => 
    config.rpcUrl.includes('YOUR_API_KEY')
  );
  
  if (needsConfig) {
    console.error('❌ Please provide valid RPC URLs for all networks');
    console.error('   Set environment variables or update the rpcConfig in this file');
    console.error('   Required: ETHEREUM_RPC_URL, BSC_RPC_URL, ARBITRUM_RPC_URL, BASE_RPC_URL');
    process.exit(1);
  }
  
  // Initialize scanner with configured networks
  const scanner = new MultiNetworkScanner(
    ['ethereum', 'bsc', 'arbitrum', 'base'],
    rpcConfig
  );
  
  // Alternative: Initialize with subset of networks
  /*
  const scanner = new MultiNetworkScanner(
    ['ethereum', 'bsc'],
    {
      ethereum: rpcConfig.ethereum,
      bsc: rpcConfig.bsc
        wsUrl: 'wss://your-bsc-ws.com'
      }
    }
  );
  */
  
  // Method 3: Initialize with detailed network objects
  /*
  const scanner = new MultiNetworkScanner([
    {
      name: 'ethereum',
      rpcUrl: 'https://eth.llamarpc.com',
      wsUrl: 'wss://ethereum.publicnode.com'
    },
    {
      name: 'bsc',
      rpcUrl: 'https://bsc-dataseed1.binance.org',
      wsUrl: 'wss://bsc.publicnode.com'
    }
  ]);
  */
  
  // Statistics per network
  const stats = new Map();
  scanner.getNetworks().forEach(network => {
    stats.set(network, {
      delegations: 0,
      authorities: new Set(),
      contracts: new Set()
    });
  });
  
  // Handle delegation events from any network
  scanner.on('delegation', (delegation) => {
    const networkStats = stats.get(delegation.network);
    networkStats.delegations++;
    networkStats.authorities.add(delegation.authority);
    networkStats.contracts.add(delegation.delegatedTo);
    
    console.log('═══════════════════════════════════════════════════════');
    console.log(`🌐 Network: ${delegation.network.toUpperCase()}`);
    console.log(`📍 Transaction: ${delegation.txHash}`);
    console.log(`📦 Block: ${delegation.blockNumber}`);
    console.log(`👤 Authority: ${delegation.authority}`);
    console.log(`📜 Delegated to: ${delegation.delegatedTo}`);
    console.log(`⏰ Time: ${new Date(delegation.timestamp * 1000).toLocaleString()}`);
    console.log('─────────────────────────────────────────────────────────');
    console.log(`📊 ${delegation.network} Stats: ${networkStats.delegations} total | ${networkStats.authorities.size} authorities | ${networkStats.contracts.size} contracts`);
    console.log('═══════════════════════════════════════════════════════\n');
  });
  
  // Handle network-specific errors
  scanner.on('error', ({ network, error }) => {
    console.error(`❌ [${network}] Error: ${error.message || error}`);
  });
  
  // Handle connection events
  scanner.on('connected', ({ network }) => {
    console.log(`✅ [${network}] Connected`);
  });
  
  scanner.on('disconnected', ({ network }) => {
    console.log(`⚠️  [${network}] Disconnected`);
  });
  
  // Dynamic network management example
  console.log('Starting with networks:', scanner.getNetworks().join(', '));
  console.log('');
  
  // Start monitoring all networks
  await scanner.startMonitoring();
  
  // Add a network after 30 seconds (example)
  setTimeout(() => {
    console.log('\n➕ Adding Polygon network...');
    scanner.addNetwork('polygon');
  }, 30000);
  
  // Remove a network after 60 seconds (example)
  setTimeout(async () => {
    console.log('\n➖ Removing BSC network...');
    await scanner.removeNetwork('bsc');
  }, 60000);
  
  // Status check every minute
  setInterval(() => {
    console.log('\n📊 Network Status:');
    const status = scanner.getStatus();
    Object.entries(status).forEach(([network, info]) => {
      console.log(`  ${network}: ${info.monitoring ? '🟢 Active' : '🔴 Inactive'}`);
    });
    
    console.log('\n📈 Overall Statistics:');
    let totalDelegations = 0;
    let totalAuthorities = new Set();
    let totalContracts = new Set();
    
    stats.forEach((networkStats, network) => {
      totalDelegations += networkStats.delegations;
      networkStats.authorities.forEach(a => totalAuthorities.add(a));
      networkStats.contracts.forEach(c => totalContracts.add(c));
      console.log(`  ${network}: ${networkStats.delegations} delegations`);
    });
    
    console.log(`  Total: ${totalDelegations} delegations | ${totalAuthorities.size} unique authorities | ${totalContracts.size} unique contracts`);
    console.log('');
  }, 60000);
  
  // Keep process alive
  process.stdin.resume();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n📊 Final Statistics by Network:');
    
    stats.forEach((networkStats, network) => {
      console.log(`\n${network.toUpperCase()}:`);
      console.log(`  Delegations: ${networkStats.delegations}`);
      console.log(`  Unique Authorities: ${networkStats.authorities.size}`);
      console.log(`  Unique Contracts: ${networkStats.contracts.size}`);
    });
    
    console.log('\nStopping all monitors...');
    await scanner.stopMonitoring();
    process.exit(0);
  });
}

// Run the multi-network monitor
main().catch(error => {
  console.error('Multi-network monitor failed:', error);
  process.exit(1);
});