/**
 * Multi-Network API Server Example
 * 
 * REST API that monitors multiple networks simultaneously
 */

const express = require('express');
const { MultiNetworkScanner } = require('../lib/index');

const app = express();
app.use(express.json());

// Initialize multi-network scanner
const networks = process.env.NETWORKS ? 
  process.env.NETWORKS.split(',') : 
  ['ethereum', 'bsc', 'arbitrum', 'base'];

const scanner = new MultiNetworkScanner(networks);

// Track delegations per network (stateless - just for current session)
const recentDelegations = new Map();
networks.forEach(network => recentDelegations.set(network, []));

// Process delegations - scanner is stateless, we just forward events
scanner.on('delegation', (delegation) => {
  // Keep last 100 delegations per network for API responses
  const networkDelegations = recentDelegations.get(delegation.network);
  networkDelegations.unshift(delegation);
  if (networkDelegations.length > 100) {
    networkDelegations.pop();
  }
  
  console.log(`[${delegation.network}] New delegation: ${delegation.txHash}`);
});

scanner.on('error', ({ network, error }) => {
  console.error(`[${network}] Error: ${error.message || error}`);
});

// API Routes

// Get status of all networks
app.get('/status', (req, res) => {
  const status = scanner.getStatus();
  const response = {
    networks: Object.keys(status).length,
    monitoring: scanner.isMonitoring,
    details: status
  };
  res.json(response);
});

// Get recent delegations from all networks
app.get('/delegations', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const network = req.query.network;
  
  let allDelegations = [];
  
  if (network) {
    // Get delegations from specific network
    allDelegations = recentDelegations.get(network) || [];
  } else {
    // Combine from all networks
    recentDelegations.forEach(delegations => {
      allDelegations.push(...delegations);
    });
    // Sort by timestamp
    allDelegations.sort((a, b) => b.timestamp - a.timestamp);
  }
  
  res.json({
    count: Math.min(allDelegations.length, limit),
    delegations: allDelegations.slice(0, limit)
  });
});

// Get delegations by network
app.get('/network/:network/delegations', (req, res) => {
  const network = req.params.network;
  const limit = parseInt(req.query.limit) || 50;
  
  if (!scanner.getNetworks().includes(network)) {
    return res.status(404).json({ error: `Network ${network} not found` });
  }
  
  const delegations = recentDelegations.get(network) || [];
  
  res.json({
    network,
    count: Math.min(delegations.length, limit),
    delegations: delegations.slice(0, limit)
  });
});

// Scan specific block across all networks
app.post('/scan/block/:blockNumber', async (req, res) => {
  try {
    const blockNumber = parseInt(req.params.blockNumber);
    const delegations = await scanner.scanBlock(blockNumber);
    
    res.json({
      block: blockNumber,
      networks: scanner.getNetworks(),
      found: delegations.length,
      delegations
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get delegation history for address across all networks
app.get('/address/:address/history', async (req, res) => {
  try {
    const address = req.params.address;
    const limit = parseInt(req.query.limit) || 10;
    
    const history = await scanner.getDelegationHistory(address, limit);
    
    // Group by network
    const byNetwork = {};
    history.forEach(h => {
      if (!byNetwork[h.network]) {
        byNetwork[h.network] = [];
      }
      byNetwork[h.network].push(h);
    });
    
    res.json({
      address,
      totalFound: history.length,
      byNetwork,
      allHistory: history
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a new network
app.post('/network/:network/add', (req, res) => {
  const network = req.params.network;
  const { rpcUrl, wsUrl } = req.body;
  
  const success = scanner.addNetwork(network, rpcUrl, wsUrl);
  
  if (success) {
    recentDelegations.set(network, []);
    res.json({ message: `Network ${network} added successfully` });
  } else {
    res.status(400).json({ error: `Failed to add network ${network}` });
  }
});

// Remove a network
app.delete('/network/:network', async (req, res) => {
  const network = req.params.network;
  
  const success = await scanner.removeNetwork(network);
  
  if (success) {
    recentDelegations.delete(network);
    res.json({ message: `Network ${network} removed successfully` });
  } else {
    res.status(404).json({ error: `Network ${network} not found` });
  }
});

// Start/stop monitoring
app.post('/monitor/start', async (req, res) => {
  try {
    await scanner.startMonitoring();
    res.json({ message: 'Monitoring started for all networks' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/monitor/stop', async (req, res) => {
  try {
    await scanner.stopMonitoring();
    res.json({ message: 'Monitoring stopped for all networks' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket endpoint for real-time updates
const http = require('http');
const WebSocket = require('ws');

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// Broadcast delegations to WebSocket clients
scanner.on('delegation', (delegation) => {
  const message = JSON.stringify({
    type: 'delegation',
    data: delegation
  });
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
});

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  // Send current status
  ws.send(JSON.stringify({
    type: 'status',
    data: scanner.getStatus()
  }));
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3000;

server.listen(PORT, async () => {
  console.log(`🚀 Multi-Network EIP-7702 API Server`);
  console.log(`📡 Monitoring: ${networks.join(', ')}`);
  console.log(`🌐 HTTP API: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /status                      - Network status`);
  console.log(`  GET  /delegations                  - Recent delegations (all networks)`);
  console.log(`  GET  /network/:network/delegations - Delegations by network`);
  console.log(`  GET  /address/:address/history     - Address history (all networks)`);
  console.log(`  POST /scan/block/:number           - Scan block (all networks)`);
  console.log(`  POST /network/:network/add         - Add network`);
  console.log(`  DELETE /network/:network           - Remove network`);
  console.log(`  POST /monitor/start                - Start monitoring`);
  console.log(`  POST /monitor/stop                 - Stop monitoring`);
  
  // Auto-start monitoring
  console.log(`\n🔍 Starting monitoring...`);
  try {
    await scanner.startMonitoring();
    console.log('✅ Monitoring started\n');
  } catch (error) {
    console.error('❌ Failed to start monitoring:', error.message);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  await scanner.stopMonitoring();
  server.close();
  process.exit(0);
});