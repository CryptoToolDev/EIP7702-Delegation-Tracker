/**
 * EIP-7702 CLI Library
 * 
 * Exports both single and multi-network scanners
 */

const { EIP7702Scanner } = require('./scanner');
const { MultiNetworkScanner } = require('./multi-scanner');

module.exports = {
  EIP7702Scanner,
  MultiNetworkScanner,
  // Maintain backward compatibility
  Scanner: EIP7702Scanner
};