#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');
const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

// Import core modules
const EIP7702Scanner = require('./lib/scanner');

// Version from package.json
const packageJson = require('./package.json');

program
  .name('eip7702')
  .description('CLI tool for tracking EIP-7702 delegations on EVM chains')
  .version(packageJson.version || '1.0.0');

// Command: scan - Scan for new delegations on a network
program
  .command('scan')
  .description('Scan for new EIP-7702 delegations on a specific network')
  .option('-n, --network <network>', 'Network to scan (ethereum, bsc, arbitrum, base, optimism, polygon)', 'ethereum')
  .option('-b, --blocks <number>', 'Number of blocks to scan', '100')
  .option('-f, --from-block <number>', 'Starting block number (default: latest - blocks)')
  .option('-r, --rpc <url>', 'RPC URL (required)')
  .option('-o, --output <format>', 'Output format (table, json, csv)', 'table')
  .option('--save <file>', 'Save results to file')
  .action(async (options) => {
    const spinner = ora(`Scanning ${options.network} for EIP-7702 delegations...`).start();
    
    try {
      if (!options.rpc) {
        throw new Error('RPC URL is required. Please provide one using --rpc flag');
      }
      const scanner = new EIP7702Scanner(options.network, options.rpc);
      const results = await scanner.scanBlocks(options.blocks, options.fromBlock);
      
      spinner.succeed(`Found ${results.length} delegations`);
      
      // Display results
      displayResults(results, options.output);
      
      // Save if requested
      if (options.save) {
        saveResults(results, options.save, options.output);
        console.log(chalk.green(`✅ Results saved to ${options.save}`));
      }
      
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Command: check - Check current delegation for an authority
program
  .command('check <authority>')
  .description('Check the current delegation status for an authority address')
  .option('-n, --network <network>', 'Network to check (ethereum, bsc, arbitrum, base, optimism, polygon)', 'ethereum')
  .option('-r, --rpc <url>', 'RPC URL (required)')
  .option('-v, --verbose', 'Show detailed information')
  .action(async (authority, options) => {
    const spinner = ora(`Checking delegation for ${authority}...`).start();
    
    try {
      // Validate address
      if (!ethers.isAddress(authority)) {
        throw new Error('Invalid Ethereum address');
      }
      
      if (!options.rpc) {
        throw new Error('RPC URL is required. Please provide one using --rpc flag');
      }
      const scanner = new EIP7702Scanner(options.network, options.rpc);
      const delegation = await scanner.getCurrentDelegation(authority);
      
      spinner.stop();
      
      if (delegation) {
        console.log(chalk.green('\n✅ Active Delegation Found\n'));
        
        const table = new Table({
          chars: { 'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' }
        });
        
        table.push(
          [chalk.gray('Authority:'), chalk.cyan(authority)],
          [chalk.gray('Delegated To:'), chalk.yellow(delegation.implementation)],
          [chalk.gray('Network:'), options.network],
          [chalk.gray('Status:'), chalk.green('Active')]
        );
        
        if (options.verbose && delegation.code) {
          table.push([chalk.gray('Code:'), delegation.code.slice(0, 66) + '...']);
        }
        
        console.log(table.toString());
        
        if (delegation.implementation === '0x0000000000000000000000000000000000000000') {
          console.log(chalk.yellow('\n⚠️  Delegation has been revoked (delegated to zero address)'));
        }
      } else {
        console.log(chalk.yellow('\n⚠️  No active delegation found\n'));
        console.log(chalk.gray(`Address ${authority} has not delegated to any implementation`));
      }
      
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Command: watch - Watch for real-time delegations
program
  .command('watch')
  .description('Watch for real-time EIP-7702 delegations')
  .option('-n, --network <network>', 'Network to watch (ethereum, bsc, arbitrum, base, optimism, polygon)', 'ethereum')
  .option('-r, --rpc <url>', 'RPC URL (required)')
  .option('-f, --filter <address>', 'Filter by authority or delegate address')
  .option('--ws <url>', 'WebSocket URL for real-time updates')
  .action(async (options) => {
    console.log(chalk.cyan('🔍 Watching for EIP-7702 delegations...\n'));
    
    try {
      if (!options.rpc) {
        throw new Error('RPC URL is required. Please provide one using --rpc flag');
      }
      const scanner = new EIP7702Scanner(options.network, options.rpc, options.ws);
      
      scanner.on('delegation', (delegation) => {
        // Apply filter if specified
        if (options.filter) {
          const filterAddr = options.filter.toLowerCase();
          if (delegation.authority.toLowerCase() !== filterAddr && 
              delegation.delegatedTo.toLowerCase() !== filterAddr) {
            return;
          }
        }
        
        const timestamp = new Date().toLocaleTimeString();
        console.log(chalk.gray(`[${timestamp}]`), 
                   chalk.green('New Delegation:'),
                   chalk.cyan(delegation.authority.slice(0, 10) + '...'),
                   chalk.gray('→'),
                   chalk.yellow(delegation.delegatedTo.slice(0, 10) + '...'),
                   chalk.gray(`(tx: ${delegation.txHash.slice(0, 10)}...)`));
      });
      
      scanner.on('error', (error) => {
        console.error(chalk.red('Error:'), error.message);
      });
      
      await scanner.watchBlocks();
      
      // Keep process alive
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\nStopping watcher...'));
        scanner.stop();
        process.exit(0);
      });
      
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Command: history - Get delegation history for an address
program
  .command('history <address>')
  .description('Get delegation history for an authority address')
  .option('-n, --network <network>', 'Network to check (ethereum, bsc, arbitrum, base, optimism, polygon)', 'ethereum')
  .option('-r, --rpc <url>', 'RPC URL (required)')
  .option('-l, --limit <number>', 'Maximum number of results', '10')
  .option('-o, --output <format>', 'Output format (table, json, csv)', 'table')
  .action(async (address, options) => {
    const spinner = ora(`Fetching delegation history for ${address}...`).start();
    
    try {
      // Validate address
      if (!ethers.isAddress(address)) {
        throw new Error('Invalid Ethereum address');
      }
      
      const scanner = new EIP7702Scanner(options.network, options.rpc);
      const history = await scanner.getDelegationHistory(address, options.limit);
      
      spinner.succeed(`Found ${history.length} delegation(s)`);
      
      if (history.length === 0) {
        console.log(chalk.yellow('\nNo delegation history found'));
        return;
      }
      
      displayHistory(history, options.output);
      
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Command: networks - List supported networks
program
  .command('networks')
  .description('List all supported networks and their chain IDs')
  .action(() => {
    console.log(chalk.cyan('\n📡 Supported Networks:\n'));
    
    const table = new Table({
      head: [chalk.white('Network'), chalk.white('Chain ID'), chalk.white('Native Token')],
      style: { head: [], border: [] }
    });
    
    const networks = [
      ['Ethereum', '1', 'ETH'],
      ['BSC', '56', 'BNB'],
      ['Arbitrum', '42161', 'ETH'],
      ['Base', '8453', 'ETH'],
      ['Optimism', '10', 'ETH'],
      ['Polygon', '137', 'MATIC']
    ];
    
    networks.forEach(([name, chainId, token]) => {
      table.push([name, chainId, token]);
    });
    
    console.log(table.toString());
  });

// Helper functions
function displayResults(results, format) {
  if (results.length === 0) {
    console.log(chalk.yellow('\nNo delegations found'));
    return;
  }
  
  if (format === 'json') {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  
  if (format === 'csv') {
    console.log('Authority,DelegatedTo,TxHash,Block,Timestamp');
    results.forEach(r => {
      console.log(`${r.authority},${r.delegatedTo},${r.txHash},${r.blockNumber},${r.timestamp}`);
    });
    return;
  }
  
  // Default: table format
  const table = new Table({
    head: [
      chalk.white('Authority'),
      chalk.white('Delegated To'),
      chalk.white('Tx Hash'),
      chalk.white('Block')
    ],
    style: { head: [], border: [] }
  });
  
  results.forEach(result => {
    table.push([
      result.authority.slice(0, 10) + '...',
      result.delegatedTo.slice(0, 10) + '...',
      result.txHash.slice(0, 10) + '...',
      result.blockNumber
    ]);
  });
  
  console.log('\n' + table.toString());
}

function displayHistory(history, format) {
  if (format === 'json') {
    console.log(JSON.stringify(history, null, 2));
    return;
  }
  
  if (format === 'csv') {
    console.log('Timestamp,DelegatedTo,TxHash,Block,Status');
    history.forEach(h => {
      console.log(`${h.timestamp},${h.delegatedTo},${h.txHash},${h.blockNumber},${h.status}`);
    });
    return;
  }
  
  // Default: table format
  const table = new Table({
    head: [
      chalk.white('Timestamp'),
      chalk.white('Delegated To'),
      chalk.white('Tx Hash'),
      chalk.white('Status')
    ],
    style: { head: [], border: [] }
  });
  
  history.forEach(entry => {
    const status = entry.delegatedTo === '0x0000000000000000000000000000000000000000' 
      ? chalk.red('Revoked') 
      : chalk.green('Active');
    
    table.push([
      new Date(entry.timestamp).toLocaleString(),
      entry.delegatedTo.slice(0, 10) + '...',
      entry.txHash.slice(0, 10) + '...',
      status
    ]);
  });
  
  console.log('\n' + table.toString());
}

function saveResults(results, filename, format) {
  let content;
  
  if (format === 'json') {
    content = JSON.stringify(results, null, 2);
  } else if (format === 'csv') {
    content = 'Authority,DelegatedTo,TxHash,Block,Timestamp\n';
    results.forEach(r => {
      content += `${r.authority},${r.delegatedTo},${r.txHash},${r.blockNumber},${r.timestamp}\n`;
    });
  } else {
    // Save as JSON by default
    content = JSON.stringify(results, null, 2);
  }
  
  fs.writeFileSync(filename, content);
}

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}