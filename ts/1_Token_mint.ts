import {
    Connection,
    LAMPORTS_PER_SOL,
    PublicKey,
    Signer,
    Keypair
  } from "@solana/web3.js";
  import { 
    Token, 
    TOKEN_PROGRAM_ID, 
  } from "@solana/spl-token";
  import * as fs from "fs";
  import {
    getKeypair,
    getTokenBalance,
    writePublicKey,
  } from "./utils";
import { NETWORK } from "./config";
  
  const createMint = (
    connection: Connection,
    { publicKey, secretKey }: Signer,
    decimal
  ) => {
    return Token.createMint(
      connection,
      {
        publicKey,
        secretKey,
      },
      publicKey,
      null,
      decimal,
      TOKEN_PROGRAM_ID
    );
    
  };
  
  const setup = async () => {

    const creatorKeypair = getKeypair("creator");
    console.log("creator pubkey: ", creatorKeypair.publicKey.toBase58())

    const userKeypair = getKeypair("user");
    console.log("user pubkey: ", userKeypair.publicKey.toBase58())

    const connection = new Connection(NETWORK, "confirmed");
    console.log("Requesting SOL for Creator...");
    await connection.requestAirdrop(creatorKeypair.publicKey, LAMPORTS_PER_SOL * 2);
    console.log("2 SOL airDrop OK-----");
  
    console.log("---------------- Token Mint --------------------------")

    //----- token Mint -----------------------
    console.log(`Creating Token Mint A...`);
    const mint_a = await createMint(connection, creatorKeypair, 0);
    writePublicKey(mint_a.publicKey, `mint_a`);
    console.log(`Mint A->`, mint_a.publicKey.toBase58());

    console.log(`Creating Token Mint B...`);
    const mint_b = await createMint(connection, creatorKeypair, 0);
    writePublicKey(mint_b.publicKey, `mint_b`);
    console.log(`Mint B->`, mint_b.publicKey.toBase58());

    // console.log(`Creating LP Token Mint...`);
    // const mint_lp = await createMint(connection, creatorKeypair, 5);
    // writePublicKey(mint_lp.publicKey, `mint_lp`);
    // console.log(`Mint LP->`, mint_lp.publicKey.toBase58());
    console.log("--------- OK --------------------------------------");
    //------------ Creator --------------------
      //------ Creator ATA token A
      const ata_creator_a = await mint_a.createAssociatedTokenAccount(creatorKeypair.publicKey);
      writePublicKey(ata_creator_a, `ata_creator_a`);
      console.log(`ATA Creator Token A->`, ata_creator_a.toBase58());
    
      await mint_a.mintTo(ata_creator_a, creatorKeypair, [], 1500000);
      console.log("ATA-Creator-token A minting 1500000")
      console.log("--------- OK --------------------------------------");
    
      //------ User ATA token A
      const ata_user_a = await mint_a.createAssociatedTokenAccount(userKeypair.publicKey);
      writePublicKey(ata_user_a, `ata_user_a`);
      console.log(`ATA User Token A->`, ata_user_a.toBase58());
    
      await mint_a.mintTo(ata_user_a, creatorKeypair, [], 1500000);
      console.log("ATA-User-token A minting 1500000")
      console.log("--------- OK --------------------------------------");
      //------ Creator ATA token B
      const ata_creator_b = await mint_b.createAssociatedTokenAccount(creatorKeypair.publicKey);
      writePublicKey(ata_creator_b, `ata_creator_b`);
      console.log(`ATA Creator Token B->`, ata_creator_b.toBase58());
    
      await mint_b.mintTo(ata_creator_b, creatorKeypair, [], 1500000);
      console.log("ATA-Creator-token B minting 1500000")
      console.log("--------- OK --------------------------------------");

      //------ User ATA token B
      const ata_user_b = await mint_b.createAssociatedTokenAccount(userKeypair.publicKey);
      writePublicKey(ata_user_b, `ata_user_b`);
      console.log(`ATA User Token B->`, ata_user_b.toBase58());
    
      await mint_b.mintTo(ata_user_b, creatorKeypair, [], 1500000);
      console.log("ATA-User-token B minting 1500000")
      console.log("--------- OK --------------------------------------");
      
  //================ Print ========================================= 
  console.log("✨Setup complete✨\n");

  console.log("creator pubkey: ", creatorKeypair.publicKey.toBase58())
    
  console.table([
   {
     "Token A": await getTokenBalance(
       ata_creator_a,
       connection
     ),
     "Token B": await getTokenBalance(
        ata_creator_b,
        connection
      ),
      "LP Token": 0,
    },
  ]);
  
  console.log("");

  console.log("user pubkey: ", userKeypair.publicKey.toBase58())
  console.table([
    {
      "Token A": await getTokenBalance(
        ata_user_a,
        connection
      ),
      "Token B": await getTokenBalance(
        ata_user_b,
         connection
       ),
       "LP Token": 0,
     },
   ]);
   
   console.log("");
   

};
    
setup();
  