/**
 * Example: Stateless Integration Pattern
 * 
 * This example shows how the CLI acts as a pure wrapper service
 * that only processes and reports data without storing anything
 */

const { EIP7702Scanner } = require('../lib/scanner');

/**
 * Example 1: Simple event forwarding to your application
 */
function integrateWithYourApp() {
  // Initialize scanner with your configuration
  const scanner = new EIP7702Scanner(
    'ethereum',
    process.env.RPC_URL,     // Your RPC endpoint
    process.env.WS_URL       // Your WebSocket endpoint
  );
  
  // The scanner only emits events - you decide what to do with them
  scanner.on('delegation', (delegation) => {
    // Forward to your application logic
    yourApp.processDelegation(delegation);
    
    // Or send to your message queue
    messageQueue.publish('delegations', delegation);
    
    // Or call your API
    api.post('/delegations', delegation);
    
    // Or just log it
    console.log('Delegation detected:', delegation);
  });
  
  // Handle errors
  scanner.on('error', (error) => {
    // Forward to your error handler
    yourApp.handleError(error);
  });
  
  // Start scanning
  scanner.startMonitoring();
}

/**
 * Example 2: Webhook integration pattern
 */
async function webhookIntegration(webhookUrl) {
  const scanner = new EIP7702Scanner('ethereum');
  const axios = require('axios');
  
  // Scanner just emits events, you handle the webhook
  scanner.on('delegation', async (delegation) => {
    try {
      // Send to your webhook endpoint
      await axios.post(webhookUrl, {
        type: 'eip7702_delegation',
        data: delegation,
        timestamp: Date.now()
      });
      console.log(`Webhook sent for TX: ${delegation.txHash}`);
    } catch (error) {
      console.error('Webhook failed:', error.message);
    }
  });
  
  await scanner.startMonitoring();
}

/**
 * Example 3: Stream processing pattern
 */
function streamProcessing() {
  const scanner = new EIP7702Scanner('ethereum');
  
  // Create a transform stream that processes delegations
  const { Transform } = require('stream');
  
  const delegationStream = new Transform({
    objectMode: true,
    transform(delegation, encoding, callback) {
      // Apply your transformation logic
      const processed = {
        ...delegation,
        processedAt: Date.now(),
        network: 'ethereum',
        // Add your custom fields
      };
      
      // Pass it along the stream
      callback(null, processed);
    }
  });
  
  // Wire up the scanner to the stream
  scanner.on('delegation', (delegation) => {
    delegationStream.write(delegation);
  });
  
  // Pipe to your destination
  delegationStream.pipe(yourOutputStream);
  
  scanner.startMonitoring();
}

/**
 * Example 4: Pure functional approach
 */
async function functionalApproach() {
  const scanner = new EIP7702Scanner('ethereum');
  
  // Define pure functions to handle delegations
  const processDelegation = (delegation) => ({
    id: delegation.txHash,
    from: delegation.authority,
    to: delegation.delegatedTo,
    block: delegation.blockNumber,
    timestamp: new Date(delegation.timestamp * 1000)
  });
  
  const filterRelevant = (delegation) => {
    // Your filter logic - scanner doesn't store, just emits
    return delegation.delegatedTo !== '0x0000000000000000000000000000000000000000';
  };
  
  const formatForOutput = (delegation) => {
    return `[${delegation.timestamp}] ${delegation.from} -> ${delegation.to}`;
  };
  
  // Chain your pure functions
  scanner.on('delegation', (delegation) => {
    if (filterRelevant(delegation)) {
      const processed = processDelegation(delegation);
      const output = formatForOutput(processed);
      console.log(output);
    }
  });
  
  await scanner.startMonitoring();
}

/**
 * Example 5: Configuration-driven usage
 */
async function configurationDriven(config) {
  // User provides all configuration
  const scanner = new EIP7702Scanner(
    config.network,
    config.rpcUrl,
    config.wsUrl
  );
  
  // Scanner just processes based on config and reports back
  scanner.on('delegation', (delegation) => {
    // Apply user-defined filters
    if (config.filters) {
      if (config.filters.authority && 
          delegation.authority !== config.filters.authority) {
        return;
      }
      if (config.filters.minBlock && 
          delegation.blockNumber < config.filters.minBlock) {
        return;
      }
    }
    
    // Report in user-defined format
    switch (config.outputFormat) {
      case 'json':
        console.log(JSON.stringify(delegation));
        break;
      case 'csv':
        console.log(`${delegation.txHash},${delegation.authority},${delegation.delegatedTo}`);
        break;
      case 'custom':
        config.customHandler(delegation);
        break;
      default:
        console.log(delegation);
    }
  });
  
  // Scan based on user config
  if (config.mode === 'scan') {
    // One-time scan
    const delegations = await scanner.scanBlock(config.blockNumber);
    delegations.forEach(d => scanner.emit('delegation', d));
  } else if (config.mode === 'monitor') {
    // Continuous monitoring
    await scanner.startMonitoring(config.fromBlock);
  }
}

/**
 * Example 6: Minimal usage - just report findings
 */
async function minimalUsage() {
  const scanner = new EIP7702Scanner('ethereum');
  
  // Scanner finds delegations, you handle them
  scanner.on('delegation', console.log);
  scanner.on('error', console.error);
  
  // Just scan and report
  await scanner.startMonitoring();
}

// Example configuration object
const exampleConfig = {
  network: 'ethereum',
  rpcUrl: 'https://eth.llamarpc.com',
  wsUrl: 'wss://ethereum.publicnode.com',
  mode: 'monitor',
  outputFormat: 'json',
  filters: {
    authority: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb3',
    minBlock: 19000000
  },
  customHandler: (delegation) => {
    // Your custom processing
    console.log('Custom:', delegation);
  }
};

// Mock objects for demonstration
const yourApp = {
  processDelegation: (d) => console.log('App processing:', d.txHash),
  handleError: (e) => console.error('App error:', e)
};

const messageQueue = {
  publish: (topic, data) => console.log(`Queue [${topic}]:`, data.txHash)
};

const api = {
  post: (endpoint, data) => console.log(`API POST ${endpoint}:`, data.txHash)
};

const yourOutputStream = process.stdout;

// Run examples
console.log('EIP7702 CLI - Stateless Wrapper Service Examples\n');
console.log('The scanner acts as a pure event emitter:');
console.log('- Takes configuration from user');
console.log('- Processes blockchain data');
console.log('- Reports findings via events');
console.log('- Stores nothing internally\n');

// Uncomment to run examples:
// minimalUsage();
// webhookIntegration('https://your-webhook.com/delegations');
// configurationDriven(exampleConfig);