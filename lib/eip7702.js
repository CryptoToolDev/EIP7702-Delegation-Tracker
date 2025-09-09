const { ethers } = require('ethers');
const { encode: rlpEncode } = require('@ethersproject/rlp');

/**
 * Recover the authority address from an EIP-7702 authorization signature
 * 
 * EIP-7702 authorization format:
 * - chainId: The chain ID for which this authorization is valid
 * - address: The address to delegate to (implementation contract)
 * - nonce: The nonce for replay protection
 * - v, r, s: The signature components
 * 
 * The authority is the address that signed this authorization
 */
async function recoverAuthorityAddress(authorization, chainId) {
    try {
        // Only log debug info if DEBUG_AUTH environment variable is set
        if (process.env.DEBUG_AUTH === 'true') {
            console.log('Recovering authority from authorization:', {
                chainId: authorization.chainId,
                address: authorization.address,
                nonce: authorization.nonce,
                v: authorization.v,
                r: authorization.r,
                s: authorization.s
            });
        }

        // EIP-7702 uses a specific message format for signing
        // The message is: keccak256(MAGIC || rlp([chainId, address, nonce]))
        // MAGIC = 0x05 for EIP-7702
        
        // Prepare values for RLP encoding
        const authChainId = authorization.chainId || chainId;
        const authAddress = authorization.address || '0x';
        const authNonce = authorization.nonce || 0;
        
        // Convert values to hex strings for RLP encoding
        const chainIdHex = ethers.toBeHex(BigInt(authChainId));
        const nonceHex = authNonce === 0 || authNonce === '0x0' ? '0x' : ethers.toBeHex(BigInt(authNonce));
        
        // Create the authorization tuple for RLP encoding
        const authTuple = [
            chainIdHex,
            authAddress,
            nonceHex
        ];
        
        // RLP encode the authorization tuple
        const rlpEncoded = rlpEncode(authTuple);
        
        // Create the message hash according to EIP-7702
        // The signed message is: keccak256(0x05 || rlp([chainId, address, nonce]))
        const magic = '0x05';
        const messageHash = ethers.keccak256(ethers.concat([magic, rlpEncoded]));
        
        if (process.env.DEBUG_AUTH === 'true') {
            console.log('RLP encoded data:', rlpEncoded);
            console.log('Message hash:', messageHash);
        }
        
        // Handle both yParity and v formats
        // EIP-7702 uses yParity (0 or 1), but ethers expects v (27 or 28)
        let v;
        if (authorization.v !== undefined && authorization.v !== null) {
            v = authorization.v;
        } else if (authorization.yParity !== undefined && authorization.yParity !== null) {
            // Convert yParity to v
            const yParity = BigInt(authorization.yParity);
            v = yParity === 0n ? 27 : 28;
        } else {
            // Silently return null if missing signature parameters
            return null;
        }
        
        // Recover the address from the signature
        const signature = {
            r: authorization.r,
            s: authorization.s,
            v: v
        };
        
        if (process.env.DEBUG_AUTH === 'true') {
            console.log('Using signature with v:', v);
        }
        
        // Try to recover using the signature
        const recoveredAddress = ethers.recoverAddress(messageHash, signature);
        
        if (process.env.DEBUG_AUTH === 'true') {
            console.log('Recovered authority address:', recoveredAddress);
        }
        return recoveredAddress.toLowerCase();
        
    } catch (error) {
        // Only log errors if DEBUG_AUTH is enabled
        if (process.env.DEBUG_AUTH === 'true') {
            console.error('Failed to recover authority address:', error);
            console.error('Authorization data:', authorization);
        }
        
        // Try alternative recovery without the magic prefix
        try {
            const authChainId = authorization.chainId || chainId;
            const authAddress = authorization.address || '0x';
            const authNonce = authorization.nonce || 0;
            
            // Convert values to hex strings for RLP encoding
            const chainIdHex = ethers.toBeHex(BigInt(authChainId));
            const nonceHex = authNonce === 0 || authNonce === '0x0' ? '0x' : ethers.toBeHex(BigInt(authNonce));
            
            // Create the authorization tuple for RLP encoding
            const authTuple = [
                chainIdHex,
                authAddress,
                nonceHex
            ];
            
            // RLP encode and hash without magic prefix
            const rlpEncoded = rlpEncode(authTuple);
            const messageHash = ethers.keccak256(rlpEncoded);
            
            // Handle both yParity and v formats for fallback
            let v;
            if (authorization.v !== undefined && authorization.v !== null) {
                v = authorization.v;
            } else if (authorization.yParity !== undefined && authorization.yParity !== null) {
                // Convert yParity to v
                const yParity = BigInt(authorization.yParity);
                v = yParity === 0n ? 27 : 28;
            } else {
                v = 27; // Default fallback
            }
            
            const signature = {
                r: authorization.r || '0x0',
                s: authorization.s || '0x0',
                v: v
            };
            
            const recovered = ethers.recoverAddress(messageHash, signature);
            if (process.env.DEBUG_AUTH === 'true') {
                console.log('Alternative recovery (no magic) succeeded:', recovered);
            }
            return recovered.toLowerCase();
            
        } catch (altError) {
            if (process.env.DEBUG_AUTH === 'true') {
                console.error('Alternative recovery also failed:', altError);
            }
        }
        
        // If we can't recover, return null
        return null;
    }
}

/**
 * Extract signature data from raw transaction if RPC doesn't provide it
 */
function extractSignatureFromRawTx(rawTx, authIndex) {
    try {
        if (!rawTx) return null;
        
        // Remove 0x prefix if present
        const txData = rawTx.startsWith('0x') ? rawTx.slice(2) : rawTx;
        
        // EIP-7702 transactions start with type byte 0x04
        if (txData.slice(0, 2) !== '04') {
            return null;
        }
        
        // Try to decode the RLP data
        // This is a simplified approach - full RLP decoding would be more robust
        // The authorization list is typically after the standard transaction fields
        // Format: type || rlp([chain_id, nonce, max_priority_fee, max_fee, gas, to, value, data, access_list, authorization_list])
        
        // This is complex to parse manually, so we'll return null for now
        // A proper implementation would need full RLP decoding
        return null;
    } catch (error) {
        if (process.env.DEBUG_AUTH === 'true') {
            console.log('Failed to extract signature from raw tx:', error);
        }
        return null;
    }
}

/**
 * Try alternative methods to recover authority when signature data is missing
 */
async function tryAlternativeRecovery(tx, auth, chainId, provider) {
    try {
        // Method 1: Try to get the raw transaction and parse it
        if (provider && tx.hash) {
            try {
                // Some providers support getRawTransaction
                const rawTx = await provider.send('eth_getRawTransactionByHash', [tx.hash]).catch(() => null);
                if (rawTx) {
                    if (process.env.DEBUG_AUTH === 'true') {
                        console.log('Got raw transaction, attempting to extract signature');
                    }
                    // This would need proper RLP decoding implementation
                    // For now, we acknowledge the limitation
                }
            } catch (err) {
                // Raw transaction method not available
            }
        }
        
        // Method 2: Check if the transaction sender might be the authority
        // In some cases, the authority might be the same as the transaction sender
        // This is a heuristic and not always accurate
        if (auth.address && tx.from) {
            // Check if the delegated-to address has EIP-7702 code
            if (provider) {
                const code = await provider.getCode(auth.address);
                if (code && code.startsWith('0xef0100')) {
                    // This is a delegated account, so tx.from might be the authority
                    // But this is just a guess
                    if (process.env.DEBUG_AUTH === 'true') {
                        console.log('Detected EIP-7702 delegation code, but cannot recover authority without signature');
                    }
                }
            }
        }
        
        return null;
    } catch (error) {
        if (process.env.DEBUG_AUTH === 'true') {
            console.log('Alternative recovery failed:', error);
        }
        return null;
    }
}

/**
 * Process an EIP-7702 authorization list and extract authorities
 */
async function extractAuthoritiesFromTransaction(tx, chainId, provider = null) {
    const authorities = [];
    
    if (!tx.authorizationList || tx.authorizationList.length === 0) {
        console.log('No authorization list in transaction');
        return authorities;
    }
    
    for (let i = 0; i < tx.authorizationList.length; i++) {
        const auth = tx.authorizationList[i];
        
        // First try standard recovery
        let authority = await recoverAuthorityAddress(auth, chainId);
        
        // If standard recovery fails due to missing signature data, try alternatives
        if (!authority && (!auth.r || !auth.s)) {
            if (process.env.DEBUG_AUTH === 'true') {
                console.log(`Authorization ${i} missing signature data, trying alternative recovery`);
            }
            authority = await tryAlternativeRecovery(tx, auth, chainId, provider);
        }
        
        if (authority) {
            authorities.push(authority);
        } else {
            // If we can't recover, log it but continue
            if (process.env.DEBUG_AUTH === 'true') {
                console.warn(`Could not recover authority for authorization ${i}:`, {
                    hasR: !!auth.r,
                    hasS: !!auth.s,
                    hasV: !!auth.v,
                    hasYParity: !!auth.yParity,
                    address: auth.address
                });
            }
        }
    }
    
    return authorities;
}

module.exports = {
    recoverAuthorityAddress,
    extractAuthoritiesFromTransaction,
    extractSignatureFromRawTx,
    tryAlternativeRecovery
};