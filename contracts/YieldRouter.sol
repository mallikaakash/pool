// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.28;
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IPYieldToken} from "@pendle/core-v2/contracts/interfaces/IPYieldToken.sol";
import {IStandardizedYield} from "@pendle/core-v2/contracts/interfaces/IStandardizedYield.sol";

/// @notice Atomic transfers into Pendle: intermediate balances cannot be claimed by another user.
contract YieldRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;
    IStandardizedYield public immutable sy;
    IPYieldToken public immutable yt;
    IERC20 public immutable pt;
    IERC20 public immutable vault;

    constructor(IStandardizedYield s, IPYieldToken y, IERC20 v) {
        sy = s;
        yt = y;
        pt = IERC20(y.PT());
        vault = v;
        v.safeApprove(address(s), type(uint256).max);
    }

    function split(uint256 shares, uint256 minPY) external nonReentrant returns (uint256 amount) {
        vault.safeTransferFrom(msg.sender, address(this), shares);
        sy.deposit(address(yt), address(vault), shares, shares);
        amount = yt.mintPY(msg.sender, msg.sender);
        require(amount >= minPY, "slippage");
    }

    function redeem(uint256 amount, uint256 minShares) external nonReentrant returns (uint256 shares) {
        pt.safeTransferFrom(msg.sender, address(yt), amount);
        if (!yt.isExpired()) IERC20(address(yt)).safeTransferFrom(msg.sender, address(yt), amount);
        uint256 syOut = yt.redeemPY(address(this));
        shares = sy.redeem(msg.sender, syOut, address(vault), minShares, false);
    }
}
