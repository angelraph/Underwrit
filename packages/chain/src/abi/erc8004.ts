import { parseAbi } from "viem";

/**
 * Minimal ABIs covering the functions Underwrit actually calls, per the
 * ERC-8004 EIP text + reference contracts (erc-8004/erc-8004-contracts).
 * Trimmed to what we need for discovery/evidence reads and our own agents'
 * writes — not a full mirror of the spec.
 */

export const identityRegistryAbi = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "function setAgentURI(uint256 agentId, string uri)",
  "function getAgentWallet(uint256 agentId) view returns (address)",
  "function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes signature)",
  "function unsetAgentWallet(uint256 agentId)",
  "event Registered(uint256 indexed agentId, address indexed owner, string agentURI)",
  "event URIUpdated(uint256 indexed agentId, string agentURI)",
]);

export const reputationRegistryAbi = parseAbi([
  "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
  "function revokeFeedback(uint256 agentId, uint64 feedbackIndex)",
  "function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)",
  "function getClients(uint256 agentId) view returns (address[])",
  "function getLastIndex(uint256 agentId, address client) view returns (uint64)",
  "event NewFeedback(uint256 indexed agentId, address indexed client, int128 value, uint8 valueDecimals, string tag1, string tag2)",
]);

export const validationRegistryAbi = parseAbi([
  "function validationRequest(address validatorAddress, uint256 agentId, string requestURI, bytes32 requestHash)",
  "function validationResponse(bytes32 requestHash, uint8 response, string responseURI, bytes32 responseHash, string tag)",
  "function getValidationStatus(bytes32 requestHash) view returns (uint8)",
  "event ValidationRequest(bytes32 indexed requestHash, uint256 indexed agentId, address indexed validatorAddress, string requestURI)",
  "event ValidationResponse(bytes32 indexed requestHash, uint8 response, string responseURI, string tag)",
]);
