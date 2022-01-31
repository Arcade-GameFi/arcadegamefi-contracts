import { expect } from 'chai'
import { ethers } from 'hardhat'
import { parseUnits, formatUnits } from "ethers/lib/utils";
import { Token, Presale } from "../typechain-types"
const { time } = require("@openzeppelin/test-helpers");
import {
  getBigNumber,
  TOKEN_NAME,
  TOKEN_DECIMAL,
  advanceBlockTimeStamp,
  getLatestBlock,
  getSnapShot,
  revertTime
} from './utils'
import { Contract, Signer } from 'ethers';
import { Provider } from '@ethersproject/abstract-provider';

describe('presale-test', () => {
  let loopContract: Token
  let presaleContract: Presale
  let owner: Signer
  let addr1: Signer
  let addr2: Signer
  let addrs: Signer[]
  let usdc: Token
  let busd: Token
  let usdt: Token
  const saleStart_20220201_11_00_00_GMT_Time = '1643713200' //2022-02-01 11:00:00 GMT
  const saleEnd_20220201_17_00_00_GMT_Time = '1643734800'    //2022-02-01 17:00:00 GMT
  const fcfsMinutes = '20'
  const tokenPrice = '0.008'
  const allowedTokenAmount = '500';
  const presaleTokenAmount = '60000000'
  const beforePresale_20220128_17_39_49_GMT_Time = '1643391589'   //2022-01-28 17:39:49 GMT
  const afterPresale_20220202_17_39_49_GMT_Time = '1643823589'   //2022-02-02 17:39:49 GMT

  // const stableTokens = {
  //   USDC: '0x32dB725138A0546BD1e5688C95cd4f28698E6E94',
  //   BUSD: '0xC7C540E5cBd421aEB459A6B546861AB776eF2762',
  //   USDT: '0xD014bF4a4A1ec01641463a9E5a6e8b8601Dc1255'
  // }
  
  before(async () => {
    ;[owner, addr1, addr2, ...addrs] = await ethers.getSigners()
    console.log('===================Deploying Contracts=====================')
    const TokenContractFactory = await ethers.getContractFactory("Token")
    usdc = (await TokenContractFactory.deploy(TOKEN_NAME.USDC, TOKEN_NAME.USDC, TOKEN_DECIMAL.USDC)) as Token
    busd = (await TokenContractFactory.deploy(TOKEN_NAME.BUSD, TOKEN_NAME.BUSD, TOKEN_DECIMAL.BUSD)) as Token
    usdt = (await TokenContractFactory.deploy(TOKEN_NAME.USDT, TOKEN_NAME.USDT, TOKEN_DECIMAL.USDT)) as Token
    console.log('StableTokens deployed')
    console.log('USDC amount:', (await usdc.balanceOf(await owner.getAddress())).toString())
    console.log('BUSD amount:', (await busd.balanceOf(await owner.getAddress())).toString())
    console.log('USDT amount:', (await usdt.balanceOf(await owner.getAddress())).toString())
    loopContract = (await TokenContractFactory.deploy('LOOP', 'LOOP', 18)) as Token
    await loopContract.deployed()
    console.log('LoopToken deployed')
    const PresaleContractFactory = await ethers.getContractFactory('Presale')
    presaleContract = (await PresaleContractFactory.deploy(
      loopContract.address, 
      saleStart_20220201_11_00_00_GMT_Time, 
      saleEnd_20220201_17_00_00_GMT_Time, 
      fcfsMinutes, 
      getBigNumber(tokenPrice), 
      getBigNumber(allowedTokenAmount),
      [
        usdc.address,
        busd.address,
        usdt.address
      ],
      getBigNumber(presaleTokenAmount)
      )) as Presale
    await presaleContract.deployed()
    console.log('PresaleContract deployed')
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
    it('Can not set pause if not owner', async () => {
      await expect(presaleContract.connect(addr1).stopContract(true)).to.be.reverted
    })
    it('Can set pause if owner', async () => {
      await expect(presaleContract.stopContract(false)).to.be.not.reverted
    })
    it('Can not add whitelist if not owner', async () => {
      await expect(presaleContract.connect(addr1).addWhitelist(await addr1.getAddress())).to.be.reverted
    })
    it('Can add whitelist if owner', async () => {
      await expect(presaleContract.addWhitelist(await owner.getAddress())).to.be.not.reverted
    })
    it('Can remove whitelist if owner', async () => {
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
      await advanceBlockTimeStamp(Number(saleStart_20220201_11_00_00_GMT_Time))
      await expect(presaleContract.buyToken(usdc.address, getBigNumber(100, TOKEN_DECIMAL.USDC))).to.be.revertedWith('Not whitelist address')
    })

    it('Token purchases can not be made if not stableToken address ', async () => {
      await presaleContract.addWhitelist(await owner.getAddress())
      const wrongTokenAddress = '0x3c2b8be99c50593081eaa2a724f0b8285f5aba8f'
      await expect(presaleContract.buyToken(wrongTokenAddress, getBigNumber(100, TOKEN_DECIMAL.USDC))).to.be.revertedWith('Not stableToken address')
    })

    it('purchase tokens ', async () => {
      await usdc.approve(presaleContract.address, getBigNumber(300, TOKEN_DECIMAL.USDC))
      await presaleContract.buyToken(usdc.address, getBigNumber(300, TOKEN_DECIMAL.USDC))
      console.log('Saled Token Amount:', formatUnits(await presaleContract.getSaledToken()))
    })

    // it('Token purchases can not be made after Presale period ', async () => {
    //   await advanceBlockTimeStamp(Number(afterPresale_20220202_17_39_49_GMT_Time))
    //   await expect(presaleContract.buyToken(stableTokens.USDC, getBigNumber(100, TOKEN_DECIMAL.USDC))).to.be.revertedWith('Out of presale period')
    // })

    // it('Token purchases can not be made if not whitelist address ', async () => {
    //   await time.increaseTo(Number(saleStart_20220201_11_00_00_GMT_Time))
    //   await expect(presaleContract.buyToken(stableTokens.USDC, getBigNumber(100, TOKEN_DECIMAL.USDC))).to.be.revertedWith('Not whitelist address')
    // })
    // it('Can buy tokens during presale period ', async () => {
    //   await loopContract.approve(presaleContract.address, getBigNumber(presaleTokenAmount))
    //   loopContract.transfer(presaleContract.address, getBigNumber(presaleTokenAmount))
    //   expect(await loopContract.balanceOf(presaleContract.address)).to.equal(getBigNumber(presaleTokenAmount))
    //   console.log('Deposit LoopToken amount:', formatUnits(await loopContract.balanceOf(presaleContract.address)))
    // })
  })
})
