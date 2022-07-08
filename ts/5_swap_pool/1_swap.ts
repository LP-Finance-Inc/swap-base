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
  getProgramId
} from "./utils";
import { LpSOLMint, LpUSDMint, NETWORK, USDCMint, wSOLMint } from "../config";
import { getATAPublicKey, getCreatorKeypair } from "../2_pool_creation/utils";

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

const swap_pool = async () => {
    
  const connection = new Connection(NETWORK, "confirmed");
  // const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const userKeypair = getCreatorKeypair(); // getKeypair("user");

  const provider = new SignerWallet(userKeypair).createProvider(connection);
  anchor.setProvider(new anchor.AnchorProvider(connection, provider.wallet, anchor.AnchorProvider.defaultOptions()));
  const program = anchor.workspace.SwapBase as Program<SwapBase>;

  const pool_pubkey = await getPublicKey("pool");
  console.log("pool pubkey : ", pool_pubkey.toBase58());

  // const ata_user_a = await getATAPublicKey(LpUSDMint, userKeypair.publicKey) // await getPublicKey("ata_user_a");
  const ata_user_a = await getATAPublicKey(LpSOLMint, userKeypair.publicKey) // await getPublicKey("ata_user_a");
  console.log("user_ata_a : ", ata_user_a.toBase58());

  // const ata_user_b = await getATAPublicKey(USDCMint, userKeypair.publicKey) // await getPublicKey("ata_user_b");
  const ata_user_b = await getATAPublicKey(wSOLMint, userKeypair.publicKey) // await getPublicKey("ata_user_b");
  console.log("user_ata_b : ", ata_user_b.toBase58());

  let poolAccount = await program.account.pool.fetch(pool_pubkey);

  const token_acc_a = poolAccount.tokenAccA;
  const token_acc_b = poolAccount.tokenAccB;

  const amount_swap = 1500000;
  const token_swap = poolAccount.tokenB;

  const swapProgramId = getProgramId();
  const PDA = await PublicKey.findProgramAddress(
    [Buffer.from("swap-pool-pda")],
    swapProgramId
  );

  console.log("LpUSD -> USDC swap: amount => ", amount_swap)

  await program.rpc.swapPool( 
    new anchor.BN(amount_swap * 1e9), 
    "swap-pool-pda",
    PDA[1],
    {
        accounts: {
            pool: pool_pubkey,
            swaper: userKeypair.publicKey,
            tokenSwap: token_swap,
            swaperAccA: ata_user_a,
            swaperAccB: ata_user_b,
            tokenAccA: token_acc_a,
            tokenAccB: token_acc_b,
            poolPda: PDA[0],
            tokenProgram: TOKEN_PROGRAM_ID,
        },
  });

  console.log("Token Swap Completed");

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
  list.push({ "Property" : "Amount A", "Value" : poolAccount.amountA.toNumber() });
  list.push({ "Property" : "Amount B", "Value" : poolAccount.amountB.toNumber() });
  list.push({ "Property" : "Amp", "Value" : poolAccount.amp.toNumber() });
  list.push({ "Property" : "total LP amount", "Value" : poolAccount.totalLpAmount.toNumber() });
  list.push({ "Property" : "min LP amount", "Value" : poolAccount.minLpAmount.toNumber() });
  list.push({ "Property" : "State", "Value" : poolAccount.state });
  
  console.table(list);

};

swap_pool();