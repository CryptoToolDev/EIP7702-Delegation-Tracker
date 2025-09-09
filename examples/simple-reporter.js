/**
 * Simple Reporter Example
 * 
 * Shows the CLI as a pure stateless reporter that just
 * processes and outputs delegation data
 */

const { EIP7702Scanner } = require('../lib/scanner');

// Configuration from user/environment
const config = {
  network: process.env.NETWORK || 'ethereum',
  rpcUrl: process.env.RPC_URL,
  wsUrl: process.env.WS_URL,
  outputFormat: process.env.OUTPUT_FORMAT || 'console'
};

async function main() {
  console.log('Starting EIP-7702 delegation reporter...');
  console.log(`Network: ${config.network}`);
  console.log(`Output: ${config.outputFormat}\n`);
  
  // Create scanner with user config
  const scanner = new EIP7702Scanner(
    config.network,
    config.rpcUrl,
    config.wsUrl
  );
  
  // Scanner just reports what it finds - no storage
  scanner.on('delegation', (delegation) => {
    switch (config.outputFormat) {
      case 'json':
        // Output as JSON for piping to other tools
        process.stdout.write(JSON.stringify(delegation) + '\n');
        break;
        
      case 'csv':
        // Output as CSV for data analysis
        process.stdout.write([
          delegation.txHash,
          delegation.blockNumber,
          delegation.authority,
          delegation.delegatedTo,
          delegation.timestamp
        ].join(',') + '\n');
        break;
        
      case 'minimal':
        // Minimal output
        process.stdout.write(`${delegation.authority} -> ${delegation.delegatedTo}\n`);
        break;
        
      case 'console':
      default:
        // Human-readable console output
        console.log('─'.repeat(60));
        console.log('Delegation Detected:');
        console.log(`  TX Hash: ${delegation.txHash}`);
        console.log(`  Block: ${delegation.blockNumber}`);
        console.log(`  Authority: ${delegation.authority}`);
        console.log(`  Delegated To: ${delegation.delegatedTo}`);
        console.log(`  Time: ${new Date(delegation.timestamp * 1000).toISOString()}`);
    }
  });
  
  // Report errors but don't store them
  scanner.on('error', (error) => {
    console.error(`Error: ${error.message}`);
  });
  
  // Start monitoring - scanner processes and reports only
  await scanner.startMonitoring();
  
  // Keep process alive
  process.stdin.resume();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nStopping reporter...');
    await scanner.stopMonitoring();
    process.exit(0);
  });
}

// Run the reporter
main().catch(error => {
  console.error('Reporter failed:', error);
  process.exit(1);
});