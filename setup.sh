#!/bin/bash

# EIP-7702 CLI Setup Script

echo "Setting up EIP-7702 CLI..."

# Install dependencies
echo "Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOL
# Network Configuration
EIP7702_DEFAULT_NETWORK=arbitrum

# Custom RPC URLs (optional)
# ETHEREUM_RPC_URL=https://your-eth-rpc.com
# BSC_RPC_URL=https://your-bsc-rpc.com
# ARBITRUM_RPC_URL=https://your-arb-rpc.com

# Custom WebSocket URLs (optional)
# ETHEREUM_WS_URL=wss://your-eth-ws.com
# BSC_WS_URL=wss://your-bsc-ws.com
# ARBITRUM_WS_URL=wss://your-arb-ws.com
EOL
    echo ".env file created. Please add your RPC/WS endpoints if needed."
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Usage:"
echo "  1. As a library: const { MultiNetworkScanner } = require('./lib');"
echo "  2. Run examples: node examples/realtime-multi-target.js"
echo "  3. Install globally: npm link (then use 'eip7702' command)"
echo ""
echo "See README.md for detailed documentation."