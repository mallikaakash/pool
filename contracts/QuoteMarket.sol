// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.28;
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @notice All-or-nothing signed bids: maker buys PT/YT, taker receives test currency.
contract QuoteMarket is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;
    struct Bid { address maker; address taker; address token; uint256 amount; uint256 payment; uint256 deadline; uint256 nonce; }
    bytes32 public constant BID_TYPEHASH = keccak256("Bid(address maker,address taker,address token,uint256 amount,uint256 payment,uint256 deadline,uint256 nonce)");
    IERC20 public immutable cash;
    address public immutable pt;
    address public immutable yt;
    mapping(address => mapping(uint256 => bool)) public usedNonce;
    event Filled(address indexed maker, address indexed taker, address indexed token, uint256 amount, uint256 payment, uint256 nonce);
    event Cancelled(address indexed maker, uint256 nonce);
    constructor(IERC20 currency, address principal, address yieldToken) EIP712("Pool Quotes", "1") {
        require(address(currency) != address(0) && principal != address(0) && yieldToken != address(0), "zero address");
        cash = currency; pt = principal; yt = yieldToken;
    }
    function digest(Bid calldata b) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(BID_TYPEHASH, b)));
    }
    function cancel(uint256 nonce) external { usedNonce[msg.sender][nonce] = true; emit Cancelled(msg.sender, nonce); }
    function fill(Bid calldata b, bytes calldata signature) external nonReentrant {
        require(b.taker == msg.sender && b.maker != msg.sender, "wrong taker");
        require(b.token == pt || b.token == yt, "unsupported token");
        require(b.amount > 0 && b.payment > 0 && block.timestamp <= b.deadline, "invalid bid");
        require(!usedNonce[b.maker][b.nonce], "nonce used");
        require(ECDSA.recover(digest(b), signature) == b.maker, "wrong maker");
        usedNonce[b.maker][b.nonce] = true;
        IERC20(b.token).safeTransferFrom(msg.sender, b.maker, b.amount);
        cash.safeTransferFrom(b.maker, msg.sender, b.payment);
        emit Filled(b.maker, msg.sender, b.token, b.amount, b.payment, b.nonce);
    }
}
