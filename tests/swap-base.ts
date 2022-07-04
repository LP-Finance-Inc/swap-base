import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SwapBase } from "../target/types/swap_base";

describe("swap-base", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SwapBase as Program<SwapBase>;

  it("Is initialized!", async () => {
    
  });
});
