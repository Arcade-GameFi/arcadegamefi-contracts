import { expect } from 'chai'
import { ethers } from 'hardhat'
import { parseUnits, formatUnits } from "ethers/lib/utils";
import { LoopToken, Presale, Token } from "../typechain-types"

import {
  getBigNumber,
  TOKEN_NAME,
  TOKEN_DECIMAL,
  advanceBlockTimeStamp,
  advanceTime,
  getLatestBlock,
  getSnapShot,
  revertTime
} from './utils'
import { Contract, Signer } from 'ethers';

describe('presale-test', () => {
  let loopContract: LoopToken
  let presaleContract: Presale
  let owner: Signer
  let addr1: Signer
  let addr2: Signer
  let addr3: Signer
  let addr4: Signer
  let addrs: Signer[]
  let usdc: Token
  let busd: Token
  let usdt: Token
  let meme: Token

  const saleStart_20220204_11_00_00_GMT_Time = 1656251469 //2022-02-04 11:00:00 GMT
  const saleEnd_20220204_17_00_00_GMT_Time = 1656467469    //2022-02-04 17:00:00 GMT
  const claimStart = 1656468000 //Initial vesting date
  const claimStart2 =  claimStart + 30 * 24 * 60 * 60 //Initial vesting date + 30 days
  const vestPercentage1 = 5000 //50% vest in basis points
  const vestPercentage2 = 5000 //50% vest in basis points
  const round2Minutes = 120
  const fcfsMinutes = 20
  const tokenPrice = '0.01'
  const allowedTokenAmount = '500'
  const round2Multiplier = 2
  const fcfsMultiplier = 10
  // const presaleTokenAmount = '60000000'
  const presaleTokenAmount = '1500000'

  // const stableTokens = {
  //   USDC: '0x32dB725138A0546BD1e5688C95cd4f28698E6E94',
  //   BUSD: '0xC7C540E5cBd421aEB459A6B546861AB776eF2762',
  //   USDT: '0xD014bF4a4A1ec01641463a9E5a6e8b8601Dc1255'
  // }
  
  before(async () => {
    [owner, addr1, addr2, addr3, addr4, ...addrs] = await ethers.getSigners()
    console.log('===================Deploying Contracts=====================')
    const TokenContractFactory = await ethers.getContractFactory("Token")
    usdc = (await TokenContractFactory.deploy(TOKEN_NAME.USDC, TOKEN_NAME.USDC, TOKEN_DECIMAL.USDC)) as Token
    busd = (await TokenContractFactory.deploy(TOKEN_NAME.BUSD, TOKEN_NAME.BUSD, TOKEN_DECIMAL.BUSD)) as Token
    usdt = (await TokenContractFactory.deploy(TOKEN_NAME.USDT, TOKEN_NAME.USDT, TOKEN_DECIMAL.USDT)) as Token
    meme = (await TokenContractFactory.deploy('MEME', 'MEME', 18)) as Token
    console.log('StableTokens deployed')
    await usdc.approve(await addr1.getAddress(), getBigNumber(50000, TOKEN_DECIMAL.USDC))
    await usdc.approve(await addr2.getAddress(), getBigNumber(50000, TOKEN_DECIMAL.USDC))
    await usdc.approve(await addr3.getAddress(), getBigNumber(50000, TOKEN_DECIMAL.USDC))
    await usdc.transfer(await addr1.getAddress(), getBigNumber(50000, TOKEN_DECIMAL.USDC))
    await usdc.transfer(await addr2.getAddress(), getBigNumber(50000, TOKEN_DECIMAL.USDC))
    await usdc.transfer(await addr3.getAddress(), getBigNumber(50000, TOKEN_DECIMAL.USDC))

    await busd.approve(await addr1.getAddress(), getBigNumber(50000, TOKEN_DECIMAL.BUSD))
    await busd.approve(await addr2.getAddress(), getBigNumber(50000, TOKEN_DECIMAL.BUSD))
    await busd.approve(await addr3.getAddress(), getBigNumber(50000, TOKEN_DECIMAL.BUSD))
    await busd.transfer(await addr1.getAddress(), getBigNumber(50000, TOKEN_DECIMAL.BUSD))
    await busd.transfer(await addr2.getAddress(), getBigNumber(50000, TOKEN_DECIMAL.BUSD))
    await busd.transfer(await addr3.getAddress(), getBigNumber(50000, TOKEN_DECIMAL.BUSD))
    
    await usdt.approve(await addr1.getAddress(), getBigNumber(50000, TOKEN_DECIMAL.USDT))
    await usdt.approve(await addr2.getAddress(), getBigNumber(50000, TOKEN_DECIMAL.USDT))
    await usdt.approve(await addr3.getAddress(), getBigNumber(50000, TOKEN_DECIMAL.USDT))
    await usdt.transfer(await addr1.getAddress(), getBigNumber(50000, TOKEN_DECIMAL.USDT))
    await usdt.transfer(await addr2.getAddress(), getBigNumber(50000, TOKEN_DECIMAL.USDT))
    await usdt.transfer(await addr3.getAddress(), getBigNumber(50000, TOKEN_DECIMAL.USDT))

    console.log('owner-USDC:', formatUnits(await usdc.balanceOf(await owner.getAddress()), TOKEN_DECIMAL.USDC))
    console.log('owner-BUSD:', formatUnits(await busd.balanceOf(await owner.getAddress()), TOKEN_DECIMAL.BUSD))
    console.log('owner-USDT:', formatUnits(await usdt.balanceOf(await owner.getAddress()), TOKEN_DECIMAL.USDT))

    console.log('addr1-USDC:', formatUnits(await usdc.balanceOf(await addr1.getAddress()), TOKEN_DECIMAL.USDC))
    console.log('addr1-BUSD:', formatUnits(await busd.balanceOf(await addr1.getAddress()), TOKEN_DECIMAL.BUSD))
    console.log('addr1-USDT:', formatUnits(await usdt.balanceOf(await addr1.getAddress()), TOKEN_DECIMAL.USDT))

    console.log('addr2-USDC:', formatUnits(await usdc.balanceOf(await addr2.getAddress()), TOKEN_DECIMAL.USDC))
    console.log('addr2-BUSD:', formatUnits(await busd.balanceOf(await addr2.getAddress()), TOKEN_DECIMAL.BUSD))
    console.log('addr2-USDT:', formatUnits(await usdt.balanceOf(await addr2.getAddress()), TOKEN_DECIMAL.USDT))

    console.log('addr3-USDC:', formatUnits(await usdc.balanceOf(await addr3.getAddress()), TOKEN_DECIMAL.USDC))
    console.log('addr3-BUSD:', formatUnits(await busd.balanceOf(await addr3.getAddress()), TOKEN_DECIMAL.BUSD))
    console.log('addr3-USDT:', formatUnits(await usdt.balanceOf(await addr3.getAddress()), TOKEN_DECIMAL.USDT))

    loopContract = (await TokenContractFactory.deploy('LOOP', 'LOOP', TOKEN_DECIMAL.LOOP)) as Token

    await loopContract.deployed()
    console.log('LoopToken deployed')
    
    const PresaleContractFactory = await ethers.getContractFactory('Presale')
    presaleContract = (await PresaleContractFactory.deploy(
      loopContract.address, 
      saleStart_20220204_11_00_00_GMT_Time, 
      saleEnd_20220204_17_00_00_GMT_Time, 
      getBigNumber(tokenPrice),
      getBigNumber(allowedTokenAmount),
      [
        round2Multiplier,
        fcfsMultiplier,
        round2Minutes,
        fcfsMinutes
      ],
      [
        [vestPercentage1, claimStart],
        [vestPercentage2, claimStart2]
      ],
      [
        usdc.address,
        busd.address,
        usdt.address
      ],
      getBigNumber(presaleTokenAmount)
      )) as Presale
    await presaleContract.deployed()
    console.log('Presale Contract deployed')
  })

  describe('Deposit LoopToken into Presale Contract', async () => {
    it('Deposit test', async () => {
      await loopContract.approve(presaleContract.address, getBigNumber(presaleTokenAmount))
      await loopContract.transfer(presaleContract.address, getBigNumber(presaleTokenAmount))
      expect(await loopContract.balanceOf(presaleContract.address)).to.equal(getBigNumber(presaleTokenAmount))
      console.log('LoopToken in presale contract:', formatUnits(await loopContract.balanceOf(presaleContract.address)))
      console.log('LoopToken in LoopToken contract:', formatUnits(await loopContract.balanceOf(await owner.getAddress())))
    })
  })

  describe('Manage pause status and whitelist', async () => {
    it('Can not set pause if unauthorized', async () => {
      await expect(presaleContract.connect(addr1).stopContract(true)).to.be.reverted
    })
    it('Can set pause if authorized', async () => {
      await expect(presaleContract.stopContract(false)).to.be.not.reverted
    })
    it('Can not add whitelist if authorized', async () => {
      await expect(presaleContract.connect(addr1).addWhitelist(await addr1.getAddress())).to.be.reverted
    })
    it('Can add whitelist if authorized', async () => {
      await expect(presaleContract.addWhitelist(await owner.getAddress())).to.be.not.reverted
    })
    it('Can remove whitelist if authorized', async () => {
      await expect(presaleContract.removeWhitelist(await owner.getAddress())).to.be.not.reverted
    })
  })

  describe('Purchase Token', async () => {
    it('Can not purchase token if contract is paused ', async () => {
      await presaleContract.stopContract(true)
      await expect(presaleContract.buyToken(usdc.address, getBigNumber(100, TOKEN_DECIMAL.USDC))).to.be.revertedWith('Contract is paused')
    })
    
    it('Token purchases can not be made before Presale period ', async () => {
      await presaleContract.stopContract(false)
      await expect(presaleContract.buyToken(usdc.address, getBigNumber(100, TOKEN_DECIMAL.USDC))).to.be.revertedWith('Out of presale period')
    })
    
    it('Token purchases can not be made if not whitelist address ', async () => {
      await advanceBlockTimeStamp(saleStart_20220204_11_00_00_GMT_Time)
      await expect(presaleContract.buyToken(usdc.address, getBigNumber(100, TOKEN_DECIMAL.USDC))).to.be.revertedWith('Not whitelist address')
    })

    it('Token purchases can not be made if not stableToken address ', async () => {
      await presaleContract.addWhitelist(await owner.getAddress())
      await presaleContract.addWhitelist(await addr1.getAddress())
      await presaleContract.addWhitelist(await addr2.getAddress())
      await presaleContract.addWhitelist(await addr3.getAddress())
      const wrongTokenAddress = '0x3c2b8be99c50593081eaa2a724f0b8285f5aba8f'
      await expect(presaleContract.buyToken(wrongTokenAddress, getBigNumber(100, TOKEN_DECIMAL.USDC))).to.be.revertedWith('Not stableToken address')
    })
    
    it('round1 period - purchase tokens1 ', async () => {
      await usdc.connect(addr1).approve(presaleContract.address, getBigNumber(300, TOKEN_DECIMAL.USDC))
      await busd.connect(addr1).approve(presaleContract.address, getBigNumber(100, TOKEN_DECIMAL.BUSD))
      await usdt.connect(addr1).approve(presaleContract.address, getBigNumber(100, TOKEN_DECIMAL.USDT))
      await presaleContract.connect(addr1).buyToken(usdc.address, getBigNumber(300, TOKEN_DECIMAL.USDC))
      await presaleContract.connect(addr1).buyToken(busd.address, getBigNumber(100, TOKEN_DECIMAL.BUSD))
      await presaleContract.connect(addr1).buyToken(usdt.address, getBigNumber(100, TOKEN_DECIMAL.USDT))
      console.log('Sold Token Amount:', formatUnits(await presaleContract.getSoldToken()))
    })

    it('round1 period - purchase tokens2 ', async () => {
      await usdc.connect(addr2).approve(presaleContract.address, getBigNumber(300, TOKEN_DECIMAL.USDC))
      await busd.connect(addr2).approve(presaleContract.address, getBigNumber(100, TOKEN_DECIMAL.BUSD))
      await usdt.connect(addr2).approve(presaleContract.address, getBigNumber(100, TOKEN_DECIMAL.USDT))
      await presaleContract.connect(addr2).buyToken(usdc.address, getBigNumber(300, TOKEN_DECIMAL.USDC))
      await presaleContract.connect(addr2).buyToken(busd.address, getBigNumber(100, TOKEN_DECIMAL.BUSD))
      await presaleContract.connect(addr2).buyToken(usdt.address, getBigNumber(100, TOKEN_DECIMAL.USDT))
      console.log('Sold Token Amount:', formatUnits(await presaleContract.getSoldToken()))
    })
    
    it('round1 period - purchase tokens3 ', async () => {
      await usdc.connect(addr3).approve(presaleContract.address, getBigNumber(300, TOKEN_DECIMAL.USDC))
      await busd.connect(addr3).approve(presaleContract.address, getBigNumber(100, TOKEN_DECIMAL.BUSD))
      await usdt.connect(addr3).approve(presaleContract.address, getBigNumber(100, TOKEN_DECIMAL.USDT))
      await presaleContract.connect(addr3).buyToken(usdc.address, getBigNumber(300, TOKEN_DECIMAL.USDC))
      await presaleContract.connect(addr3).buyToken(busd.address, getBigNumber(100, TOKEN_DECIMAL.BUSD))
      await presaleContract.connect(addr3).buyToken(usdt.address, getBigNumber(100, TOKEN_DECIMAL.USDT))
      console.log('Sold Token Amount:', formatUnits(await presaleContract.getSoldToken()))
    })

    it('Exceeding purchase token limit during round1 period ', async () => {
      await usdc.connect(addr1).approve(presaleContract.address, getBigNumber(300, TOKEN_DECIMAL.USDC))
      await expect(presaleContract.connect(addr1).buyToken(
        usdc.address, 
        getBigNumber(300, TOKEN_DECIMAL.USDC))
        ).to.be.revertedWith('Exceeding presale token limit during round1 period')

      await busd.connect(addr2).approve(presaleContract.address, getBigNumber(300, TOKEN_DECIMAL.BUSD))
      await expect(presaleContract.connect(addr2).buyToken(
        busd.address, 
        getBigNumber(300, TOKEN_DECIMAL.BUSD))
        ).to.be.revertedWith('Exceeding presale token limit during round1 period')

      await usdt.connect(addr3).approve(presaleContract.address, getBigNumber(300, TOKEN_DECIMAL.USDT))
      await expect(presaleContract.connect(addr3).buyToken(
        usdt.address, 
        getBigNumber(300, TOKEN_DECIMAL.USDT))
        ).to.be.revertedWith('Exceeding presale token limit during round1 period')
    })
   
    it('round2 period - purchase tokens1 ', async () => {
      await advanceBlockTimeStamp(saleEnd_20220204_17_00_00_GMT_Time - round2Minutes * 60)

      await usdc.connect(addr1).approve(presaleContract.address, getBigNumber(300, TOKEN_DECIMAL.USDC))
      await busd.connect(addr1).approve(presaleContract.address, getBigNumber(100, TOKEN_DECIMAL.BUSD))
      await usdt.connect(addr1).approve(presaleContract.address, getBigNumber(100, TOKEN_DECIMAL.USDT))
      await presaleContract.connect(addr1).buyToken(usdc.address, getBigNumber(300, TOKEN_DECIMAL.USDC))
      await presaleContract.connect(addr1).buyToken(busd.address, getBigNumber(100, TOKEN_DECIMAL.BUSD))
      await presaleContract.connect(addr1).buyToken(usdt.address, getBigNumber(100, TOKEN_DECIMAL.USDT))
      console.log('Sold Token Amount:', formatUnits(await presaleContract.getSoldToken()))
    })

    it('round2 period - purchase tokens2 ', async () => {
      await usdc.connect(addr2).approve(presaleContract.address, getBigNumber(300, TOKEN_DECIMAL.USDC))
      await busd.connect(addr2).approve(presaleContract.address, getBigNumber(100, TOKEN_DECIMAL.BUSD))
      await usdt.connect(addr2).approve(presaleContract.address, getBigNumber(100, TOKEN_DECIMAL.USDT))
      await presaleContract.connect(addr2).buyToken(usdc.address, getBigNumber(300, TOKEN_DECIMAL.USDC))
      await presaleContract.connect(addr2).buyToken(busd.address, getBigNumber(100, TOKEN_DECIMAL.BUSD))
      await presaleContract.connect(addr2).buyToken(usdt.address, getBigNumber(100, TOKEN_DECIMAL.USDT))
      console.log('Sold Token Amount:', formatUnits(await presaleContract.getSoldToken()))
    })

    
    it('round2 period - purchase tokens3 ', async () => {
      await usdc.connect(addr3).approve(presaleContract.address, getBigNumber(300, TOKEN_DECIMAL.USDC))
      await busd.connect(addr3).approve(presaleContract.address, getBigNumber(100, TOKEN_DECIMAL.BUSD))
      await usdt.connect(addr3).approve(presaleContract.address, getBigNumber(100, TOKEN_DECIMAL.USDT))
      await presaleContract.connect(addr3).buyToken(usdc.address, getBigNumber(300, TOKEN_DECIMAL.USDC))
      await presaleContract.connect(addr3).buyToken(busd.address, getBigNumber(100, TOKEN_DECIMAL.BUSD))
      await presaleContract.connect(addr3).buyToken(usdt.address, getBigNumber(100, TOKEN_DECIMAL.USDT))
      console.log('Sold Token Amount:', formatUnits(await presaleContract.getSoldToken()))
    })

    it('Exceeding purchase token limit during round2 period ', async () => {
      await usdc.connect(addr1).approve(presaleContract.address, getBigNumber(300, TOKEN_DECIMAL.USDC))
      await expect(presaleContract.connect(addr1).buyToken(
        usdc.address, 
        getBigNumber(1, TOKEN_DECIMAL.USDC))
        ).to.be.revertedWith('Exceeding presale token limit during round2 period')

      await busd.connect(addr2).approve(presaleContract.address, getBigNumber(300, TOKEN_DECIMAL.BUSD))
      await expect(presaleContract.connect(addr2).buyToken(
        busd.address, 
        getBigNumber(1, TOKEN_DECIMAL.BUSD))
        ).to.be.revertedWith('Exceeding presale token limit during round2 period')

      await usdt.connect(addr3).approve(presaleContract.address, getBigNumber(300, TOKEN_DECIMAL.USDT))
      await expect(presaleContract.connect(addr3).buyToken(
        usdt.address, 
        getBigNumber(1, TOKEN_DECIMAL.USDT))
        ).to.be.revertedWith('Exceeding presale token limit during round2 period')
    })

    it('FCFS period - purchase tokens1 ', async () => {
      await advanceBlockTimeStamp(saleEnd_20220204_17_00_00_GMT_Time - fcfsMinutes * 60)

      await usdc.connect(addr1).approve(presaleContract.address, getBigNumber(3000, TOKEN_DECIMAL.USDC))
      await busd.connect(addr1).approve(presaleContract.address, getBigNumber(500, TOKEN_DECIMAL.BUSD))
      await usdt.connect(addr1).approve(presaleContract.address, getBigNumber(500, TOKEN_DECIMAL.USDT))
      await presaleContract.connect(addr1).buyToken(usdc.address, getBigNumber(3000, TOKEN_DECIMAL.USDC))
      await presaleContract.connect(addr1).buyToken(busd.address, getBigNumber(500, TOKEN_DECIMAL.BUSD))
      await presaleContract.connect(addr1).buyToken(usdt.address, getBigNumber(500, TOKEN_DECIMAL.USDT))
      console.log('Sold Token Amount:', formatUnits(await presaleContract.getSoldToken()))
    })
    
    it('FCFS period - purchase tokens2 ', async () => {
      await usdc.connect(addr2).approve(presaleContract.address, getBigNumber(3000, TOKEN_DECIMAL.USDC))
      await busd.connect(addr2).approve(presaleContract.address, getBigNumber(500, TOKEN_DECIMAL.BUSD))
      await usdt.connect(addr2).approve(presaleContract.address, getBigNumber(500, TOKEN_DECIMAL.USDT))
      await presaleContract.connect(addr2).buyToken(usdc.address, getBigNumber(3000, TOKEN_DECIMAL.USDC))
      await presaleContract.connect(addr2).buyToken(busd.address, getBigNumber(500, TOKEN_DECIMAL.BUSD))
      await presaleContract.connect(addr2).buyToken(usdt.address, getBigNumber(500, TOKEN_DECIMAL.USDT))
      console.log('Sold Token Amount:', formatUnits(await presaleContract.getSoldToken()))
    })


    it('Exceeding purchase token limit during FCFS period ', async () => {
      await usdc.connect(addr1).approve(presaleContract.address, getBigNumber(1, TOKEN_DECIMAL.USDC))
      await expect(presaleContract.connect(addr1).buyToken(
        usdc.address, 
        getBigNumber(1, TOKEN_DECIMAL.USDC))
        ).to.be.revertedWith('Exceeding presale token limit during FCFS period')

      await busd.connect(addr2).approve(presaleContract.address, getBigNumber(1, TOKEN_DECIMAL.BUSD))
      await expect(presaleContract.connect(addr2).buyToken(
        busd.address, 
        getBigNumber(1, TOKEN_DECIMAL.BUSD))
        ).to.be.revertedWith('Exceeding presale token limit during FCFS period')
    })

    it('FCFS period - purchase tokens3 ', async () => {

      await usdc.connect(addr3).approve(presaleContract.address, getBigNumber(3000, TOKEN_DECIMAL.USDC))
      await busd.connect(addr3).approve(presaleContract.address, getBigNumber(500, TOKEN_DECIMAL.BUSD))
      await usdt.connect(addr3).approve(presaleContract.address, getBigNumber(500, TOKEN_DECIMAL.USDT))
      await presaleContract.connect(addr3).buyToken(usdc.address, getBigNumber(3000, TOKEN_DECIMAL.USDC))
      await presaleContract.connect(addr3).buyToken(busd.address, getBigNumber(500, TOKEN_DECIMAL.BUSD))
      await presaleContract.connect(addr3).buyToken(usdt.address, getBigNumber(500, TOKEN_DECIMAL.USDT))

      console.log('Sold Token Amount:', formatUnits(await presaleContract.getSoldToken()))

    })

    it('All Loop tokens are sold out', async () => {
      await usdt.connect(addr3).approve(presaleContract.address, getBigNumber(300, TOKEN_DECIMAL.USDT))
      
      await expect(presaleContract.connect(addr3).buyToken(
        usdt.address, 
        getBigNumber(100, TOKEN_DECIMAL.USDT))
        ).to.be.revertedWith('All Loop Tokens are sold out')
    })

  })

  describe('Claim Tokens', async () => {
    it('Cannot claim token during presale period ', async () => {
      await expect(presaleContract.claimToken()).to.be.revertedWith('Presale not finished')
    })
  })


  describe('Withdraw all tokens', async () => {
    it('Withdraw all tokens ', async () => {
      await advanceBlockTimeStamp(saleEnd_20220204_17_00_00_GMT_Time + 1)
      
      //Send 1000 extra tokens into contract. These will be considered as unsold tokens
      await loopContract.approve(presaleContract.address, getBigNumber(1000))
      await loopContract.transfer(presaleContract.address, getBigNumber(1000))

      console.log('Sold Token Amount:', formatUnits(await presaleContract.getSoldToken()))
      console.log('Loop Tokens in Presale Contract before withdrawal:', formatUnits(await loopContract.balanceOf(presaleContract.address)))

      
      await presaleContract.withdrawAllToken(
        await addrs[0].getAddress(),
        [
          usdc.address,
          busd.address,
          usdt.address
        ]
      )

      //We expect whatever has been sold remains in the contract
      expect(await loopContract.balanceOf(presaleContract.address)).to.equal(await presaleContract.getSoldToken())

      console.log('Loop Tokens in Presale Contract after withdrawal:', formatUnits(await loopContract.balanceOf(presaleContract.address)))
      console.log('LOOP in owner:', formatUnits(await loopContract.balanceOf(await addrs[0].getAddress())))
      console.log('USDC in owner:', formatUnits(await usdc.balanceOf(await addrs[0].getAddress()), TOKEN_DECIMAL.USDC))
      console.log('BUSD in owner:', formatUnits(await busd.balanceOf(await addrs[0].getAddress()), TOKEN_DECIMAL.BUSD))
      console.log('USDT in owner:', formatUnits(await usdt.balanceOf(await addrs[0].getAddress()), TOKEN_DECIMAL.USDT))
    })
  })

  describe('Claim Tokens: After 1st Vest Date', async () => {
    it('Claim tokens1: Addr1 and Addr2 claims upon 1st Vesting Date ', async () => {
      await advanceBlockTimeStamp(claimStart)
      
      await presaleContract.connect(addr1).claimToken()
      await presaleContract.connect(addr2).claimToken()
      

      const loopToken1 = await loopContract.balanceOf(await addr1.getAddress())
      const loopToken2 = await loopContract.balanceOf(await addr2.getAddress())
      const loopToken3 = await loopContract.balanceOf(await addr3.getAddress())
      const loopTokenPresale = await loopContract.balanceOf(presaleContract.address)

      console.log('LOOP in addr1:', formatUnits(loopToken1))
      console.log('LOOP in addr2:', formatUnits(loopToken2))
      console.log('LOOP in addr3:', formatUnits(loopToken3))
      console.log('LOOP in Presale Contract:', formatUnits(loopTokenPresale))

      
      expect((await presaleContract.presaleList(await addr1.getAddress())).claimedLoopTokenAmount).to.equal(loopToken1)
      expect((await presaleContract.presaleList(await addr2.getAddress())).claimedLoopTokenAmount).to.equal(loopToken2)
      expect((await presaleContract.presaleList(await addr3.getAddress())).claimedLoopTokenAmount).to.equal(loopToken3)

      
    })

    it('No claimToken amount: Addr4 did not buy into presale', async () => {
      await expect(presaleContract.connect(addr4).claimToken()).to.be.revertedWith('No claimToken amount')
    })
  })

  describe('Claim Tokens: In Between Vesting Dates', async () => {
    it('Claim tokens1: Addr1, Addr2 and Addr3 claims in between 1st and 2nd Vesting Date. No trading in between', async () => {
      await expect(presaleContract.connect(addr1).claimToken()).to.be.revertedWith('No tokens available for claim yet')
      await expect(presaleContract.connect(addr2).claimToken()).to.be.revertedWith('No tokens available for claim yet')
    })
  })

  describe('Claim Tokens: After 2nd Vest Date', async () => {
    it('Claim tokens1: Addr1, Addr2 and Addr3 claims upon 2nd Vesting Date. No trading in between', async () => {
      await advanceBlockTimeStamp(claimStart2)
      
      await presaleContract.connect(addr1).claimToken()
      await presaleContract.connect(addr2).claimToken()
      await presaleContract.connect(addr3).claimToken()
      

      const loopToken1 = await loopContract.balanceOf(await addr1.getAddress())
      const loopToken2 = await loopContract.balanceOf(await addr2.getAddress())
      const loopToken3 = await loopContract.balanceOf(await addr3.getAddress())
      const loopTokenPresale = await loopContract.balanceOf(presaleContract.address)

      console.log('LOOP in addr1:', formatUnits(loopToken1))
      console.log('LOOP in addr2:', formatUnits(loopToken2))
      console.log('LOOP in addr3:', formatUnits(loopToken3))
      console.log('LOOP in Presale Contract:', formatUnits(loopTokenPresale))

      
      expect((await presaleContract.presaleList(await addr1.getAddress())).claimedLoopTokenAmount).to.equal(loopToken1)
      expect((await presaleContract.presaleList(await addr2.getAddress())).claimedLoopTokenAmount).to.equal(loopToken2)
      expect((await presaleContract.presaleList(await addr3.getAddress())).claimedLoopTokenAmount).to.equal(loopToken3)
    })
  })

  describe('Give Back Tokens', async () => {
    it('Caller is not authorized', async () => {
      await expect(presaleContract.connect(addr1).giveBackToken(
        await addr1.getAddress(),
        meme.address
      )).to.be.revertedWith('AccessControl')
    })

    it('Can not withdraw stable tokens', async () => {
      await expect(presaleContract.giveBackToken(
        await addr1.getAddress(),
        usdc.address
      )).to.be.revertedWith('Cannot withdraw pre-sale swap stablecoin tokens from presale using this function.')
    })

    it('Can not withdraw loop tokens', async () => {
      await expect(presaleContract.giveBackToken(
        await addr1.getAddress(),
        loopContract.address
      )).to.be.revertedWith('Cannot withdraw Loop tokens from presale using this function.')
    })

    it('Tokens withdrawn', async () => {
      await meme.approve(presaleContract.address, getBigNumber(5000))
      await meme.transfer(presaleContract.address, getBigNumber(5000))

      await presaleContract.giveBackToken(
        await addr1.getAddress(),
        meme.address
      )
      expect(await meme.balanceOf(await addr1.getAddress())).to.equal(getBigNumber(5000))
      console.log('MEME in addr1:', formatUnits(await meme.balanceOf(await addr1.getAddress())))
    })
  })
})
