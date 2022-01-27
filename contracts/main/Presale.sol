// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Presale is Ownable {
    using SafeERC20 for IERC20;

    mapping(address => bool) public whitelists;
    mapping(address => uint256) public presaleList;

    bool private isPause;
    uint8 public constant maxDecimals = 18;

    address public immutable loopAddress;
    uint256 public immutable saleStartTime;
    uint256 public immutable saleEndTime;
    uint256 public immutable fcfsMinutes;
    uint256 public immutable tokenPrice;
    uint256 public immutable allowedTokenAmount;

    constructor(address _loopAddress, uint256 _saleStartTime, uint256 _saleEndTime, uint256 _fcfsMinutes, uint256 _tokenPrice, uint256 _allowedTokenAmount) {
        saleStartTime = _saleStartTime;
        saleEndTime = _saleEndTime;
        fcfsMinutes = _fcfsMinutes;
        tokenPrice = _tokenPrice;
        allowedTokenAmount = _allowedTokenAmount;
        loopAddress = _loopAddress;
        isPause = false;
    }

    modifier executable() {
        require(!isPause, "Contract is paused");
        _;
    }

    modifier checkEventTime() {
        require(block.timestamp >= saleStartTime && block.timestamp <= saleEndTime, "Presale ended");
        _;
    }

    modifier checkAfterTime() {
        require(block.timestamp > saleEndTime, "Presale not finished");
        _;
    }

    function setPause(bool _pause) external onlyOwner {
        isPause = _pause;
    }

    function addWhitelist(address whiteAddress) external executable onlyOwner {
        whitelists[whiteAddress] = true;
    }

    function removeWhitelist(address whiteAddress) external executable onlyOwner {
        whitelists[whiteAddress] = false;
    }

    function buyToken(address stableTokenAddress, uint256 amount) external executable checkEventTime {
        require(whitelists[msg.sender] != false, "Not whitelist address");
        uint8 tokenDecimal = ERC20(stableTokenAddress).decimals();
        uint256 realAmount = amount;
        if (tokenDecimal < maxDecimals) {
            amount = amount * 10 ** (maxDecimals - tokenDecimal);
        }
        if (block.timestamp >= saleEndTime - fcfsMinutes * 1 minutes) {
            if (presaleList[msg.sender] + amount <= allowedTokenAmount * 2) {
                presaleList[msg.sender] = presaleList[msg.sender] + amount;
            }
        } else {
            if (presaleList[msg.sender] + amount <= allowedTokenAmount) {
                presaleList[msg.sender] = presaleList[msg.sender] + amount;
            }
        }
        IERC20(stableTokenAddress).safeTransferFrom(msg.sender, address(this), realAmount);
    }
    
    function claimToken() external executable checkAfterTime returns (uint loopTokenAmount){
        require(presaleList[msg.sender] > 0, "No climToken amount");

        loopTokenAmount = presaleList[msg.sender] / tokenPrice * 10 ** ERC20(loopAddress).decimals();
        presaleList[msg.sender] = 0;
        IERC20(loopAddress).safeApprove(msg.sender, loopTokenAmount);
        IERC20(loopAddress).safeTransferFrom(address(this), msg.sender, loopTokenAmount);
    }

    function withdrawAllToken(address withdrawAddress, address[] calldata stableTokens) external executable onlyOwner checkAfterTime {
        uint loopTokenAmount = IERC20(loopAddress).balanceOf(address(this));
        IERC20(loopAddress).safeApprove(withdrawAddress, loopTokenAmount);
        IERC20(loopAddress).safeTransferFrom(address(this), withdrawAddress, loopTokenAmount);
        for (uint i = 0; i < stableTokens.length; i ++) {
            uint stableTokenAmount = IERC20(stableTokens[i]).balanceOf(address(this));
            IERC20(stableTokens[i]).safeApprove(withdrawAddress, stableTokenAmount);
            IERC20(stableTokens[i]).safeTransferFrom(address(this), withdrawAddress, stableTokenAmount);
        }
    }

    function giveBackToken(address withdrawAddress, address tokenAddress) external executable onlyOwner checkAfterTime {
        uint tokenAmount = IERC20(loopAddress).balanceOf(address(this));
        IERC20(tokenAddress).safeApprove(withdrawAddress, tokenAmount);
        IERC20(tokenAddress).safeTransferFrom(address(this), withdrawAddress, tokenAmount);
    }
}
