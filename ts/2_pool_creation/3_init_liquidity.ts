import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SwapBase } from "../../target/types/swap_base";
import { createMemoInstruction, SignerWallet, suppressConsoleErrorAsync } from "@saberhq/solana-contrib";
import BN = require("bn.js");
import { 
    Token,
    TOKEN_PROGRAM_ID, 
    ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import {
  PublicKey,
  Connection,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  Keypair,
  Signer
} from "@solana/web3.js";

import {
  getKeypair,
  getPublicKey,
  writePublicKey,
  getProgramId,
  getCreatorKeypair,
  getATAPublicKey
} from "./utils";
import { LpSOLMint, LpUSDMint, NETWORK, USDCMint, wSOLMint } from "../config";

async function findAssociatedTokenAddress(
  walletAddress: PublicKey,
  tokenMintAddress: PublicKey
): Promise<PublicKey> {
  return (await PublicKey.findProgramAddress(
      [
          walletAddress.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          tokenMintAddress.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
  ))[0];
}

const init_liquidity = async () => {
    
  const connection = new Connection(NETWORK, "confirmed");
  // const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const creatorKeypair = getCreatorKeypair(); // getKeypair("creator");

  const provider = new SignerWallet(creatorKeypair).createProvider(connection);
  anchor.setProvider(new anchor.AnchorProvider(connection, provider.wallet, anchor.AnchorProvider.defaultOptions()));
  const program = anchor.workspace.SwapBase as Program<SwapBase>;

  const pool_pubkey = await getPublicKey("pool");

  const ata_creator_a = await getATAPublicKey(LpUSDMint, creatorKeypair.publicKey); // getPublicKey("ata_creator_a");
  // const ata_creator_a = await getATAPublicKey(LpSOLMint, creatorKeypair.publicKey); // getPublicKey("ata_creator_a");
  console.log("creator_ata_a : ", ata_creator_a.toBase58());

  const ata_creator_b = await getATAPublicKey(USDCMint, creatorKeypair.publicKey) // getPublicKey("ata_creator_b");
  // const ata_creator_b = await getATAPublicKey(wSOLMint, creatorKeypair.publicKey) // getPublicKey("ata_creator_b");
  console.log("creator_ata_b : ", ata_creator_b.toBase58());

  let poolAccount = await program.account.pool.fetch(pool_pubkey);

  const amount_a = "100000000000000000"; // 1500000 * 1e9 // 
  const amount_b = "100000000000000000"; // 1500000 * 1e9 // 

  const creator_pubkey = poolAccount.creator;
  const token_acc_a = poolAccount.tokenAccA;
  const token_acc_b = poolAccount.tokenAccB;

  await program.rpc.initLiquidity( 
    new anchor.BN(amount_a), 
    new anchor.BN(amount_b), 
    {
        accounts: {
            pool: pool_pubkey,
            creator: creator_pubkey,
            creatorAccA: ata_creator_a,
            creatorAccB: ata_creator_b,
            tokenAccA: token_acc_a,
            tokenAccB: token_acc_b,
            tokenProgram: TOKEN_PROGRAM_ID,
        },
  });

  console.log("1.Transfer A Token: Creator -> Pool PDA");
  console.log("2.Transfer B Token: Creator -> Pool PDA");

  function sleep(milliseconds) {
    const date = Date.now();
    let currentDate = null;
    do {
      currentDate = Date.now();
    } while (currentDate - date < milliseconds);
  }
  sleep(1000);
  
  poolAccount = await program.account.pool.fetch(pool_pubkey);

  let list = [];
  list.push({ "Property" : "Pool", "Value" : pool_pubkey.toBase58() });
  list.push({ "Property" : "Creator", "Value" : poolAccount.creator.toBase58() });
  list.push({ "Property" : "A token", "Value" : poolAccount.tokenA.toBase58() });
  list.push({ "Property" : "B token", "Value" : poolAccount.tokenB.toBase58() });
  list.push({ "Property" : "LP token", "Value" : poolAccount.tokenLp.toBase58() });
  list.push({ "Property" : "A tokenAccount", "Value" : poolAccount.tokenAccA.toBase58() });
  list.push({ "Property" : "B tokenAccount", "Value" : poolAccount.tokenAccB.toBase58() });
  list.push({ "Property" : "LP tokenAccount", "Value" : poolAccount.tokenAccLp.toBase58() });
  list.push({ "Property" : "Amount A", "Value" : poolAccount.amountA.toString() });
  list.push({ "Property" : "Amount B", "Value" : poolAccount.amountB.toString() });
  list.push({ "Property" : "Amp", "Value" : poolAccount.amp.toString() });
  list.push({ "Property" : "total LP amount", "Value" : poolAccount.totalLpAmount.toString() });
  list.push({ "Property" : "min LP amount", "Value" : poolAccount.minLpAmount.toString() });
  list.push({ "Property" : "fee", "Value" : poolAccount.fee });
  list.push({ "Property" : "State", "Value" : poolAccount.state });
  
  console.table(list);

};

init_liquidity();
