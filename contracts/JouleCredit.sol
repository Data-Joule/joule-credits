// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

/**
 * @title JouleCredit
 * @notice ERC-20 token minted by Chainlink oracle verification of OpenADR 3.0
 *         demand response curtailment events. 1 JLC = 1 kWh curtailed.
 *
 * Verification chain:
 *   OpenADR 3.0 VTN  →  VEN (pi-ven)  →  Zigbee smart plug measurement
 *   →  Chainlink Functions DON  →  fulfillRequest()  →  _mint()
 *
 * The oracle problem for energy DR, solved:
 *   Chainlink's decentralized oracle network independently fetches and verifies
 *   the wattage measurement — no single party, including the VEN operator,
 *   can falsify the curtailment data.
 *
 * Token math:
 *   source.js returns:  kwhScaled = floor(kwh_reduced * 1e9)   [uint256, no floats]
 *   fulfillRequest:     tokens = kwhScaled * 1e9  =  kwh_reduced * 1e18  [18 decimals]
 *   Example: 0.000375 kWh → kwhScaled = 375000 → tokens = 3.75e14 wei = 0.000375 JLC ✓
 */
contract JouleCredit is ERC20, FunctionsClient, Ownable {
    using FunctionsRequest for FunctionsRequest.Request;

    // ── Chainlink Functions config ─────────────────────────────────────────────
    uint64 public subscriptionId;
    uint32 public gasLimit;
    bytes32 public donId;
    string private source; // Chainlink Functions JavaScript source

    // ── State ──────────────────────────────────────────────────────────────────
    mapping(string => bool) public eventMinted;           // idempotency: one mint per event
    mapping(bytes32 => string) private requestToEvent;   // pending oracle request → event name
    address public mintTo;                               // address that receives minted JLC

    // ── Events ─────────────────────────────────────────────────────────────────
    event JouleCreditMinted(
        string indexed eventName,
        uint256 kwhScaled,    // kwh_reduced * 1e9 as returned by oracle
        uint256 tokens,       // actual JLC wei minted (kwhScaled * 1e9)
        bytes32 requestId     // Chainlink request ID — full on-chain audit trail
    );
    event VerificationRequested(string indexed eventName, bytes32 requestId);
    event OracleError(bytes32 indexed requestId, bytes err);

    // ── Constructor ────────────────────────────────────────────────────────────
    constructor(
        address functionsRouter,
        uint64 _subscriptionId,
        bytes32 _donId,
        string memory _source
    )
        ERC20("Joule Credit", "JLC")
        FunctionsClient(functionsRouter)
        Ownable(msg.sender)
    {
        subscriptionId = _subscriptionId;
        donId          = _donId;
        source         = _source;
        gasLimit       = 300_000;
        mintTo         = msg.sender;
    }

    // ── Oracle trigger ─────────────────────────────────────────────────────────
    /**
     * @notice Request Chainlink oracle verification of a completed DR event.
     * @param eventName  OpenADR event name (e.g. "grid-tier2-1715515294").
     *                   Must match an event report at data-joule.com/api/events/{eventName}.
     */
    function requestVerification(string calldata eventName) external onlyOwner {
        require(!eventMinted[eventName], "JLC: already minted for this event");

        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);

        string[] memory args = new string[](1);
        args[0] = eventName;
        req.setArgs(args);

        bytes32 reqId = _sendRequest(req.encodeCBOR(), subscriptionId, gasLimit, donId);
        requestToEvent[reqId] = eventName;
        emit VerificationRequested(eventName, reqId);
    }

    // ── Chainlink callback ─────────────────────────────────────────────────────
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        if (err.length > 0) {
            emit OracleError(requestId, err);
            return;
        }

        string memory eventName = requestToEvent[requestId];
        if (bytes(eventName).length == 0) return; // unknown request
        if (eventMinted[eventName]) return;        // already minted (race guard)

        uint256 kwhScaled = abi.decode(response, (uint256)); // kwh_reduced * 1e9
        if (kwhScaled == 0) return;                          // nothing to mint

        // 1 JLC = 1 kWh, 18 decimals
        // kwhScaled = kwh * 1e9  →  tokens = kwhScaled * 1e9 = kwh * 1e18
        uint256 tokens = kwhScaled * 1e9;

        eventMinted[eventName] = true;
        _mint(mintTo, tokens);

        emit JouleCreditMinted(eventName, kwhScaled, tokens, requestId);
    }

    // ── Admin ──────────────────────────────────────────────────────────────────
    function updateSource(string calldata newSource) external onlyOwner {
        source = newSource;
    }

    function setMintTo(address _mintTo) external onlyOwner {
        require(_mintTo != address(0), "JLC: zero address");
        mintTo = _mintTo;
    }

    function setGasLimit(uint32 _gasLimit) external onlyOwner {
        gasLimit = _gasLimit;
    }

    function setSubscriptionId(uint64 _subscriptionId) external onlyOwner {
        subscriptionId = _subscriptionId;
    }
}
