/**
 * Real-time Batch Monitor
 * 
 * Monitor multiple networks and multiple target contracts simultaneously
 */

const { MultiNetworkScanner } = require('../lib/index');

// Configuration - Add your networks and target contracts here
const CONFIG = {
  // Network configurations (add your RPC/WS endpoints)
  networks: {
    ethereum: {
      rpcUrl: 'https://eth.llamarpc.com',
      wsUrl: 'wss://ethereum.publicnode.com'
    },
    bsc: {
      rpcUrl: 'https://bsc-dataseed1.binance.org',
      wsUrl: 'wss://bsc.publicnode.com'
    },
    arbitrum: {
      rpcUrl: 'https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
      wsUrl: 'wss://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY'
    },
    base: {
      rpcUrl: 'https://mainnet.base.org',
      wsUrl: 'wss://base.publicnode.com'
    }
  },
  
  // Target contracts to monitor (lowercase)
  targetContracts: [
    '0x02d5251018c6fde7bbef8412585714fa7c1df3ac', // Arbitrum contract
    '0x89046d34e70a65acab2152c26a0c8e493b5ba629', // Another contract
    '0x5a77f0dfc729700300c22e7b0111a5cfbc32431b', // BSC contract
    // Add more contracts here...
  ].map(c => c.toLowerCase()),
  
  // Which networks to monitor (comment out ones you don't need)
  activeNetworks: ['arbitrum', 'bsc', 'ethereum', 'base']
};

async function batchMonitor() {
  console.log('🔴 REAL-TIME BATCH MONITOR');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📡 Networks: ${CONFIG.activeNetworks.join(', ')}`);
  console.log(`📜 Monitoring ${CONFIG.targetContracts.length} target contracts`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Display target contracts
  console.log('Target Contracts:');
  CONFIG.targetContracts.forEach((contract, i) => {
    console.log(`  ${i + 1}. ${contract}`);
  });
  console.log('');
  
  // Initialize multi-network scanner
  const scanner = new MultiNetworkScanner(
    CONFIG.activeNetworks,
    CONFIG.networks
  );
  
  // Statistics tracking
  const stats = {
    totalDelegations: 0,
    matchingDelegations: 0,
    delegationsByNetwork: new Map(),
    delegationsByContract: new Map(),
    authoritiesByContract: new Map()
  };
  
  // Initialize stats
  CONFIG.activeNetworks.forEach(network => {
    stats.delegationsByNetwork.set(network, 0);
  });
  CONFIG.targetContracts.forEach(contract => {
    stats.delegationsByContract.set(contract, 0);
    stats.authoritiesByContract.set(contract, new Set());
  });
  
  // Monitor delegations from all networks
  scanner.on('delegation', (delegation) => {
    stats.totalDelegations++;
    
    const network = delegation.network;
    const delegatedTo = delegation.delegatedTo?.toLowerCase();
    
    // Update network stats
    stats.delegationsByNetwork.set(
      network, 
      (stats.delegationsByNetwork.get(network) || 0) + 1
    );
    
    console.log(`\n⚡ [${network.toUpperCase()}] Block ${delegation.blockNumber}`);
    
    // Check if it matches any target contract
    if (CONFIG.targetContracts.includes(delegatedTo)) {
      stats.matchingDelegations++;
      stats.delegationsByContract.set(
        delegatedTo,
        stats.delegationsByContract.get(delegatedTo) + 1
      );
      
      // Track unique authorities per contract
      const authorities = stats.authoritiesByContract.get(delegatedTo);
      const isNewAuthority = !authorities.has(delegation.authority);
      authorities.add(delegation.authority);
      
      console.log('✅✅✅ MATCH FOUND!');
      console.log(`📡 Network: ${network}`);
      console.log(`📜 Contract: ${delegatedTo}`);
      console.log(`👤 Authority: ${delegation.authority} ${isNewAuthority ? '🆕 NEW!' : '(existing)'}`);
      console.log(`📍 TX: ${delegation.txHash}`);
      console.log(`📊 This contract now has ${authorities.size} unique authorities`);
    } else {
      console.log(`❌ Not a target (delegated to: ${delegatedTo?.substring(0, 10)}...)`);
    }
    
    // Show running stats
    console.log(`📈 Total: ${stats.totalDelegations} | Matches: ${stats.matchingDelegations}`);
  });
  
  // Error handling per network
  scanner.on('error', ({ network, error }) => {
    console.error(`❌ [${network}] Error: ${error.message || error}`);
  });
  
  // Connection events
  scanner.on('connected', ({ network }) => {
    console.log(`✅ [${network}] Connected`);
  });
  
  scanner.on('disconnected', ({ network }) => {
    console.log(`⚠️  [${network}] Disconnected`);
  });
  
  // Start monitoring all networks
  console.log('🚀 Starting multi-network monitoring...\n');
  await scanner.startMonitoring();
  
  // Status report every 30 seconds
  setInterval(() => {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`⏰ STATUS REPORT - ${new Date().toLocaleTimeString()}`);
    console.log(`${'═'.repeat(60)}`);
    
    // Network stats
    console.log('\n📡 By Network:');
    CONFIG.activeNetworks.forEach(network => {
      const count = stats.delegationsByNetwork.get(network) || 0;
      console.log(`  ${network}: ${count} delegations`);
    });
    
    // Contract stats
    console.log('\n📜 By Target Contract:');
    CONFIG.targetContracts.forEach((contract, i) => {
      const count = stats.delegationsByContract.get(contract);
      const authorities = stats.authoritiesByContract.get(contract).size;
      if (count > 0) {
        console.log(`  ${i + 1}. ${contract.substring(0, 10)}...`);
        console.log(`     Delegations: ${count} | Authorities: ${authorities}`);
      }
    });
    
    console.log(`\n📊 Summary: ${stats.totalDelegations} total | ${stats.matchingDelegations} matches`);
    console.log(`${'═'.repeat(60)}\n`);
  }, 30000);
  
  // Keep running
  process.stdin.resume();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n📊 FINAL REPORT');
    console.log('═══════════════════════════════════════════════════════════');
    
    console.log('\nNetwork Summary:');
    stats.delegationsByNetwork.forEach((count, network) => {
      console.log(`  ${network}: ${count} delegations`);
    });
    
    console.log('\nTarget Contract Summary:');
    CONFIG.targetContracts.forEach((contract, i) => {
      const count = stats.delegationsByContract.get(contract);
      const authorities = stats.authoritiesByContract.get(contract);
      
      console.log(`\n${i + 1}. ${contract}`);
      console.log(`   Delegations: ${count}`);
      console.log(`   Unique Authorities: ${authorities.size}`);
      
      if (authorities.size > 0 && authorities.size <= 10) {
        console.log('   Authorities:');
        Array.from(authorities).forEach((auth, j) => {
          console.log(`     ${j + 1}. ${auth}`);
        });
      }
    });
    
    console.log('\nStopping all monitors...');
    await scanner.stopMonitoring();
    process.exit(0);
  });
}

// Run the batch monitor
batchMonitor().catch(error => {
  console.error('Batch monitor failed:', error);
  process.exit(1);
});