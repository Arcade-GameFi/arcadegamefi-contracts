import { expect } from 'chai'
import { ethers } from 'hardhat'
import { parseUnits, formatUnits } from "ethers/lib/utils";
import { Loop, Presale } from "../typechain-types"
import {
  advanceTime,
  getBigNumber,
  TOKEN_NAME,
  TOKEN_DECIMAL
} from './utils'

let loopContract: Loop
let presaleContract: Presale
let owner:any
let addr1
let addr2
let addrs
const saleStartTime = '1643713200'    //2022-02-01 11:00:00 GMT
const saleEndTime = '1643734800'    //2022-02-01 17:00:00 GMT
const fcfsMinutes = '20'
const tokenPrice = '0.008'
const allowedTokenAmount = '500';
const presaleTokenAmount = '60000000'
// const stableTokens = [
//   '0x985458e523db3d53125813ed68c274899e9dfab4',
//   '0xe176ebe47d621b984a73036b9da5d834411ef734',
//   '0x3c2b8be99c50593081eaa2a724f0b8285f5aba8f'
// ]
const stableTokens = {
  USDC: '0x32dB725138A0546BD1e5688C95cd4f28698E6E94',
  BUSD: '0xC7C540E5cBd421aEB459A6B546861AB776eF2762',
  USDT: '0xD014bF4a4A1ec01641463a9E5a6e8b8601Dc1255'
}

describe('presale-test', function () {
  before(async () => {
    ;[owner, addr1, addr2, ...addrs] = await ethers.getSigners()
    console.log('===================Deploying Contracts=====================')
    const LoopContractFactory = await ethers.getContractFactory('Loop')
    loopContract = (await LoopContractFactory.deploy('LOOP', 'LOOP')) as Loop
    await loopContract.deployed()
    console.log('LoopToken deployed')
    const PresaleContractFactory = await ethers.getContractFactory('Presale')
    presaleContract = (await PresaleContractFactory.deploy(
      loopContract.address, 
      saleStartTime, 
      saleEndTime, 
      fcfsMinutes, 
      getBigNumber(tokenPrice).toString(), 
      getBigNumber(allowedTokenAmount).toString(),
      [
        stableTokens.USDC,
        stableTokens.BUSD,
        stableTokens.USDT
      ],
      presaleTokenAmount
      )) as Presale
    await presaleContract.deployed()
  })

  describe('Deposit LoopToken into Presale Contract', async () => {
    it('deposit test', async () => {
      await loopContract.approve(presaleContract.address, getBigNumber(presaleTokenAmount))
      loopContract.transfer(presaleContract.address, getBigNumber(presaleTokenAmount))
      expect(await loopContract.balanceOf(presaleContract.address)).to.equal(getBigNumber(presaleTokenAmount))
      console.log('Deposit LoopToken amount:', formatUnits(await loopContract.balanceOf(presaleContract.address)))
    })
  })

  describe('Buy Token', async () => {
    console.log('Deposit LoopToken amount:', formatUnits(await loopContract.balanceOf(presaleContract.address)))
    it('Can not buy token if contract is paused ', async () => {
      await presaleContract.setPause(true)
      await expect(presaleContract.buyToken(stableTokens.USDC, getBigNumber(100, TOKEN_DECIMAL.USDC))).to.be.revertedWith('Contract is paused')
      // loopContract.transfer(presaleContract.address, getBigNumber(presaleTokenAmount))
      // expect(await loopContract.balanceOf(presaleContract.address)).to.equal(getBigNumber(presaleTokenAmount))
      // console.log('Deposit LoopToken amount:', formatUnits(await loopContract.balanceOf(presaleContract.address)))
    })

    // it('Can buy tokens during presale period ', async () => {
    //   await loopContract.approve(presaleContract.address, getBigNumber(presaleTokenAmount))
    //   loopContract.transfer(presaleContract.address, getBigNumber(presaleTokenAmount))
    //   expect(await loopContract.balanceOf(presaleContract.address)).to.equal(getBigNumber(presaleTokenAmount))
    //   console.log('Deposit LoopToken amount:', formatUnits(await loopContract.balanceOf(presaleContract.address)))
    // })
  })
})
