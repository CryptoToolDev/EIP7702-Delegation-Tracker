/**
 * Example: Scanning for EIP-7702 delegations
 * 
 * This example demonstrates how to scan blocks for delegation setup transactions
 */

const { EIP7702Scanner } = require('../lib/scanner');

async function main() {
  // Get RPC URL from environment or use example
  const rpcUrl = process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY';
  
  if (rpcUrl.includes('YOUR_API_KEY')) {
    console.error('❌ Please provide a valid RPC URL');
    console.error('   Set ETHEREUM_RPC_URL environment variable or update the rpcUrl in this file');
    process.exit(1);
  }
  
  // Initialize scanner for Ethereum mainnet with RPC URL
  const scanner = new EIP7702Scanner('ethereum', rpcUrl);
  
  console.log('🔍 Scanning for EIP-7702 delegations on Ethereum...\n');
  
  try {
    // Get current block number
    const currentBlock = await scanner.provider.getBlockNumber();
    console.log(`Current block: ${currentBlock}`);
    
    // Scan last 100 blocks
    const startBlock = currentBlock - 100;
    console.log(`Scanning blocks ${startBlock} to ${currentBlock}...\n`);
    
    const delegations = [];
    
    for (let blockNum = startBlock; blockNum <= currentBlock; blockNum++) {
      const blockDelegations = await scanner.scanBlock(blockNum);
      
      if (blockDelegations.length > 0) {
        console.log(`Block ${blockNum}: Found ${blockDelegations.length} delegation(s)`);
        delegations.push(...blockDelegations);
      }
      
      // Progress indicator
      if (blockNum % 10 === 0) {
        const progress = ((blockNum - startBlock) / (currentBlock - startBlock) * 100).toFixed(1);
        console.log(`Progress: ${progress}%`);
      }
    }
    
    // Display results
    console.log('\n📊 Scan Results:');
    console.log(`Total delegations found: ${delegations.length}\n`);
    
    if (delegations.length > 0) {
      console.log('Recent delegations:');
      delegations.slice(-5).forEach((d, i) => {
        console.log(`\n${i + 1}. Transaction: ${d.txHash}`);
        console.log(`   Block: ${d.blockNumber}`);
        console.log(`   Authority: ${d.authority}`);
        console.log(`   Delegated to: ${d.delegatedTo}`);
      });
    }
    
  } catch (error) {
    console.error('Error scanning blocks:', error);
  }
}

// Run the example
main().catch(console.error);