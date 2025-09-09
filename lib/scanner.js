const { ethers } = require('ethers');
const EventEmitter = require('events');
const { recoverAuthorityAddress } = require('../../utils/eip7702');

/**
 * EIP7702Scanner - A stateless wrapper service for scanning EIP-7702 delegations
 * 
 * This scanner acts as a pure event emitter that processes blockchain data
 * and reports findings via events. It does not store any data internally.
 */
class EIP7702Scanner extends EventEmitter {
  constructor(network = 'ethereum', customRpcUrl = null, customWsUrl = null) {
    super();
    
    this.network = network.toLowerCase();
    this.setupProvider(customRpcUrl, customWsUrl);
    this.isMonitoring = false;
  }

  setupProvider(customRpcUrl, customWsUrl) {
    // Network configurations (without default RPC endpoints)
    const networks = {
      ethereum: {
        chainId: 1,
        explorer: 'https://etherscan.io'
      },
      bsc: {
        chainId: 56,
        explorer: 'https://bscscan.com'
      },
      arbitrum: {
        chainId: 42161,
        explorer: 'https://arbiscan.io'
      },
      base: {
        chainId: 8453,
        explorer: 'https://basescan.org'
      },
      optimism: {
        chainId: 10,
        explorer: 'https://optimistic.etherscan.io'
      },
      polygon: {
        chainId: 137,
        explorer: 'https://polygonscan.com'
      }
    };

    const config = networks[this.network];
    if (!config) {
      throw new Error(`Unsupported network: ${this.network}`);
    }

    // Require RPC URL to be provided
    if (!customRpcUrl) {
      throw new Error(`RPC URL is required for ${this.network}. Please provide a custom RPC URL.`);
    }

    this.chainId = config.chainId;
    this.explorer = config.explorer;
    
    // Setup RPC provider with user-provided URL
    this.provider = new ethers.JsonRpcProvider(customRpcUrl);
    
    // Setup WebSocket provider if provided
    if (customWsUrl) {
      try {
        this.wsProvider = new ethers.WebSocketProvider(customWsUrl);
      } catch (error) {
        console.warn('WebSocket connection failed, falling back to RPC only');
        this.wsProvider = null;
      }
    }
  }

  async scanBlocks(numBlocks = 100, fromBlock = null) {
    const delegations = [];
    
    try {
      // Get the latest block if not specified
      const latestBlock = await this.provider.getBlockNumber();
      const startBlock = fromBlock ? parseInt(fromBlock) : latestBlock - parseInt(numBlocks);
      const endBlock = fromBlock ? startBlock + parseInt(numBlocks) : latestBlock;
      
      console.log(`Scanning blocks ${startBlock} to ${endBlock}...`);
      
      // Scan blocks in batches
      const batchSize = 10;
      for (let i = startBlock; i <= endBlock; i += batchSize) {
        const batch = [];
        for (let j = i; j < Math.min(i + batchSize, endBlock + 1); j++) {
          batch.push(this.scanBlock(j));
        }
        
        const results = await Promise.all(batch);
        results.forEach(blockDelegations => {
          delegations.push(...blockDelegations);
        });
        
        // Progress update
        const progress = Math.round(((i - startBlock) / (endBlock - startBlock)) * 100);
        process.stdout.write(`\rProgress: ${progress}%`);
      }
      
      console.log('\rProgress: 100%');
      
    } catch (error) {
      throw new Error(`Failed to scan blocks: ${error.message}`);
    }
    
    return delegations;
  }

  async scanBlock(blockNumber) {
    const delegations = [];
    
    try {
      // First get block without full transactions (just hashes) - like main app
      const block = await this.provider.getBlock(blockNumber, false);
      if (!block || !block.transactions || block.transactions.length === 0) {
        return delegations;
      }
      
      // Fetch full transactions individually to get all fields including authorizationList
      const txPromises = block.transactions.map(txHash => 
        this.provider.getTransaction(txHash).catch(err => {
          console.error(`Failed to fetch tx ${txHash}:`, err.message);
          return null;
        })
      );
      
      const transactions = await Promise.all(txPromises);
      
      for (const tx of transactions) {
        if (!tx) continue;
        
        // Check if this is an EIP-7702 DELEGATION SETUP transaction (type 4 with authorization_list)
        // We only care about setup transactions, not execution transactions
        // Handle both numeric and hex string formats for type
        const txType = typeof tx.type === 'string' ? parseInt(tx.type, 16) : tx.type;
        if (txType === 4 && tx.authorizationList && tx.authorizationList.length > 0) {
          const delegation = await this.processDelegation(tx, block);
          if (delegation) {
            delegations.push(delegation);
          }
        }
      }
      
    } catch (error) {
      console.error(`Error scanning block ${blockNumber}: ${error.message}`);
    }
    
    return delegations;
  }

  async processDelegation(tx, block) {
    try {
      const delegationData = {
        txHash: tx.hash,
        blockNumber: block.number,
        timestamp: new Date(block.timestamp * 1000).toISOString(),
        txSender: tx.from.toLowerCase(),
        chainId: this.chainId,
        network: this.network
      };
      
      // Process authorization list
      const firstAuth = tx.authorizationList[0];
      
      // Handle nested signature object (BSC and other networks might use this format)
      if (firstAuth.signature && typeof firstAuth.signature === 'object') {
        firstAuth.r = firstAuth.signature.r || firstAuth.r;
        firstAuth.s = firstAuth.signature.s || firstAuth.s;
        firstAuth.v = firstAuth.signature.v || firstAuth.v;
        firstAuth.yParity = firstAuth.signature.yParity || firstAuth.yParity;
      }
      
      // Try to recover the authority from the signature
      let authority = null;
      try {
        authority = await recoverAuthorityAddress(firstAuth, this.chainId);
      } catch (error) {
        // Fallback to tx sender if recovery fails
        authority = tx.from.toLowerCase();
      }
      
      delegationData.authority = authority || tx.from.toLowerCase();
      delegationData.delegatedTo = firstAuth.address?.toLowerCase();
      delegationData.nonce = firstAuth.nonce?.toString();
      
      return delegationData;
      
    } catch (error) {
      console.error(`Error processing delegation: ${error.message}`);
      return null;
    }
  }

  async getCurrentDelegation(authority) {
    try {
      const address = ethers.getAddress(authority);
      
      // Get the code at the address
      const code = await this.provider.getCode(address);
      
      // Check if the address has EIP-7702 delegation code
      // EIP-7702 delegated accounts have code starting with 0xef0100
      if (code && code.startsWith('0xef0100')) {
        // Extract the implementation address from the code
        // Format: 0xef0100 + 20-byte address
        const implementation = '0x' + code.slice(8, 48);
        
        return {
          authority: address,
          implementation: ethers.getAddress(implementation),
          code: code,
          isDelegated: true
        };
      }
      
      return null;
      
    } catch (error) {
      throw new Error(`Failed to check delegation: ${error.message}`);
    }
  }

  async getDelegationHistory(address, limit = 10) {
    const history = [];
    
    try {
      // This would require indexing or event logs
      // For now, we'll scan recent blocks for this address
      const latestBlock = await this.provider.getBlockNumber();
      const blocksToScan = Math.min(1000, latestBlock); // Scan last 1000 blocks max
      
      for (let i = latestBlock; i > latestBlock - blocksToScan && history.length < limit; i--) {
        const block = await this.provider.getBlock(i, true);
        if (!block || !block.transactions) continue;
        
        for (const tx of block.transactions) {
          // Only process delegation setup transactions (with authorization_list)
          const txType = typeof tx.type === 'string' ? parseInt(tx.type, 16) : tx.type;
          if (txType === 4 && tx.authorizationList && tx.authorizationList.length > 0) {
            // Check if this transaction involves our address
            if (tx.from.toLowerCase() === address.toLowerCase()) {
              const delegation = await this.processDelegation(tx, block);
              if (delegation && delegation.authority.toLowerCase() === address.toLowerCase()) {
                history.push({
                  ...delegation,
                  status: delegation.delegatedTo === ethers.ZeroAddress ? 'revoked' : 'active'
                });
                
                if (history.length >= limit) break;
              }
            }
          }
        }
      }
      
    } catch (error) {
      throw new Error(`Failed to get delegation history: ${error.message}`);
    }
    
    return history;
  }

  async watchBlocks() {
    const provider = this.wsProvider || this.provider;
    
    if (!this.wsProvider) {
      console.log('WebSocket not available, using polling mode...');
    }
    
    provider.on('block', async (blockNumber) => {
      try {
        const delegations = await this.scanBlock(blockNumber);
        delegations.forEach(delegation => {
          this.emit('delegation', delegation);
        });
      } catch (error) {
        this.emit('error', error);
      }
    });
    
    // Keep connection alive
    setInterval(() => {
      provider.getBlockNumber().catch(() => {
        this.emit('error', new Error('Lost connection to provider'));
      });
    }, 30000);
  }

  stop() {
    if (this.wsProvider) {
      this.wsProvider.removeAllListeners();
      this.wsProvider.destroy();
    }
    if (this.provider) {
      this.provider.removeAllListeners();
    }
  }
}

module.exports = EIP7702Scanner;
module.exports.EIP7702Scanner = EIP7702Scanner;