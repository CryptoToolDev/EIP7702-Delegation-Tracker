@echo off
REM EIP-7702 CLI Setup Script for Windows

echo Setting up EIP-7702 CLI...

REM Install dependencies
echo Installing dependencies...
call npm install

REM Create .env file if it doesn't exist
if not exist .env (
    echo Creating .env file...
    (
        echo # Network Configuration
        echo EIP7702_DEFAULT_NETWORK=arbitrum
        echo.
        echo # Custom RPC URLs ^(optional^)
        echo # ETHEREUM_RPC_URL=https://your-eth-rpc.com
        echo # BSC_RPC_URL=https://your-bsc-rpc.com
        echo # ARBITRUM_RPC_URL=https://your-arb-rpc.com
        echo.
        echo # Custom WebSocket URLs ^(optional^)
        echo # ETHEREUM_WS_URL=wss://your-eth-ws.com
        echo # BSC_WS_URL=wss://your-bsc-ws.com
        echo # ARBITRUM_WS_URL=wss://your-arb-ws.com
    ) > .env
    echo .env file created. Please add your RPC/WS endpoints if needed.
)

echo.
echo Setup complete!
echo.
echo Usage:
echo   1. As a library: const { MultiNetworkScanner } = require('./lib');
echo   2. Run examples: node examples/realtime-multi-target.js
echo   3. Install globally: npm link (then use 'eip7702' command)
echo.
echo See README.md for detailed documentation.
pause