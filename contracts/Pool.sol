// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IMorpho, MarketParams, Market, Id} from "@morpho-org/morpho-blue/src/interfaces/IMorpho.sol";
import {MorphoBalancesLib} from "@morpho-org/morpho-blue/src/libraries/periphery/MorphoBalancesLib.sol";
import {MarketParamsLib} from "@morpho-org/morpho-blue/src/libraries/MarketParamsLib.sol";

/// @notice Disposable local test currency. Never represents issuer-backed USDG.
contract TestDollar is ERC20 {
    address public immutable faucet;

    constructor() ERC20("Test Dollar - local only", "tUSD") {
        faucet = msg.sender;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == faucet, "faucet only");
        _mint(to, amount);
    }
}

/// @notice Deterministic 12% APR for demonstrations; NOT Morpho's AdaptiveCurveIRM.
contract DemoRateModel {
    uint256 public constant RATE = uint256(12e16) / 365 days;

    function borrowRateView(MarketParams memory, Market memory) external pure returns (uint256) {
        return RATE;
    }

    function borrowRate(MarketParams memory, Market memory) external pure returns (uint256) {
        return RATE;
    }
}

/// @notice Synthetic assigned-receivable portfolio, also the Morpho borrower.
/// Offchain title and valuation are deliberately a trusted-servicer boundary.
contract ReceivablePool is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using MorphoBalancesLib for IMorpho;
    using MarketParamsLib for MarketParams;

    struct Invoice {
        uint256 face;
        uint256 book;
        uint256 collected;
        uint256 loss;
        uint256 due;
        bytes32 evidence;
    }
    Invoice[] public invoices;
    IERC20 public immutable cash;
    address public immutable servicer;
    IMorpho public morpho;
    MarketParams public params;
    bool public activated;
    bool public closed;
    bool public hasBorrowed;
    uint256 public receivableValue;
    uint256 public totalImpairment;
    bool private sweeping;
    event Collected(uint256 indexed invoice, uint256 amount, uint256 bookReleased);
    event Impaired(uint256 indexed invoice, uint256 loss);
    event Swept(uint256 amount);
    event FacilityClosed();
    modifier onlyServicer() {
        require(msg.sender == servicer, "servicer only");
        _;
    }

    constructor(IERC20 dollar, address operator) ERC20("Pool receivables - synthetic", "rINV") {
        cash = dollar;
        servicer = operator;
        uint256[5] memory faces = [uint256(120_000e6), 100_000e6, 90_000e6, 110_000e6, 80_000e6];
        for (uint256 i; i < 5; ++i) {
            uint256 book = faces[i] * 97 / 100;
            invoices.push(
                Invoice(
                    faces[i],
                    book,
                    0,
                    0,
                    block.timestamp + (30 + i * 15) * 1 days,
                    keccak256(abi.encode("SYNTHETIC-SG-2026", i, faces[i]))
                )
            );
            receivableValue += book;
        }
        _mint(address(this), receivableValue);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function nav() public view returns (uint256) {
        return receivableValue + cash.balanceOf(address(this));
    }

    function debt() public view returns (uint256) {
        return activated ? morpho.expectedBorrowAssets(params, address(this)) : 0;
    }

    function activate(IMorpho engine, MarketParams calldata marketParams) external onlyServicer {
        require(
            !activated && marketParams.collateralToken == address(this) && marketParams.loanToken == address(cash),
            "invalid setup"
        );
        activated = true;
        morpho = engine;
        params = marketParams;
        _approve(address(this), address(engine), type(uint256).max);
        cash.safeApprove(address(engine), type(uint256).max);
        engine.supplyCollateral(params, balanceOf(address(this)), address(this), "");
    }

    function borrow(uint256 amount) external onlyServicer nonReentrant {
        require(activated && !closed && amount > 0, "facility unavailable");
        hasBorrowed = true;
        morpho.borrow(params, amount, 0, address(this), servicer);
    }

    function collect(uint256 id, uint256 amount) external onlyServicer nonReentrant {
        Invoice storage inv = invoices[id];
        uint256 remaining = inv.face - inv.collected;
        require(amount > 0 && amount <= remaining, "invalid collection");
        uint256 released = amount == remaining ? inv.book : Math.mulDiv(inv.book, amount, remaining);
        inv.book -= released;
        inv.collected += amount;
        receivableValue -= released;
        cash.safeTransferFrom(msg.sender, address(this), amount);
        emit Collected(id, amount, released);
    }

    function impair(uint256 id, uint256 newBook) external onlyServicer {
        Invoice storage inv = invoices[id];
        require(newBook < inv.book, "loss must lower book value");
        uint256 loss = inv.book - newBook;
        inv.book = newBook;
        inv.loss += loss;
        receivableValue -= loss;
        totalImpairment += loss;
        emit Impaired(id, loss);
    }

    /// @notice Anyone may sweep collections, but only to the configured facility's debt.
    function sweep() external nonReentrant returns (uint256 paid) {
        require(activated && !closed, "facility unavailable");
        morpho.accrueInterest(params);
        uint256 available = cash.balanceOf(address(this));
        uint256 owed = debt();
        require(available > 0 && owed > 0, "nothing to sweep");
        sweeping = true;
        if (available >= owed) {
            (paid,) = morpho.repay(
                params, 0, morpho.position(params.id(), address(this)).borrowShares, address(this), hex"01"
            );
        } else {
            (paid,) = morpho.repay(params, available, 0, address(this), hex"01");
        }
        sweeping = false;
        emit Swept(paid);
    }

    /// @notice Morpho has reduced debt, but has not yet pulled the repayment cash.
    /// Retire only the borrower's shares at the PRE-payment NAV. This preserves
    /// per-share NAV for liquidators that already hold unpledged rINV.
    function onMorphoRepay(uint256 assets, bytes calldata) external {
        require(msg.sender == address(morpho) && sweeping, "invalid callback");
        uint256 shares = Math.mulDiv(assets, totalSupply(), nav(), Math.Rounding.Up);
        require(shares <= morpho.position(params.id(), address(this)).collateral, "exceeds borrower claim");
        // Morpho rejects a collateral withdrawal while still unhealthy. In that
        // case the whole sweep reverts; liquidate or restore solvency first.
        morpho.withdrawCollateral(params, shares, address(this), address(this));
        _burn(address(this), shares);
    }

    function close() external nonReentrant {
        require(activated && !closed && debt() == 0 && (hasBorrowed || msg.sender == servicer), "debt outstanding");
        closed = true;
        uint256 locked = morpho.position(params.id(), address(this)).collateral;
        if (locked > 0) morpho.withdrawCollateral(params, locked, address(this), servicer);
        emit FacilityClosed();
    }

    function redeemCollateral(uint256 shares) external nonReentrant returns (uint256 assets) {
        require(closed && shares > 0, "close facility first");
        assets = Math.mulDiv(shares, nav(), totalSupply());
        require(assets <= cash.balanceOf(address(this)), "await collections");
        _burn(msg.sender, shares);
        cash.safeTransfer(msg.sender, assets);
    }
}

contract ReceivableOracle {
    ReceivablePool public immutable pool;

    constructor(ReceivablePool portfolio) {
        pool = portfolio;
    }

    /// @notice Book NAV only. A quote is NOT a bid or a guarantee of recoverability.
    function price() external view returns (uint256) {
        return pool.totalSupply() == 0 ? 0 : Math.mulDiv(pool.nav(), 1e36, pool.totalSupply());
    }
}

contract LenderVault is ERC4626, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using MorphoBalancesLib for IMorpho;
    IMorpho public immutable morpho;
    MarketParams public params;

    constructor(IMorpho engine, MarketParams memory marketParams)
        ERC20("Pool lending shares", "pCREDIT")
        ERC4626(IERC20(marketParams.loanToken))
    {
        morpho = engine;
        params = marketParams;
        IERC20(marketParams.loanToken).safeApprove(address(engine), type(uint256).max);
    }

    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) + morpho.expectedSupplyAssets(params, address(this));
    }

    function availableLiquidity() public view returns (uint256) {
        (uint256 supplied,, uint256 borrowed,) = morpho.expectedMarketBalances(params);
        return IERC20(asset()).balanceOf(address(this)) + supplied - borrowed;
    }

    function marketBalances() external view returns (uint256, uint256, uint256, uint256) {
        return morpho.expectedMarketBalances(params);
    }

    function maxWithdraw(address owner) public view override returns (uint256) {
        return Math.min(super.maxWithdraw(owner), availableLiquidity());
    }

    function maxRedeem(address owner) public view override returns (uint256) {
        return Math.min(balanceOf(owner), convertToShares(availableLiquidity()));
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override nonReentrant {
        morpho.accrueInterest(params);
        super._deposit(caller, receiver, assets, shares);
        morpho.supply(params, assets, 0, address(this), "");
    }

    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal
        override
        nonReentrant
    {
        morpho.accrueInterest(params);
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (assets > idle) morpho.withdraw(params, assets - idle, 0, address(this), address(this));
        super._withdraw(caller, receiver, owner, assets, shares);
    }
}

/// @notice Pendle SY adapter: exactly one pCREDIT share backs each SY share.
/// Redemption delivers pCREDIT, not instantly withdrawable stablecoins.
contract PoolSY is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;
    LenderVault public immutable vault;
    event Deposit(
        address indexed caller,
        address indexed receiver,
        address indexed tokenIn,
        uint256 amountDeposited,
        uint256 amountSyOut
    );
    event Redeem(
        address indexed caller,
        address indexed receiver,
        address indexed tokenOut,
        uint256 amountSyToRedeem,
        uint256 amountTokenOut
    );

    constructor(LenderVault v) ERC20("SY Pool Credit", "SY-pCREDIT") {
        vault = v;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function deposit(address receiver, address tokenIn, uint256 amount, uint256 minOut)
        external
        payable
        nonReentrant
        returns (uint256)
    {
        require(msg.value == 0 && tokenIn == address(vault) && amount >= minOut && amount > 0, "invalid deposit");
        IERC20(address(vault)).safeTransferFrom(msg.sender, address(this), amount);
        _mint(receiver, amount);
        emit Deposit(msg.sender, receiver, tokenIn, amount, amount);
        return amount;
    }

    function redeem(address receiver, uint256 amount, address tokenOut, uint256 minOut, bool internalBalance)
        external
        nonReentrant
        returns (uint256)
    {
        require(tokenOut == address(vault) && amount >= minOut, "invalid redemption");
        _burn(internalBalance ? address(this) : msg.sender, amount);
        IERC20(address(vault)).safeTransfer(receiver, amount);
        emit Redeem(msg.sender, receiver, tokenOut, amount, amount);
        return amount;
    }

    function exchangeRate() external view returns (uint256) {
        return vault.convertToAssets(1e18);
    }

    function assetInfo() external view returns (uint8, address, uint8) {
        return (0, vault.asset(), 6);
    }

    function yieldToken() external view returns (address) {
        return address(vault);
    }

    function getTokensIn() external view returns (address[] memory r) {
        r = new address[](1);
        r[0] = address(vault);
    }

    function getTokensOut() external view returns (address[] memory r) {
        r = new address[](1);
        r[0] = address(vault);
    }

    function isValidTokenIn(address t) external view returns (bool) {
        return t == address(vault);
    }

    function isValidTokenOut(address t) external view returns (bool) {
        return t == address(vault);
    }

    function previewDeposit(address t, uint256 a) external view returns (uint256) {
        require(t == address(vault));
        return a;
    }

    function previewRedeem(address t, uint256 a) external view returns (uint256) {
        require(t == address(vault));
        return a;
    }

    function getRewardTokens() external pure returns (address[] memory) {
        return new address[](0);
    }

    function claimRewards(address) external pure returns (uint256[] memory) {
        return new uint256[](0);
    }

    function accruedRewards(address) external pure returns (uint256[] memory) {
        return new uint256[](0);
    }

    function rewardIndexesCurrent() external pure returns (uint256[] memory) {
        return new uint256[](0);
    }

    function rewardIndexesStored() external pure returns (uint256[] memory) {
        return new uint256[](0);
    }
}
