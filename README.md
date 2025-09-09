# EIP-7702 CLI - Stateless Delegation Monitor

A lightweight, stateless wrapper service for monitoring or sweeping EIP-7702 delegation setup transactions across multiple EVM chains.

## 🎯 What It Does

This CLI monitors blockchain networks for EIP-7702 delegation setup transactions (type 4 transactions with `authorization_list`). It acts as a pure event emitter that:

- ✅ **Detects** EIP-7702 delegation setup transactions in real-time
- ✅ **Recovers** authority addresses from transaction signatures  
- ✅ **Supports** multiple networks simultaneously
- ✅ **Reports** findings via events (doesn't store anything)
- ✅ **Handles** nested signature formats (BSC, etc.)

## What to use it for

By actively monitoring malicious EIP7702 delegations, you can potentially frontrun them by sweeping the wallets first right after the delegation happened.

## 📦 Installation

### As NPM Package

```bash
npm install eip7702-delegation-tracker
```

### Local Development

```bash
git clone <repository>
cd EIP7702-Tracker
npm install
npm link  # Makes 'eip7702' command available globally
```

## 🔧 Configuration

### RPC Endpoints (Required)

**This library does not include any default RPC endpoints.** You must provide your own RPC URLs for each network you want to monitor.

#### Recommended RPC Providers:
- **Alchemy**: https://www.alchemy.com/
- **Infura**: https://infura.io/
- **QuickNode**: https://www.quicknode.com/
- **Ankr**: https://www.ankr.com/
- **Public RPC Lists**: https://chainlist.org/

#### Supported Networks:
- `ethereum` (Chain ID: 1)
- `bsc` (Chain ID: 56)
- `arbitrum` (Chain ID: 42161)
- `base` (Chain ID: 8453)
- `optimism` (Chain ID: 10)
- `polygon` (Chain ID: 137)

## 🚀 Quick Start

### ⚠️ Important: RPC Endpoints Required

This library does **NOT** include any default RPC endpoints. You must provide your own RPC URL for each network you want to monitor.

### Basic Usage - Single Network

```javascript
const { EIP7702Scanner } = require('eip7702-delegation-tracker');

// Initialize scanner with your RPC endpoint (REQUIRED)
const scanner = new EIP7702Scanner(
  'arbitrum',
  'https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY', // RPC URL (required)
  'wss://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY'    // WebSocket URL (optional)
);

// Listen for delegations
scanner.on('delegation', (delegation) => {
  console.log('New delegation detected:', {
    network: 'arbitrum',
    authority: delegation.authority,
    delegatedTo: delegation.delegatedTo,
    txHash: delegation.txHash
  });
});

// Start monitoring
await scanner.watchBlocks();
```

### Multi-Network Monitoring

```javascript
const { MultiNetworkScanner } = require('eip7702-delegation-tracker');

// Monitor multiple networks with required RPC endpoints
const scanner = new MultiNetworkScanner(
  ['ethereum', 'bsc', 'arbitrum', 'base'],
  {
    ethereum: {
      rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY' // Required
    },
    bsc: {
      rpcUrl: 'https://bnb-mainnet.g.alchemy.com/v2/YOUR_KEY' // Required
    },
    arbitrum: {
      rpcUrl: 'https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY' // Required
    },
    base: {
      rpcUrl: 'https://base-mainnet.g.alchemy.com/v2/YOUR_KEY' // Required
    }
  }
);

// Events include network context
scanner.on('delegation', (delegation) => {
  console.log(`[${delegation.network}] New delegation:`, {
    authority: delegation.authority,
    delegatedTo: delegation.delegatedTo,
    txHash: delegation.txHash
  });
});

await scanner.startMonitoring();
```

## 🎯 Real-World Example: Monitor Specific Contracts

```javascript
const { MultiNetworkScanner } = require('eip7702-delegation-tracker');

// Configure networks with custom RPC endpoints
const scanner = new MultiNetworkScanner(
  ['bsc', 'arbitrum', 'base'],
  {
    arbitrum: {
      rpcUrl: 'https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY',
      wsUrl: 'wss://arb-mainnet.g.alchemy.com/v2/YOUR_KEY'
    },
    bsc: {
      rpcUrl: 'https://bnb-mainnet.g.alchemy.com/v2/YOUR_KEY',
      wsUrl: 'wss://bnb-mainnet.g.alchemy.com/v2/YOUR_KEY'
    },
    base: {
      rpcUrl: 'https://base-mainnet.g.alchemy.com/v2/YOUR_KEY',
      wsUrl: 'wss://base-mainnet.g.alchemy.com/v2/YOUR_KEY'
    }
  }
);

// Target contracts to monitor
const TARGET_CONTRACTS = [
  '0x89046d34e70a65acab2152c26a0c8e493b5ba629',
  '0x02d5251018c6fde7bbef8412585714fa7c1df3ac'
].map(c => c.toLowerCase());

// Track new authorities
const authorities = new Map();
TARGET_CONTRACTS.forEach(c => authorities.set(c, new Set()));

// Monitor for delegations to specific contracts
scanner.on('delegation', (delegation) => {
  const delegatedTo = delegation.delegatedTo?.toLowerCase();
  
  // Check if this is one of our target contracts
  if (TARGET_CONTRACTS.includes(delegatedTo)) {
    const contractAuthorities = authorities.get(delegatedTo);
    const isNew = !contractAuthorities.has(delegation.authority);
    contractAuthorities.add(delegation.authority);
    
    console.log(`
    ✅ TARGET CONTRACT MATCH!
    Network: ${delegation.network}
    Contract: ${delegatedTo}
    Authority: ${delegation.authority} ${isNew ? '(NEW!)' : ''}
    TX: ${delegation.txHash}
    Block: ${delegation.blockNumber}
    `);
    
    // Your custom logic here:
    if (isNew) {
      // Send alert, save to database, trigger webhook, etc.
      notifyNewAuthority(delegation);
    }
  }
});

// Start monitoring
await scanner.startMonitoring();
```

## 🔌 Integration Patterns

### 1. Express.js API

```javascript
const express = require('express');
const { MultiNetworkScanner } = require('eip7702-delegation-tracker');

const app = express();
const scanner = new MultiNetworkScanner(['ethereum', 'bsc']);

// Scanner just emits events - you handle storage/logic
scanner.on('delegation', (delegation) => {
  // Forward to your processing logic
  processNewDelegation(delegation);
});

app.get('/status', (req, res) => {
  res.json(scanner.getStatus());
});

scanner.startMonitoring();
app.listen(3000);
```

### 2. Webhook Forwarding

```javascript
const scanner = new MultiNetworkScanner(['arbitrum']);

scanner.on('delegation', async (delegation) => {
  // Forward to webhook
  await fetch('https://your-webhook.com/delegations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(delegation)
  });
});

scanner.startMonitoring();
```

### 3. Message Queue Integration

```javascript
const scanner = new MultiNetworkScanner(['ethereum']);

scanner.on('delegation', async (delegation) => {
  // Send to queue
  await queue.publish('eip7702.delegations', delegation);
});

scanner.startMonitoring();
```

## 📊 Event Data Structure

```javascript
{
  // Transaction details
  txHash: '0x...',
  blockNumber: 19000000,
  timestamp: 1699564800,
  
  // Delegation details
  authority: '0x...', // Who is delegating (recovered from signature)
  delegatedTo: '0x...', // Contract receiving delegation
  nonce: '123',
  
  // Network info (multi-network scanner only)
  network: 'arbitrum',
  chainId: 42161
}
```

## 🌐 Supported Networks

| Network  | Chain ID | RPC Required | WebSocket Support |
|----------|----------|--------------|-------------------|
| Ethereum | 1        | ✅ Yes       | Optional          |
| BSC      | 56       | ✅ Yes       | Optional          |
| Arbitrum | 42161    | ✅ Yes       | Optional          |
| Base     | 8453     | ✅ Yes       | Optional          |
| Optimism | 10       | ✅ Yes       | Optional          |
| Polygon  | 137      | ✅ Yes       | Optional          |

## 🛠️ API Reference

### `EIP7702Scanner` (Single Network)

```javascript
const scanner = new EIP7702Scanner(
  network,        // Required: 'ethereum', 'bsc', 'arbitrum', etc.
  rpcUrl,         // Required: Your RPC endpoint URL
  wsUrl           // Optional: WebSocket URL for real-time updates
);

// Methods
await scanner.watchBlocks();           // Start monitoring
scanner.stop();                         // Stop monitoring
await scanner.scanBlock(blockNumber);  // Scan specific block

// Events
scanner.on('delegation', (delegation) => {});
scanner.on('error', (error) => {});
```

### `MultiNetworkScanner` (Multiple Networks)

```javascript
const scanner = new MultiNetworkScanner(networks, customEndpoints?);

// Methods
await scanner.startMonitoring();              // Start all networks
await scanner.stopMonitoring();               // Stop all networks
scanner.addNetwork(network, rpc?, ws?);       // Add network dynamically
await scanner.removeNetwork(network);         // Remove network
scanner.getStatus();                          // Get status of all networks
scanner.getNetworks();                        // List active networks

// Events (include network context)
scanner.on('delegation', (delegation) => {});
scanner.on('error', ({ network, error }) => {});
scanner.on('connected', ({ network }) => {});
scanner.on('disconnected', ({ network }) => {});
```

## 🖥️ CLI Usage

When using the CLI commands, you **must** provide an RPC endpoint using the `--rpc` flag:

### Scan for Delegations
```bash
# Scan last 100 blocks on Arbitrum
eip7702 scan --network arbitrum --rpc https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY --blocks 100

# Scan from specific block
eip7702 scan --network bsc --rpc https://bsc-dataseed.binance.org --from-block 40000000 --blocks 50

# Save results to file
eip7702 scan --network ethereum --rpc https://eth.llamarpc.com --blocks 100 --save results.json --output json
```

### Check Authority Status
```bash
# Check if an address has active delegation
eip7702 check 0x742d35Cc6634C0532925a3b844Bc9e7595f0fA83 --network arbitrum --rpc https://arb1.arbitrum.io/rpc

# Verbose output
eip7702 check 0x742d35Cc6634C0532925a3b844Bc9e7595f0fA83 --network base --rpc https://mainnet.base.org -v
```

### Watch Real-time
```bash
# Monitor for new delegations
eip7702 watch --network arbitrum --rpc https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY

# With WebSocket for real-time updates
eip7702 watch --network ethereum --rpc https://eth.llamarpc.com --ws wss://ethereum.publicnode.com

# Filter by specific address
eip7702 watch --network bsc --rpc https://bsc-dataseed.binance.org --filter 0x89046d34e70a65acab2152c26a0c8e493b5ba629
```

## 📝 Complete Example Files

Check the `examples/` directory for ready-to-run examples:

- `realtime-multi-target.js` - Monitor multiple contracts across multiple networks
- `multi-network.js` - Basic multi-network monitoring
- `multi-network-api.js` - REST API server with WebSocket support
- `stateless-integration.js` - Various integration patterns


## 🏗️ Architecture

This CLI is a **stateless wrapper service**:

```
[Blockchain] → [Scanner] → [Events] → [Your Application]
```

- **Takes** configuration from you
- **Processes** blockchain data
- **Emits** events with findings
- **Does NOT store** any data internally
- **Does NOT make** business decisions

You decide what to do with the events!

## 🔧 Troubleshooting

### Not detecting delegations?

1. Make sure you're using WebSocket URLs for real-time monitoring
2. Check that EIP-7702 is deployed on your target network
3. Verify your RPC endpoint supports `eth_getTransaction` with full data

### Connection issues?

```javascript
scanner.on('error', ({ network, error }) => {
  console.error(`Network ${network} error:`, error);
  // Implement reconnection logic if needed
});
```

## 📄 License

MIT

## 🤝 Contributing

Pull requests are welcome! Please ensure:
- Code follows existing patterns
- Examples are provided for new features
- Documentation is updated

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Include network, error messages, and code samples