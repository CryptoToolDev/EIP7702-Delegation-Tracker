const EventEmitter = require('events');
const { EIP7702Scanner } = require('./scanner');

/**
 * MultiNetworkScanner - Monitor multiple networks simultaneously
 * 
 * A stateless wrapper that manages multiple network scanners
 * and reports all findings via unified events
 */
class MultiNetworkScanner extends EventEmitter {
  constructor(networks = ['ethereum'], customConfigs = {}) {
    super();
    
    // Store scanner instances
    this.scanners = new Map();
    this.isMonitoring = false;
    
    // Initialize scanners for each network
    this.initializeNetworks(networks, customConfigs);
  }
  
  /**
   * Initialize scanners for specified networks
   */
  initializeNetworks(networks, customConfigs) {
    // Handle different input formats
    const networkList = Array.isArray(networks) ? networks : [networks];
    
    networkList.forEach(network => {
      const networkName = typeof network === 'string' ? network : network.name;
      const config = customConfigs[networkName] || {};
      
      try {
        const scanner = new EIP7702Scanner(
          networkName,
          config.rpcUrl || (typeof network === 'object' ? network.rpcUrl : null),
          config.wsUrl || (typeof network === 'object' ? network.wsUrl : null)
        );
        
        // Forward events with network context
        this.setupEventForwarding(scanner, networkName);
        
        this.scanners.set(networkName, scanner);
        console.log(`✅ Initialized scanner for ${networkName}`);
      } catch (error) {
        console.error(`❌ Failed to initialize ${networkName}: ${error.message}`);
        this.emit('error', { network: networkName, error });
      }
    });
  }
  
  /**
   * Setup event forwarding from individual scanner to multi-scanner
   */
  setupEventForwarding(scanner, network) {
    // Forward delegation events with network info
    scanner.on('delegation', (delegation) => {
      this.emit('delegation', {
        ...delegation,
        network // Ensure network is included
      });
    });
    
    // Forward errors with network context
    scanner.on('error', (error) => {
      this.emit('error', {
        network,
        error,
        message: `[${network}] ${error.message || error}`
      });
    });
    
    // Forward connection events
    scanner.on('connected', () => {
      this.emit('connected', { network });
    });
    
    scanner.on('disconnected', () => {
      this.emit('disconnected', { network });
    });
  }
  
  /**
   * Add a new network to monitor
   */
  addNetwork(network, rpcUrl, wsUrl) {
    if (this.scanners.has(network)) {
      console.log(`Network ${network} already exists`);
      return false;
    }
    
    try {
      const scanner = new EIP7702Scanner(network, rpcUrl, wsUrl);
      this.setupEventForwarding(scanner, network);
      this.scanners.set(network, scanner);
      
      // If already monitoring, start this scanner too
      if (this.isMonitoring) {
        scanner.watchBlocks().catch(err => {
          this.emit('error', { network, error: err });
        });
      }
      
      console.log(`✅ Added network: ${network}`);
      return true;
    } catch (error) {
      this.emit('error', { network, error });
      return false;
    }
  }
  
  /**
   * Remove a network from monitoring
   */
  async removeNetwork(network) {
    const scanner = this.scanners.get(network);
    if (!scanner) {
      console.log(`Network ${network} not found`);
      return false;
    }
    
    try {
      scanner.stop();
      this.scanners.delete(network);
      console.log(`✅ Removed network: ${network}`);
      return true;
    } catch (error) {
      this.emit('error', { network, error });
      return false;
    }
  }
  
  /**
   * Start monitoring all networks
   */
  async startMonitoring(fromBlock) {
    if (this.isMonitoring) {
      console.log('Already monitoring');
      return;
    }
    
    this.isMonitoring = true;
    const promises = [];
    
    for (const [network, scanner] of this.scanners) {
      console.log(`Starting monitor for ${network}...`);
      promises.push(
        scanner.watchBlocks().catch(err => {
          console.error(`Failed to start ${network}: ${err.message}`);
          this.emit('error', { network, error: err });
        })
      );
    }
    
    await Promise.allSettled(promises);
    console.log(`✅ Monitoring ${this.scanners.size} networks`);
  }
  
  /**
   * Stop monitoring all networks
   */
  async stopMonitoring() {
    this.isMonitoring = false;
    
    for (const [network, scanner] of this.scanners) {
      try {
        scanner.stop();
      } catch (err) {
        this.emit('error', { network, error: err });
      }
    }
    
    console.log('✅ Stopped all monitors');
  }
  
  /**
   * Scan a specific block across all networks
   */
  async scanBlock(blockNumber) {
    const results = new Map();
    const promises = [];
    
    for (const [network, scanner] of this.scanners) {
      promises.push(
        scanner.scanBlock(blockNumber)
          .then(delegations => {
            // Add network info to each delegation
            const networkDelegations = delegations.map(d => ({
              ...d,
              network
            }));
            results.set(network, networkDelegations);
          })
          .catch(err => {
            console.error(`Error scanning ${network} block ${blockNumber}: ${err.message}`);
            results.set(network, []);
          })
      );
    }
    
    await Promise.allSettled(promises);
    
    // Flatten results
    const allDelegations = [];
    for (const delegations of results.values()) {
      allDelegations.push(...delegations);
    }
    
    return allDelegations;
  }
  
  /**
   * Scan a range of blocks across all networks
   */
  async scanBlocks(startBlock, endBlock) {
    const allDelegations = [];
    
    for (let block = startBlock; block <= endBlock; block++) {
      const blockDelegations = await this.scanBlock(block);
      allDelegations.push(...blockDelegations);
    }
    
    return allDelegations;
  }
  
  /**
   * Get delegation history for an address across all networks
   */
  async getDelegationHistory(address, limit = 10) {
    const results = new Map();
    const promises = [];
    
    for (const [network, scanner] of this.scanners) {
      promises.push(
        scanner.getDelegationHistory(address, limit)
          .then(history => {
            // Add network info to each entry
            const networkHistory = history.map(h => ({
              ...h,
              network
            }));
            results.set(network, networkHistory);
          })
          .catch(err => {
            console.error(`Error getting history for ${address} on ${network}: ${err.message}`);
            results.set(network, []);
          })
      );
    }
    
    await Promise.allSettled(promises);
    
    // Combine and sort by block number
    const allHistory = [];
    for (const history of results.values()) {
      allHistory.push(...history);
    }
    
    return allHistory.sort((a, b) => b.blockNumber - a.blockNumber).slice(0, limit);
  }
  
  /**
   * Get list of active networks
   */
  getNetworks() {
    return Array.from(this.scanners.keys());
  }
  
  /**
   * Get scanner for specific network
   */
  getScanner(network) {
    return this.scanners.get(network);
  }
  
  /**
   * Get monitoring status
   */
  getStatus() {
    const status = {};
    
    for (const [network, scanner] of this.scanners) {
      status[network] = {
        initialized: true,
        monitoring: scanner.isMonitoring || false,
        chainId: scanner.chainId,
        explorer: scanner.explorer
      };
    }
    
    return status;
  }
}

module.exports = { MultiNetworkScanner };