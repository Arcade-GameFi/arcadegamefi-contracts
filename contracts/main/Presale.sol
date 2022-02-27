// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Presale is AccessControl {
    using SafeERC20 for IERC20;

    struct SaleInfo {
        uint256 stableTokenAmount;
        uint256 loopTokenAmount;
    }

    mapping(address => bool) public whitelists;
    mapping(address => SaleInfo) public presaleList;
    mapping(address => bool) public acceptTokens;

    bool private isPause;
    uint8 public constant maxDecimals = 18;

    address public immutable loopAddress;

    struct SaleRules {
        uint256 round2Multiplier;
        uint256 fcfsMultiplier;
        uint256 round2Minutes;
        uint256 fcfsMinutes;
    }

    SaleRules public saleRules;
    uint256 public saleStartTime;
    uint256 public saleEndTime;
    uint256 public immutable tokenPrice;
    uint256 public immutable allowedTokenAmount;
    
    uint256 public soldToken;
    uint256 public immutable presaleTokenAmount;

    event TokenPurchased(address userAddress, uint256 purchasedAmount);
    event TokenClaimed(address userAddress, uint256 purchasedAmount);

    constructor(
        address _loopAddress, 
        uint256 _saleStartTime, 
        uint256 _saleEndTime, 
        uint256 _tokenPrice, 
        uint256 _allowedTokenAmount,
        SaleRules memory _saleRules,
        address[] memory _acceptTokens,
        uint256 _presaleTokenAmount
        ) {

        require(_saleEndTime >= _saleStartTime);
        require(_saleRules.round2Minutes >= 0);
        require(_saleRules.fcfsMinutes >= 0);
        require(_tokenPrice > 0);
        require(_allowedTokenAmount >= 0);
        require(_presaleTokenAmount >= 0);
        require(_saleRules.round2Multiplier >= 1);
        require(_saleRules.fcfsMultiplier >= 1);

        saleStartTime = _saleStartTime;
        saleEndTime = _saleEndTime;
        saleRules.round2Minutes = _saleRules.round2Minutes;
        saleRules.fcfsMinutes = _saleRules.fcfsMinutes;
        tokenPrice = _tokenPrice;
        allowedTokenAmount = _allowedTokenAmount;
        saleRules.round2Multiplier = _saleRules.round2Multiplier;
        saleRules.fcfsMultiplier = _saleRules.fcfsMultiplier;
        
        loopAddress = _loopAddress;
        for (uint i = 0; i < _acceptTokens.length; i ++) {
            acceptTokens[_acceptTokens[i]] = true;
        }
        presaleTokenAmount = _presaleTokenAmount;
        isPause = false;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    modifier executable() {
        require(!isPause, "Contract is paused");
        _;
    }

    modifier checkEventTime() {
        require(block.timestamp >= saleStartTime && block.timestamp <= saleEndTime, "Out of presale period");
        _;
    }

    modifier checkAfterTime() {
        require(block.timestamp > saleEndTime, "Presale not finished");
        _;
    }

    function setStartTime(uint256 _saleStartTime) external executable onlyRole(DEFAULT_ADMIN_ROLE) {
        saleStartTime = _saleStartTime;
    }

    function setEndTime(uint256 _saleEndTime) external executable onlyRole(DEFAULT_ADMIN_ROLE) {
        saleEndTime = _saleEndTime;
    }

    function getSoldToken() public view returns(uint) {
        return soldToken;
    }

    function stopContract(bool _pause) external onlyRole(DEFAULT_ADMIN_ROLE) {
        isPause = _pause;
    }
    
    function getPauseStatus() external view returns(bool) {
        return isPause;
    }
    
    function addWhitelist(address _whiteAddress) external executable onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelists[_whiteAddress] = true;
    }

    function removeWhitelist(address _whiteAddress) external executable onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelists[_whiteAddress] = false;
    }

	function addAcceptTokens(address _acceptTokenAddress) external executable onlyRole(DEFAULT_ADMIN_ROLE) {
        acceptTokens[_acceptTokenAddress] = true;
    }

    function removeAcceptTokens(address _acceptTokenAddress) external executable onlyRole(DEFAULT_ADMIN_ROLE) {
        acceptTokens[_acceptTokenAddress] = false;
    }

    function buyToken(address _stableTokenAddress, uint256 _amount) external executable checkEventTime {
        require(whitelists[msg.sender] == true, "Not whitelist address");
        require(acceptTokens[_stableTokenAddress] == true, "Not stableToken address");

        SaleInfo storage saleInfo = presaleList[msg.sender];

        uint8 tokenDecimal = ERC20(_stableTokenAddress).decimals();
        uint256 tokenAmount = _amount;

        if (tokenDecimal < maxDecimals) {
            tokenAmount = tokenAmount * 10 ** (maxDecimals - tokenDecimal);
        }

        uint256 loopTokenAmount = tokenAmount / tokenPrice * 10 ** ERC20(loopAddress).decimals();

        require(soldToken + loopTokenAmount <= presaleTokenAmount, "All Loop Tokens are sold out");

        if (block.timestamp >= saleEndTime - saleRules.fcfsMinutes * 1 minutes) {
            require(saleInfo.stableTokenAmount + tokenAmount <= allowedTokenAmount * saleRules.fcfsMultiplier, 
                "Exceeding presale token limit during FCFS period");
        } else if (block.timestamp < saleEndTime - saleRules.round2Minutes * 1 minutes) {
            require(saleInfo.stableTokenAmount + tokenAmount <= allowedTokenAmount, 
                "Exceeding presale token limit during round1 period");
        } else if (block.timestamp >= saleEndTime - saleRules.round2Minutes * 1 minutes && block.timestamp < saleEndTime - saleRules.fcfsMinutes * 1 minutes) {
            require(saleInfo.stableTokenAmount + tokenAmount <= allowedTokenAmount * saleRules.round2Multiplier, 
                "Exceeding presale token limit during round2 period");
        }

        saleInfo.stableTokenAmount = saleInfo.stableTokenAmount + tokenAmount;
        saleInfo.loopTokenAmount = saleInfo.loopTokenAmount + loopTokenAmount;

        soldToken = soldToken + loopTokenAmount;

        IERC20(_stableTokenAddress).safeTransferFrom(msg.sender, address(this), _amount);

        emit TokenPurchased(msg.sender, loopTokenAmount);
    }
    
    function claimToken() external executable checkAfterTime {
        SaleInfo storage saleInfo = presaleList[msg.sender];
        require(saleInfo.loopTokenAmount > 0, "No claimToken amount");

        uint loopTokenAmount = saleInfo.loopTokenAmount;
        saleInfo.stableTokenAmount = 0;
        saleInfo.loopTokenAmount = 0;
        uint balance = IERC20(loopAddress).balanceOf(address(this));
        require(balance > 0, "Insufficient balance");
        if (balance < loopTokenAmount) {
            loopTokenAmount = balance;
        }
        IERC20(loopAddress).safeTransfer(msg.sender, loopTokenAmount);
        emit TokenClaimed(msg.sender, loopTokenAmount);
    }

    function withdrawAllToken(address _withdrawAddress, address[] calldata _stableTokens) external executable onlyRole(DEFAULT_ADMIN_ROLE) checkAfterTime {
        //Withdraw all leftover LOOP tokens
        uint loopTokenAmount = IERC20(loopAddress).balanceOf(address(this));
        IERC20(loopAddress).safeTransfer(_withdrawAddress, loopTokenAmount);
        
        //Withdraw all stablecoins
        for (uint i = 0; i < _stableTokens.length; i ++) {
            uint stableTokenAmount = IERC20(_stableTokens[i]).balanceOf(address(this));
            IERC20(_stableTokens[i]).safeTransfer(_withdrawAddress, stableTokenAmount);
        }
    }

    function giveBackToken(address _withdrawAddress, address _tokenAddress) external executable onlyRole(DEFAULT_ADMIN_ROLE) checkAfterTime {
        require(acceptTokens[_tokenAddress] == false, "Cannot withdraw pre-sale swap stablecoin tokens from presale using this function.");
        require(loopAddress != _tokenAddress, "Cannot withdraw Loop tokens from presale using this function.");
        uint tokenAmount = IERC20(_tokenAddress).balanceOf(address(this));
        IERC20(_tokenAddress).safeTransfer(_withdrawAddress, tokenAmount);
    }
}