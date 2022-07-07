import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SwapBase } from "../../target/types/swap_base";
import { SignerWallet } from "@saberhq/solana-contrib";

import {
  Connection,
} from "@solana/web3.js";

import {
  getKeypair,
  getPublicKey,
} from "./utils";

const delete_pool = async () => {
    
  const creatorKeypair = getKeypair("creator");

  // const connection = new Connection("http://localhost:8899", "confirmed");
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const provider = new SignerWallet(creatorKeypair).createProvider(connection);
  // console.log(provider)
  anchor.setProvider(new anchor.AnchorProvider(connection, provider.wallet, anchor.AnchorProvider.defaultOptions()));
  const program = anchor.workspace.SwapBase as Program<SwapBase>;

  const poolAccounts = await program.account.pool.all();

  if (poolAccounts.length > 0){
    await program.rpc.deletePool({
        accounts: {
            pool: poolAccounts[0].publicKey,
            creator: poolAccounts[0].account.creator,
        },
    });
    console.log("Delete a Pool completed!");
    console.log("deleted pool pubkey: ", poolAccounts[0].publicKey.toBase58())
    console.log("remained :", poolAccounts.length-1);
  }else{
    console.log("There are not pools")
  }
};

delete_pool();
