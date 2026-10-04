// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice Public claims by the designated demo attestor; not external verification of asset title.
contract AttestationRegistry is EIP712 {
    struct Claim {
        address pool;
        bytes32 root;
        address currency;
        uint256 face;
        uint256 book;
        uint256 asOf;
        uint256 validUntil;
        uint256 nonce;
    }
    bytes32 public constant CLAIM_TYPEHASH = keccak256("Claim(address pool,bytes32 root,address currency,uint256 face,uint256 book,uint256 asOf,uint256 validUntil,uint256 nonce)");
    bytes32 public constant REVOKE_TYPEHASH = keccak256("Revoke(bytes32 uid,uint256 deadline)");
    address public immutable attestor;
    mapping(bytes32 => Claim) public claims;
    mapping(bytes32 => bool) public revoked;
    mapping(uint256 => bool) public usedNonce;
    event Attested(bytes32 indexed uid, address indexed pool, bytes32 indexed root, uint256 validUntil, uint256 nonce);
    event Revoked(bytes32 indexed uid);

    constructor(address signer) EIP712("Pool Attestations", "1") {
        require(signer != address(0), "zero attestor");
        attestor = signer;
    }

    function digest(Claim calldata c) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(CLAIM_TYPEHASH, c)));
    }

    function publish(Claim calldata c, bytes calldata signature) external returns (bytes32 uid) {
        require(c.pool != address(0) && c.currency != address(0) && c.root != bytes32(0), "invalid claim");
        require(c.book > 0 && c.face >= c.book, "invalid values");
        require(c.asOf <= block.timestamp && c.validUntil > block.timestamp && c.validUntil > c.asOf, "invalid time");
        require(!usedNonce[c.nonce], "nonce used");
        uid = digest(c);
        require(ECDSA.recover(uid, signature) == attestor, "wrong attestor");
        usedNonce[c.nonce] = true;
        claims[uid] = c;
        emit Attested(uid, c.pool, c.root, c.validUntil, c.nonce);
    }

    function isValid(bytes32 uid) public view returns (bool) {
        return claims[uid].pool != address(0) && !revoked[uid] && claims[uid].validUntil > block.timestamp;
    }

    function getClaim(bytes32 uid) external view returns (Claim memory) { return claims[uid]; }

    function revoke(bytes32 uid) external {
        require(msg.sender == attestor, "attestor only");
        _revoke(uid);
    }

    function revokeSigned(bytes32 uid, uint256 deadline, bytes calldata signature) external {
        require(block.timestamp <= deadline, "expired revocation");
        bytes32 h = _hashTypedDataV4(keccak256(abi.encode(REVOKE_TYPEHASH, uid, deadline)));
        require(ECDSA.recover(h, signature) == attestor, "wrong attestor");
        _revoke(uid);
    }

    function _revoke(bytes32 uid) private {
        require(claims[uid].pool != address(0) && !revoked[uid], "unknown or revoked");
        revoked[uid] = true;
        emit Revoked(uid);
    }
}
