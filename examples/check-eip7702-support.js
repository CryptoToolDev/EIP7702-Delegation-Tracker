/**
 * Check EIP-7702 Support on Networks
 * 
 * This script checks if EIP-7702 transactions exist on different networks
 */

const { ethers } = require('ethers');

const NETWORKS = {
  ethereum: {
    name: 'Ethereum',
    rpc: 'https://eth.llamarpc.com',
    startBlock: null // Will use current - 1000
  },
  bsc: {
    name: 'BSC',
    rpc: 'https://bnb-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    startBlock: null
  },
  arbitrum: {
    name: 'Arbitrum',
    rpc: 'https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    startBlock: null
  },
  base: {
    name: 'Base',
    rpc: 'https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    startBlock: null
  }
};

async function checkNetwork(networkKey) {
  const network = NETWORKS[networkKey];
  console.log(`\n🔍 Checking ${network.name}...`);
  console.log('━'.repeat(50));
  
  try {
    const provider = new ethers.JsonRpcProvider(network.rpc);
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block: ${currentBlock}`);
    
    // Check last 1000 blocks (or less if specified)
    const blocksToCheck = 1000;
    const startBlock = network.startBlock || (currentBlock - blocksToCheck);
    
    let totalTx = 0;
    let type4Tx = 0;
    let blocksWithType4 = 0;
    let authListTx = 0;
    const uniqueTypes = new Set();
    const sampleType4Txs = [];
    
    console.log(`Scanning blocks ${startBlock} to ${currentBlock}...`);
    
    for (let blockNum = startBlock; blockNum <= currentBlock; blockNum++) {
      if ((blockNum - startBlock) % 100 === 0) {
        process.stdout.write(`Progress: ${blockNum - startBlock}/${blocksToCheck} blocks\r`);
      }
      
      try {
        const block = await provider.getBlock(blockNum, true);
        if (!block || !block.transactions) continue;
        
        let blockType4Count = 0;
        
        for (const tx of block.transactions) {
          totalTx++;
          
          // Track all transaction types we see
          if (tx.type !== undefined && tx.type !== null) {
            uniqueTypes.add(tx.type.toString());
          }
          
          // Check for type 4
          const txType = typeof tx.type === 'string' ? 
            (tx.type.startsWith('0x') ? parseInt(tx.type, 16) : parseInt(tx.type)) : 
            tx.type;
          
          if (txType === 4) {
            type4Tx++;
            blockType4Count++;
            
            // Check for authorization list
            if (tx.authorizationList || tx.authorization_list) {
              authListTx++;
              
              // Save sample transaction
              if (sampleType4Txs.length < 3) {
                sampleType4Txs.push({
                  hash: tx.hash,
                  block: blockNum,
                  authList: tx.authorizationList || tx.authorization_list
                });
              }
            }
          }
        }
        
        if (blockType4Count > 0) {
          blocksWithType4++;
        }
        
      } catch (error) {
        // Skip blocks that fail
        continue;
      }
    }
    
    console.log('\n');
    console.log(`✅ Scan complete for ${network.name}`);
    console.log(`  Total transactions scanned: ${totalTx}`);
    console.log(`  Unique transaction types seen: ${Array.from(uniqueTypes).sort().join(', ')}`);
    console.log(`  Type-4 (EIP-7702) transactions: ${type4Tx}`);
    console.log(`  Type-4 with authorization_list: ${authListTx}`);
    console.log(`  Blocks containing type-4 txs: ${blocksWithType4}`);
    
    if (type4Tx > 0) {
      console.log(`  Percentage of type-4: ${(type4Tx / totalTx * 100).toFixed(4)}%`);
      
      if (sampleType4Txs.length > 0) {
        console.log('\n  Sample EIP-7702 transactions:');
        sampleType4Txs.forEach((tx, i) => {
          console.log(`    ${i + 1}. ${tx.hash}`);
          console.log(`       Block: ${tx.block}`);
          console.log(`       Auth list length: ${tx.authList.length}`);
        });
      }
    } else {
      console.log(`  ⚠️ No EIP-7702 transactions found in last ${blocksToCheck} blocks`);
    }
    
  } catch (error) {
    console.error(`❌ Error checking ${network.name}: ${error.message}`);
  }
}

async function checkAll() {
  console.log('🔍 EIP-7702 Network Support Check');
  console.log('═'.repeat(50));
  console.log('This will check the last 1000 blocks on each network');
  console.log('for EIP-7702 (type 4) transactions.\n');
  
  for (const networkKey of Object.keys(NETWORKS)) {
    await checkNetwork(networkKey);
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log('✅ Check complete\n');
  console.log('Note: EIP-7702 is a new feature and may not be');
  console.log('deployed on all networks yet. Ethereum mainnet');
  console.log('is most likely to have support.\n');
}

// Run the check
checkAll().catch(console.error);