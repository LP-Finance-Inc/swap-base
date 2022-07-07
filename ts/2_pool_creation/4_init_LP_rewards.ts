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

const init_LP_rewards = async () => {
    
  // const connection = new Connection("http://localhost:8899", "confirmed");
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const creatorKeypair = getKeypair("creator");
  
  const provider = new SignerWallet(creatorKeypair).createProvider(connection);
  anchor.setProvider(new anchor.AnchorProvider(connection, provider.wallet, anchor.AnchorProvider.defaultOptions()));
  const program = anchor.workspace.SwapBase as Program<SwapBase>;

  const pool_pubkey = await getPublicKey("pool");
  
  let poolAccount = await program.account.pool.fetch(pool_pubkey);

  const creator_pubkey = poolAccount.creator;
  const token_mint_lp = poolAccount.tokenLp;
  const token_acc_lp = poolAccount.tokenAccLp;
  
  const ata_creator_lp = await findAssociatedTokenAddress(
    creator_pubkey,
    token_mint_lp
  );
  console.log('ata creator LP:', ata_creator_lp.toBase58());

  const swapProgramId = getProgramId();
  const PDA = await PublicKey.findProgramAddress(
    [Buffer.from("swap-pool-pda")],
    swapProgramId
  );

  await program.rpc.initLpRewards( 
    "swap-pool-pda", 
    PDA[1], 
    {
        accounts: {
            pool: pool_pubkey,
            creator: creator_pubkey,
            tokenLp: token_mint_lp,
            ataCreatorLp: ata_creator_lp,
            tokenAccLp: token_acc_lp,
            poolPda: PDA[0],
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY  
        },
  });

  console.log("1.Create new LP TokenAccount of Creator.");
  console.log("2.Calc Amount of LP Token rewards");
  console.log("3.Transfer LP Token rewards: Pool PDA -> Creator");

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
  list.push({ "Property" : "fee", "Value" : poolAccount.fee });
  list.push({ "Property" : "State", "Value" : poolAccount.state });
  
  console.table(list);

};

init_LP_rewards();