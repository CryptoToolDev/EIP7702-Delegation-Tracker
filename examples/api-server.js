/**
 * Example: REST API server for EIP-7702 delegations
 * 
 * This example demonstrates how to build an API server that provides
 * delegation data to other applications
 */

const express = require('express');
const { EIP7702Scanner } = require('../lib/scanner');

// Initialize Express app
const app = express();
app.use(express.json());

// Initialize scanner (default to Ethereum, can be changed via env var)
const network = process.env.NETWORK || 'ethereum';
const scanner = new EIP7702Scanner(network);

// In-memory storage (use a database in production)
const delegations = new Map();
const delegationsByAuthority = new Map();
const stats = {
  totalDelegations: 0,
  uniqueAuthorities: new Set(),
  uniqueContracts: new Set(),
  startTime: Date.now()
};

// Process incoming delegations
scanner.on('delegation', (delegation) => {
  // Store delegation
  delegations.set(delegation.txHash, delegation);
  
  // Index by authority
  if (!delegationsByAuthority.has(delegation.authority)) {
    delegationsByAuthority.set(delegation.authority, []);
  }
  delegationsByAuthority.get(delegation.authority).push(delegation);
  
  // Update stats
  stats.totalDelegations++;
  stats.uniqueAuthorities.add(delegation.authority);
  stats.uniqueContracts.add(delegation.delegatedTo);
  
  console.log(`New delegation: ${delegation.txHash}`);
});

// API Routes

// Health check
app.get('/health', async (req, res) => {
  try {
    const blockNumber = await scanner.provider.getBlockNumber();
    res.json({
      status: 'healthy',
      network,
      currentBlock: blockNumber,
      uptime: Math.floor((Date.now() - stats.startTime) / 1000),
      monitoring: scanner.isMonitoring || false
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Get statistics
app.get('/stats', (req, res) => {
  res.json({
    network,
    totalDelegations: stats.totalDelegations,
    uniqueAuthorities: stats.uniqueAuthorities.size,
    uniqueContracts: stats.uniqueContracts.size,
    uptime: Math.floor((Date.now() - stats.startTime) / 1000)
  });
});

// Get recent delegations
app.get('/delegations', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const recent = Array.from(delegations.values())
    .sort((a, b) => b.blockNumber - a.blockNumber)
    .slice(0, limit);
  
  res.json({
    count: recent.length,
    delegations: recent
  });
});

// Get delegation by transaction hash
app.get('/delegation/:txHash', (req, res) => {
  const delegation = delegations.get(req.params.txHash);
  
  if (!delegation) {
    return res.status(404).json({ error: 'Delegation not found' });
  }
  
  res.json(delegation);
});

// Get delegations by authority
app.get('/authority/:address', (req, res) => {
  const address = req.params.address.toLowerCase();
  const authorityDelegations = delegationsByAuthority.get(address) || [];
  
  res.json({
    authority: address,
    count: authorityDelegations.length,
    delegations: authorityDelegations
  });
});

// Scan specific block
app.post('/scan/block/:blockNumber', async (req, res) => {
  try {
    const blockNumber = parseInt(req.params.blockNumber);
    const blockDelegations = await scanner.scanBlock(blockNumber);
    
    // Store found delegations
    blockDelegations.forEach(d => {
      delegations.set(d.txHash, d);
      if (!delegationsByAuthority.has(d.authority)) {
        delegationsByAuthority.set(d.authority, []);
      }
      delegationsByAuthority.get(d.authority).push(d);
    });
    
    res.json({
      block: blockNumber,
      found: blockDelegations.length,
      delegations: blockDelegations
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Scan block range
app.post('/scan/range', async (req, res) => {
  try {
    const { startBlock, endBlock } = req.body;
    
    if (!startBlock || !endBlock) {
      return res.status(400).json({ error: 'startBlock and endBlock required' });
    }
    
    const allDelegations = [];
    
    for (let block = startBlock; block <= endBlock; block++) {
      const blockDelegations = await scanner.scanBlock(block);
      allDelegations.push(...blockDelegations);
    }
    
    res.json({
      startBlock,
      endBlock,
      found: allDelegations.length,
      delegations: allDelegations
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get delegation history for an address
app.get('/history/:address', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = await scanner.getDelegationHistory(req.params.address, limit);
    
    res.json({
      address: req.params.address,
      count: history.length,
      history
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start/stop monitoring
app.post('/monitor/start', async (req, res) => {
  try {
    if (scanner.isMonitoring) {
      return res.json({ status: 'already monitoring' });
    }
    
    await scanner.startMonitoring();
    res.json({ status: 'monitoring started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/monitor/stop', async (req, res) => {
  try {
    await scanner.stopMonitoring();
    res.json({ status: 'monitoring stopped' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🚀 EIP-7702 API Server running on port ${PORT}`);
  console.log(`📡 Network: ${network}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  GET  /health                - Health check`);
  console.log(`  GET  /stats                 - Statistics`);
  console.log(`  GET  /delegations           - Recent delegations`);
  console.log(`  GET  /delegation/:txHash    - Get delegation by TX hash`);
  console.log(`  GET  /authority/:address    - Get delegations by authority`);
  console.log(`  GET  /history/:address      - Get delegation history`);
  console.log(`  POST /scan/block/:number    - Scan specific block`);
  console.log(`  POST /scan/range            - Scan block range`);
  console.log(`  POST /monitor/start         - Start monitoring`);
  console.log(`  POST /monitor/stop          - Stop monitoring`);
  
  // Auto-start monitoring
  console.log(`\n🔍 Starting automatic monitoring...`);
  try {
    await scanner.startMonitoring();
    console.log('✅ Monitoring started successfully\n');
  } catch (error) {
    console.error('❌ Failed to start monitoring:', error.message);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await scanner.stopMonitoring();
  process.exit(0);
});