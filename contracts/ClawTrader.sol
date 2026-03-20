// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Claw's DeFi Trader - On-Chain Trade Registry
/// @notice Records autonomous trades executed by Claw AI agent with full reasoning trail
/// @dev Built by Claw (AI agent) for The Synthesis Hackathon
contract ClawTrader {

    string public constant DISCLAIMER =
        "EXPERIMENTAL AI AGENT. NOT FINANCIAL ADVICE. "
        "Trades are executed autonomously by an AI for hackathon/research purposes only. "
        "Past performance does not indicate future results. Use at your own risk.";

    struct Trade {
        string direction;       // "BUY" or "SELL"
        string asset;           // Asset traded (e.g. "ETH", "USDC")
        uint256 amountIn;       // Amount spent (in wei or token smallest unit)
        uint256 amountOut;      // Amount received
        uint256 priceAtExecution; // Price in USD cents at execution time
        string reasoningHash;   // IPFS CID of full reasoning
        string sentiment;       // "BULLISH" | "BEARISH" | "NEUTRAL"
        uint8 confidence;       // 0-100
        uint256 timestamp;      // Block timestamp
    }

    Trade[] public trades;
    address public immutable agent;

    event TradeExecuted(
        uint256 indexed id,
        string direction,
        string asset,
        uint256 amountIn,
        uint256 amountOut,
        string sentiment
    );

    modifier onlyAgent() {
        require(msg.sender == agent, "ClawTrader: caller is not the agent");
        _;
    }

    constructor() {
        agent = msg.sender;
    }

    /// @notice Record a new trade executed by the agent
    function recordTrade(
        string calldata _direction,
        string calldata _asset,
        uint256 _amountIn,
        uint256 _amountOut,
        uint256 _priceAtExecution,
        string calldata _reasoningHash,
        string calldata _sentiment,
        uint8 _confidence
    ) external onlyAgent {
        require(_confidence <= 100, "ClawTrader: confidence must be 0-100");

        uint256 id = trades.length;

        trades.push(Trade({
            direction: _direction,
            asset: _asset,
            amountIn: _amountIn,
            amountOut: _amountOut,
            priceAtExecution: _priceAtExecution,
            reasoningHash: _reasoningHash,
            sentiment: _sentiment,
            confidence: _confidence,
            timestamp: block.timestamp
        }));

        emit TradeExecuted(id, _direction, _asset, _amountIn, _amountOut, _sentiment);
    }

    /// @notice Get a specific trade by ID
    function getTrade(uint256 _id) external view returns (Trade memory) {
        require(_id < trades.length, "ClawTrader: trade does not exist");
        return trades[_id];
    }

    /// @notice Get total number of trades
    function tradeCount() external view returns (uint256) {
        return trades.length;
    }

    /// @notice Get the latest N trades (returns fewer if not enough trades exist)
    function getLatestTrades(uint256 _n) external view returns (Trade[] memory) {
        uint256 len = trades.length;
        if (_n > len) {
            _n = len;
        }
        Trade[] memory result = new Trade[](_n);
        for (uint256 i = 0; i < _n; i++) {
            result[i] = trades[len - _n + i];
        }
        return result;
    }

    /// @notice Calculate simplified P&L across all trades
    /// @dev Sum of amountOut for SELLs minus sum of amountIn for BUYs
    /// @return pnl The net P&L value
    /// @return isPositive True if P&L >= 0, false if negative
    function getPnL() external view returns (uint256 pnl, bool isPositive) {
        uint256 totalOut = 0;
        uint256 totalIn = 0;

        for (uint256 i = 0; i < trades.length; i++) {
            bytes32 dirHash = keccak256(bytes(trades[i].direction));
            if (dirHash == keccak256("SELL")) {
                totalOut += trades[i].amountOut;
            } else if (dirHash == keccak256("BUY")) {
                totalIn += trades[i].amountIn;
            }
        }

        if (totalOut >= totalIn) {
            pnl = totalOut - totalIn;
            isPositive = true;
        } else {
            pnl = totalIn - totalOut;
            isPositive = false;
        }
    }
}
