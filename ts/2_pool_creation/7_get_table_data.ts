import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SwapBase } from "../../target/types/swap_base";
import { SignerWallet } from "@saberhq/solana-contrib";
import { 
    TOKEN_PROGRAM_ID, 
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  PublicKey,
  Connection,
} from "@solana/web3.js";

import {
  getPublicKey,
} from "./utils";
import { NETWORK } from "../config";
import { getCreatorKeypair } from "../2_pool_creation/utils";

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

const getTableData = async () => {
    
  const connection = new Connection(NETWORK, "confirmed");
  const userKeypair = getCreatorKeypair();

  const provider = new SignerWallet(userKeypair).createProvider(connection);
  anchor.setProvider(new anchor.AnchorProvider(connection, provider.wallet, anchor.AnchorProvider.defaultOptions()));
  const program = anchor.workspace.SwapBase as Program<SwapBase>;

  const pool_pubkey = await getPublicKey("pool");
  console.log("pool pubkey : ", pool_pubkey.toBase58());

  let poolAccount = await program.account.pool.fetch(pool_pubkey);
  const feeRate = Number(poolAccount.fee) / 1000;
  let totalLp = Number(poolAccount.totalLpAmount);
  let lpTokenPrice = 2;
  let Liquidity = lpTokenPrice * totalLp;
  console.log("Liquidity: ", Liquidity)
};

getTableData();