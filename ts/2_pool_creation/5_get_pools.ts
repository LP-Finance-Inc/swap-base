import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SwapBase } from "../../target/types/swap_base";
import { SignerWallet, TransactionEnvelope } from "@saberhq/solana-contrib";

import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  Connection,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  Keypair,
} from "@solana/web3.js";
import BN = require("bn.js");
import {
  getCreatorKeypair,
  getKeypair,
  getProgramId,
  getPublicKey,
} from "./utils";
import { NETWORK } from "../config";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";

const get_pools = async () => {
    
  const creatorKeypair = getCreatorKeypair(); // getKeypair("creator");

  const connection = new Connection(NETWORK, "confirmed");
  // const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const provider = new SignerWallet(creatorKeypair).createProvider(connection);
  // console.log(provider)
  anchor.setProvider(new anchor.AnchorProvider(connection, provider.wallet, anchor.AnchorProvider.defaultOptions()));
  const program = anchor.workspace.SwapBase as Program<SwapBase>;
  
  try {
    const poolAccounts = await program.account.pool.all([
      {
        memcmp: {
          offset: 12,
          bytes: bs58.encode(Buffer.from('pool')),
        }
      }
    ]);

    console.log("Get existing Pool completed!");
  
    const len = poolAccounts.length;
    console.log("Pool amount : ", len);
  
    let list = []
    for (let i=0; i<len; i++){

      console.log(poolAccounts[i].account.tokenAccA.toString())
      console.log(poolAccounts[i].account.tokenAccB.toString())
      console.log(poolAccounts[i].account.tokenAccLp.toString())
      console.log(poolAccounts[i].account.tokenLp.toString())

      list.push({
          "pubkey" : poolAccounts[i].publicKey.toBase58(),
          "creator": poolAccounts[i].account.creator.toBase58().substring(0,5) + '...',
          "token1" : poolAccounts[i].account.tokenA.toBase58().substring(0,5) + '...',
          "amount1": poolAccounts[i].account.amountA.toString(),
          "token2" : poolAccounts[i].account.tokenB.toBase58().substring(0,5) + '...',
          "amount2": poolAccounts[i].account.amountB.toString(),
          "amp": poolAccounts[i].account.amp.toString(),
          "fee": poolAccounts[i].account.fee,
          "state": poolAccounts[i].account.state
      })
    }
  
    console.table(list);
  
  } catch(e) {
    console.log("failed");
    console.log(e);
  }


};

get_pools();