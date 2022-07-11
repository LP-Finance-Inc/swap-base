import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SwapBase } from "../../target/types/swap_base";
import { SignerWallet } from "@saberhq/solana-contrib";
import { 
    TOKEN_PROGRAM_ID, 
    ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import {
  PublicKey,
  Connection,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";

import {
  getKeypair,
  getPublicKey,
  writePublicKey,
  getProgramId,
  getCreatorKeypair
} from "./utils";
import { NETWORK } from "../config";

const create_accounts = async () => {
    
  const connection = new Connection(NETWORK, "confirmed");
  // const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const creatorKeypair = getCreatorKeypair(); // getKeypair("creator");

  const provider = new SignerWallet(creatorKeypair).createProvider(connection);
  anchor.setProvider(new anchor.AnchorProvider(connection, provider.wallet, anchor.AnchorProvider.defaultOptions()));
  const program = anchor.workspace.SwapBase as Program<SwapBase>;

  const pool_pubkey = await getPublicKey("pool");
  
  let poolAccount = await program.account.pool.fetch(pool_pubkey);

  const creator_pubkey = poolAccount.creator;
  const token_mint_a = poolAccount.tokenA;
  const token_mint_b = poolAccount.tokenB;

  const token_acc_a_Keypair = anchor.web3.Keypair.generate();
  const token_acc_b_Keypair = anchor.web3.Keypair.generate();

  await program.rpc.createAccounts( 
    {
        accounts: {
            pool: pool_pubkey,
            creator: creator_pubkey,
            tokenA: token_mint_a,
            tokenB: token_mint_b,
            tokenAccA: token_acc_a_Keypair.publicKey,
            tokenAccB: token_acc_b_Keypair.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY  
        },
        signers: [
          token_acc_a_Keypair,
          token_acc_b_Keypair
        ]
  });

  console.log("1.Create A TokenAccount of Creator");
  console.log("2.Create B TokenAccount of Creator");
  console.log("3.Change A TokenAccount Owner: Creator->Pool PDA");
  console.log("4.Change B TokenAccount Owner: Creator->Pool PDA");

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

create_accounts();
