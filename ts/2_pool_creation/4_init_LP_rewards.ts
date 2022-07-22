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
  getCreatorKeypair
} from "./utils";
import { NETWORK } from "../config";

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
  const connection = new Connection(NETWORK, "confirmed");
  // const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const creatorKeypair = getCreatorKeypair(); // getKeypair("creator");
  
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
  
  console.log(PDA[0].toBase58());
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
  list.push({ "Property" : "Amount A", "Value" : poolAccount.amountA.toString() });
  list.push({ "Property" : "Amount B", "Value" : poolAccount.amountB.toString() });
  list.push({ "Property" : "Amp", "Value" : poolAccount.amp.toString() });
  list.push({ "Property" : "total LP amount", "Value" : poolAccount.totalLpAmount.toString() });
  list.push({ "Property" : "min LP amount", "Value" : poolAccount.minLpAmount.toString() });
  list.push({ "Property" : "fee", "Value" : poolAccount.fee });
  list.push({ "Property" : "State", "Value" : poolAccount.state });
  
  console.table(list);

};

init_LP_rewards();


// 2022-0706 LpUSD-USDC devnet
// ata creator LP: CNxLr5PR8hpKrMHmC6vX3wkv3KPk9Hnjp3ea7W2scZXm
// 1.Create new LP TokenAccount of Creator.
// 2.Calc Amount of LP Token rewards
// 3.Transfer LP Token rewards: Pool PDA -> Creator
// ┌─────────┬───────────────────┬────────────────────────────────────────────────┐
// │ (index) │     Property      │                     Value                      │
// ├─────────┼───────────────────┼────────────────────────────────────────────────┤
// │    0    │      'Pool'       │ '4Mcu9CJj8EPtsijxtwqo5kpPJSmzyeTZKE7Won5Q6iyL' │
// │    1    │     'Creator'     │ 'AZzscKGxcnS25oyvcLWoYWAQPE4uv4pycXR8ANq1HkmD' │
// │    2    │     'A token'     │ '3GB97goPSqywzcXybmVurYW7jSxRdGuS28nj74W8fAtL' │
// │    3    │     'B token'     │ '6ybV587PY2z6DX4Pf1tTh8oEhnuR6wwXLE8LHinKQKYV' │
// │    4    │    'LP token'     │ 'DS4nZSEme92W77pYp1pmWXvZfyLt17uzoYm1Q7isPF2B' │
// │    5    │ 'A tokenAccount'  │ 'A7hyuLEdBFAD6uCPatCRywT1XRpXJjXFmwDDng89HZzB' │
// │    6    │ 'B tokenAccount'  │ 'FNTkSm3LRe6ZWx34hvwBzUqJavKpkvAEkw2zTJxsTtp'  │
// │    7    │ 'LP tokenAccount' │ '7girYuka921K7StyrHXgZRPhYnqGgvMLQTRCi9YxVE9d' │
// │    8    │    'Amount A'     │              '100000000000000000'              │
// │    9    │    'Amount B'     │              '100000000000000000'              │
// │   10    │       'Amp'       │                     '1000'                     │
// │   11    │ 'total LP amount' │              '100000000000000000'              │
// │   12    │  'min LP amount'  │                      '0'                       │
// │   13    │       'fee'       │                       5                        │
// │   14    │      'State'      │                       4                        │
// └─────────┴───────────────────┴────────────────────────────────────────────────┘

// 2022-0708 devnet
// LpSOL-wSOL

// 1.Create new LP TokenAccount of Creator.
// 2.Calc Amount of LP Token rewards
// 3.Transfer LP Token rewards: Pool PDA -> Creator
// ┌─────────┬───────────────────┬────────────────────────────────────────────────┐
// │ (index) │     Property      │                     Value                      │
// ├─────────┼───────────────────┼────────────────────────────────────────────────┤
// │    0    │      'Pool'       │ 'Hi9bZiEgdto5gHdMNfcZxHe1SZh63ifnD3HJEyWhcgKF' │
// │    1    │     'Creator'     │ 'AZzscKGxcnS25oyvcLWoYWAQPE4uv4pycXR8ANq1HkmD' │
// │    2    │     'A token'     │ '5jmsfTrYxWSKgrZp4Y8cziTWvt7rqmTCiJ75FbLqFTVZ' │
// │    3    │     'B token'     │ '6hPAQy93EbDzwHyU843zcWKATy8NrJ1ZsKCRi2JkuXcT' │
// │    4    │    'LP token'     │ '22Wi4Syqiedy28qaWiScGuKLskqSCsUM1z4Wob5yX6b2' │
// │    5    │ 'A tokenAccount'  │ '2HZYC2PuCg1oCKtLHcV7iz8ze8GW8kZEqQHQ6SKcS5YT' │
// │    6    │ 'B tokenAccount'  │ '7e571ANjwBKwEweVGwBWqbNmoKLHyiNMKTRvXvh5zvFi' │
// │    7    │ 'LP tokenAccount' │ 'BdN57uP2iStoaF4AGyTYhyKFhyBopH1p8MLZsaVogDsU' │
// │    8    │    'Amount A'     │               '1500000000000000'               │
// │    9    │    'Amount B'     │               '1500000000000000'               │
// │   10    │       'Amp'       │                     '1000'                     │
// │   11    │ 'total LP amount' │               '1500000000000000'               │
// │   12    │  'min LP amount'  │                      '0'                       │
// │   13    │       'fee'       │                       5                        │
// │   14    │      'State'      │                       4                        │
// └─────────┴───────────────────┴────────────────────────────────────────────────┘