use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token::{TokenAccount, Mint, Token},
};

use anchor_lang::{solana_program, Result};
use solana_program::{
    program::{invoke, invoke_signed},
};

use std::f64;

declare_id!("9ctuy1ovKd6Mk1ugjoh936CrNCbsfRs7UFJQM32MxYoq");

#[program]
pub mod swap_base {

    use super::*;

    pub fn create_pool(ctx: Context<CreatePool>, 
        amount_a: u64, 
        amount_b: u64,
        amp: u64, 
        min_lp_amount: u64,
        fee: u8
    ) -> Result<()> {
        let pool: &mut Account<Pool> = &mut ctx.accounts.pool;
        let creator: &Signer = &ctx.accounts.creator;
        let token_a: &Account<Mint> = &ctx.accounts.token_a;
        let token_b: &Account<Mint> = &ctx.accounts.token_b;
        let token_lp: &mut Account<Mint> = &mut ctx.accounts.token_lp;
        let token_acc_lp: &mut Account<TokenAccount> = &mut ctx.accounts.token_acc_lp;
        let token_program:&Program<Token> = &ctx.accounts.token_program;
    
        pool.title = "pool".to_string();
        pool.creator = *creator.key;
        pool.token_a = token_a.key();
        pool.token_b = token_b.key();
        pool.token_lp = token_lp.key();
        pool.token_acc_lp = token_acc_lp.key();

        if amount_a == 0 || amount_b == 0 || amp == 0 {
            return Err(ErrorCode::AmountZeroError.into());
        }
        pool.amount_a = amount_a;
        pool.amount_b = amount_b;
        pool.amount_d = amount_a + amount_b;
        pool.amp = amp;
        pool.total_lp_amount = 0;
        pool.min_lp_amount = min_lp_amount;
        if fee < 5{
            pool.fee = 5;
        }else if fee > 100 {
            pool.fee = 100;
        }else{
            pool.fee = fee;
        }

        pool.state = 1;

        //--------- LP Token Mint to Creator -----------------
        let lp_token_mint_ix = spl_token::instruction::mint_to(
            token_program.key,
            token_lp.to_account_info().key,
            token_acc_lp.to_account_info().key,
            &creator.to_account_info().key,
            &[&creator.to_account_info().key],
            0xFFFFFFFFFFFFFFFF
        )?;
        invoke(
            &lp_token_mint_ix,
            &[
                creator.to_account_info().clone(),
                token_program.to_account_info().clone(),
                token_lp.to_account_info().clone(),
                token_acc_lp.to_account_info().clone(),
            ],
        )?;

        //-------- PDA Generate --------------------------------
        let (pda, _nonce) = Pubkey::find_program_address(
            &[b"swap-pool-pda"],
            ctx.program_id
        );        
        //-------- LP Token Owner Creator -> PDA ----------------
        let lp_owner_change_ix = spl_token::instruction::set_authority(
            token_program.key,
            token_lp.to_account_info().key,
            Some(&pda),
            spl_token::instruction::AuthorityType::MintTokens,
            creator.to_account_info().key,
            &[&creator.to_account_info().key],
        )?;
        invoke(
            &lp_owner_change_ix,
            &[
                creator.to_account_info().clone(),
                token_program.to_account_info().clone(),
                token_lp.to_account_info().clone(),
            ],
        )?;
        //-------- LP Token Account Owner Creator -> PDA ----------------
        let lp_owner_change_ix = spl_token::instruction::set_authority(
            token_program.key,
            token_acc_lp.to_account_info().key,
            Some(&pda),
            spl_token::instruction::AuthorityType::AccountOwner,
            creator.to_account_info().key,
            &[&creator.to_account_info().key],
        )?;
        invoke(
            &lp_owner_change_ix,
            &[
                creator.to_account_info().clone(),
                token_program.to_account_info().clone(),
                token_acc_lp.to_account_info().clone(),
            ],
        )?;

        Ok(())
    }

    pub fn create_accounts(ctx: Context<CreateAccounts>, 
    ) -> Result<()> {
        let pool: &mut Account<Pool> = &mut ctx.accounts.pool;
        let creator: &Signer = &ctx.accounts.creator;
        let token_acc_a: &mut Account<TokenAccount> = &mut ctx.accounts.token_acc_a;
        let token_acc_b: &mut Account<TokenAccount> = &mut ctx.accounts.token_acc_b;
        let token_program:&Program<Token> = &ctx.accounts.token_program;

        if pool.state != 1 {
            return Err(ErrorCode::CreateAccountStepError.into());
        }

        pool.token_acc_a = token_acc_a.key();
        pool.token_acc_b = token_acc_b.key();
        pool.state = 2;

        //-------- PDA Generate --------------------------------
        let (pda, _nonce) = Pubkey::find_program_address(
            &[b"swap-pool-pda"],
            ctx.program_id
        );        
        //-------- Token Account A Owner Creator -> PDA ----------------
        let acc_a_owner_change_ix = spl_token::instruction::set_authority(
            token_program.key,
            token_acc_a.to_account_info().key,
            Some(&pda),
            spl_token::instruction::AuthorityType::AccountOwner,
            creator.to_account_info().key,
            &[&creator.to_account_info().key],
        )?;
        invoke(
            &acc_a_owner_change_ix,
            &[
                creator.to_account_info().clone(),
                token_program.to_account_info().clone(),
                token_acc_a.to_account_info().clone(),
            ],
        )?;
        //-------- Token Account B Owner Creator -> PDA ----------------
        let acc_b_owner_change_ix = spl_token::instruction::set_authority(
            token_program.key,
            token_acc_b.to_account_info().key,
            Some(&pda),
            spl_token::instruction::AuthorityType::AccountOwner,
            creator.to_account_info().key,
            &[&creator.to_account_info().key],
        )?;
        invoke(
            &acc_b_owner_change_ix,
            &[
                creator.to_account_info().clone(),
                token_program.to_account_info().clone(),
                token_acc_b.to_account_info().clone(),
            ],
        )?;

        Ok(())
    }

    pub fn init_liquidity(ctx: Context<InitLiquidity>, 
        amount_a: u64, 
        amount_b: u64,
    ) -> Result<()> {
        let pool: &mut Account<Pool> = &mut ctx.accounts.pool;
        let creator: &Signer = &ctx.accounts.creator;
        let creator_acc_a: &AccountInfo = &ctx.accounts.creator_acc_a;
        let creator_acc_b: &AccountInfo = &ctx.accounts.creator_acc_b;
        let token_acc_a: &AccountInfo = &ctx.accounts.token_acc_a;
        let token_acc_b: &AccountInfo = &ctx.accounts.token_acc_b;
        let token_program:&Program<Token> = &ctx.accounts.token_program;

        if pool.state != 2 {
            return Err(ErrorCode::InitLiquidityStepError.into());
        }
        
        if (pool.amount_a != amount_a) || (pool.amount_b != amount_b) {
            return Err(ErrorCode::InitLiquidityAmountError.into());
        } 

        pool.state = 3;
        
        //-------- Deposit Token A Creator -> POOL PDA -----------------------------
        let deposit_ix_a = spl_token::instruction::transfer(
            token_program.key,
            creator_acc_a.to_account_info().key,
            token_acc_a.to_account_info().key,
            creator.to_account_info().key,
            &[&creator.to_account_info().key],
            amount_a
        )?;
        invoke(
            &deposit_ix_a,
            &[
                creator.to_account_info().clone(),
                creator_acc_a.to_account_info().clone(),
                token_acc_a.to_account_info().clone(),
                token_program.to_account_info().clone(),
            ],
        )?;
        //-------- Deposit Token B Creator -> POOL PDA -----------------------------
        let deposit_ix_b = spl_token::instruction::transfer(
            token_program.key,
            creator_acc_b.to_account_info().key,
            token_acc_b.to_account_info().key,
            creator.to_account_info().key,
            &[&creator.to_account_info().key],
            amount_b
        )?;
        invoke(
            &deposit_ix_b,
            &[
                creator.to_account_info().clone(),
                creator_acc_b.to_account_info().clone(),
                token_acc_b.to_account_info().clone(),
                token_program.to_account_info().clone(),
            ],
        )?;

        Ok(())
    }

    pub fn init_lp_rewards(ctx: Context<InitLpRewards>,
        seed: String,
        bump: u8
    ) -> Result<()> {
        let pool: &mut Account<Pool> = &mut ctx.accounts.pool;
        let token_lp: &mut Account<Mint> = &mut ctx.accounts.token_lp;
        let ata_creator_lp: &mut Account<TokenAccount> =  &mut ctx.accounts.ata_creator_lp;
        let token_acc_lp:&mut Account<TokenAccount> = &mut ctx.accounts.token_acc_lp;
        let pool_pda = &ctx.accounts.pool_pda;
        let token_program:&Program<Token> = &ctx.accounts.token_program;

        if pool.state != 3 {
            return Err(ErrorCode::InitLpRewardsStepError.into());
        }
        if token_lp.key() != pool.token_lp {
            return Err(ErrorCode::LpTokenError.into());
        }

        let amount_a_f: f64 = pool.amount_a as f64;
        let amount_b_f: f64 = pool.amount_b as f64;
        let min_lp_amount = pool.min_lp_amount;

        let lp_rewards = (amount_a_f * amount_b_f).sqrt() as u64 - min_lp_amount;

        pool.total_lp_amount = lp_rewards;

        pool.state = 4;
        //-------- PDA Generate --------------------------------
        let (pda, _nonce) = Pubkey::find_program_address(
            &[b"swap-pool-pda"],
            ctx.program_id
        );        
        msg!("PDA: {}", pda.to_string());
        //---------- LP Token Rewards -----------------------------
        let lp_token_rewards_ix = spl_token::instruction::transfer(
            token_program.key,
            token_acc_lp.to_account_info().key,
            ata_creator_lp.to_account_info().key,
            &pda,
            &[&pda],
            lp_rewards
        )?;
        invoke_signed(
            &lp_token_rewards_ix,
            &[
                token_acc_lp.to_account_info().clone(),
                ata_creator_lp.to_account_info().clone(),
                token_program.to_account_info().clone(),
                pool_pda.to_account_info().clone()
            ],
            &[&[&b"swap-pool-pda".as_ref(), &[_nonce]]],
        )?;

        Ok(())
    }

    pub fn delete_pool(_ctx: Context<DeletePool>) -> Result<()> {
        Ok(())
    }

    pub fn add_liquidity(ctx: Context<AddLiquidity>, 
        amount_a: u64, 
        seed: String,
        bump: u8
    ) -> Result<()> {
        let pool: &mut Account<Pool> = &mut ctx.accounts.pool;
        let adder: &Signer = &ctx.accounts.adder;
        let adder_acc_a: &AccountInfo = &ctx.accounts.adder_acc_a;
        let adder_acc_b: &AccountInfo = &ctx.accounts.adder_acc_b;
        let token_acc_a: &AccountInfo = &ctx.accounts.token_acc_a;
        let token_acc_b: &AccountInfo = &ctx.accounts.token_acc_b;
        let token_lp: &Account<Mint> = &ctx.accounts.token_lp;
        let ata_adder_lp: &Account<TokenAccount> = &ctx.accounts.ata_adder_lp;
        let token_acc_lp: &AccountInfo = &ctx.accounts.token_acc_lp;
        let pool_pda: &AccountInfo = &ctx.accounts.pool_pda;
        let token_program:&Program<Token> = &ctx.accounts.token_program;

        if pool.state != 4 {
            return Err(ErrorCode::AddLiquidityStepError.into());
        }
        
        if amount_a == 0 {
            return Err(ErrorCode::AmountZeroError.into());
        }

        if pool.token_lp != token_lp.key() {
            return Err(ErrorCode::LpTokenError.into());
        }

        if pool.token_acc_lp != token_acc_lp.key() {
            return Err(ErrorCode::LpTokenAccountError.into());
        }

        if pool.token_acc_a != token_acc_a.key() {
            return Err(ErrorCode::TokenAccountError.into());
        }
       
        if pool.token_acc_b != token_acc_b.key() {
            return Err(ErrorCode::TokenAccountError.into());
        }

        let pool_amount_a_f: f64 = pool.amount_a as f64;
        let pool_amount_b_f: f64 = pool.amount_b as f64;
        let add_amount_a_f: f64 = amount_a as f64;
        let add_amount_b_f: f64 = pool_amount_b_f / pool_amount_a_f * add_amount_a_f;
        
        let amount_b = add_amount_b_f as u64;

        let lp_amount_a_f: f64 = amount_a as f64;
        let lp_amount_b_f: f64 = amount_b as f64;
        let min_lp_amount = pool.min_lp_amount;

        let lp_rewards = (lp_amount_a_f * lp_amount_b_f).sqrt() as u64 - min_lp_amount;

        pool.amount_a += amount_a;
        pool.amount_b += amount_b;
        pool.amount_d = pool.amount_a + pool.amount_b;
        pool.total_lp_amount += lp_rewards;        

        // //-------- Deposit Token A Adder -> POOL PDA -----------------------------
        let deposit_ix_a = spl_token::instruction::transfer(
            token_program.key,
            adder_acc_a.to_account_info().key,
            token_acc_a.to_account_info().key,
            adder.to_account_info().key,
            &[&adder.to_account_info().key],
            amount_a
        )?;
        invoke(
            &deposit_ix_a,
            &[
                adder.to_account_info().clone(),
                adder_acc_a.to_account_info().clone(),
                token_acc_a.to_account_info().clone(),
                token_program.to_account_info().clone(),
            ],
        )?;
        //-------- Deposit Token B Adder -> POOL PDA -----------------------------
        let deposit_ix_b = spl_token::instruction::transfer(
            token_program.key,
            adder_acc_b.to_account_info().key,
            token_acc_b.to_account_info().key,
            adder.to_account_info().key,
            &[&adder.to_account_info().key],
            amount_b
        )?;
        invoke(
            &deposit_ix_b,
            &[
                adder.to_account_info().clone(),
                adder_acc_b.to_account_info().clone(),
                token_acc_b.to_account_info().clone(),
                token_program.to_account_info().clone(),
            ],
        )?;

        //-------- PDA Generate --------------------------------
        let (pda, _nonce) = Pubkey::find_program_address(
            &[b"swap-pool-pda"],
            ctx.program_id
        );        
        msg!("PDA: {}", pda.to_string());
        //---------- LP Token Rewards -----------------------------
        let lp_token_rewards_ix = spl_token::instruction::transfer(
            token_program.key,
            token_acc_lp.to_account_info().key,
            ata_adder_lp.to_account_info().key,
            &pda,
            &[&pda],
            lp_rewards
        )?;
        invoke_signed(
            &lp_token_rewards_ix,
            &[
                token_acc_lp.to_account_info().clone(),
                ata_adder_lp.to_account_info().clone(),
                token_program.to_account_info().clone(),
                pool_pda.to_account_info().clone()
            ],
            &[&[&b"swap-pool-pda".as_ref(), &[_nonce]]],
        )?;

        Ok(())
    }

    pub fn remove_liquidity(ctx: Context<RemoveLiquidity>, 
        amount_lp: u64, 
        seed: String,
        bump: u8
    ) -> Result<()> {
        let pool: &mut Account<Pool> = &mut ctx.accounts.pool;
        let remover: &Signer = &ctx.accounts.remover;
        let remover_acc_a: &AccountInfo = &ctx.accounts.remover_acc_a;
        let remover_acc_b: &AccountInfo = &ctx.accounts.remover_acc_b;
        let token_acc_a: &AccountInfo = &ctx.accounts.token_acc_a;
        let token_acc_b: &AccountInfo = &ctx.accounts.token_acc_b;
        let ata_remover_lp: &AccountInfo = &ctx.accounts.ata_remover_lp;
        let token_acc_lp: &AccountInfo = &ctx.accounts.token_acc_lp;
        let pool_pda: &AccountInfo = &ctx.accounts.pool_pda;
        let token_program:&Program<Token> = &ctx.accounts.token_program;

        if pool.state != 4 {
            return Err(ErrorCode::AddLiquidityStepError.into());
        }
        
        if amount_lp == 0 {
            return Err(ErrorCode::AmountZeroError.into());
        }

        if pool.token_acc_lp != token_acc_lp.key() {
            return Err(ErrorCode::LpTokenAccountError.into());
        }

        if pool.token_acc_a != token_acc_a.key() {
            return Err(ErrorCode::TokenAccountError.into());
        }
       
        if pool.token_acc_b != token_acc_b.key() {
            return Err(ErrorCode::TokenAccountError.into());
        }

        let amount_lp_f: f64 = amount_lp as f64;
        let amount_total_lp_f: f64 = pool.total_lp_amount as f64;
        let pool_amount_a_f: f64 = pool.amount_a as f64;
        let pool_amount_b_f: f64 = pool.amount_b as f64;
        let amount_a: u64 = ((amount_lp_f / amount_total_lp_f) * pool_amount_a_f) as u64;
        let amount_b: u64 = ((amount_lp_f / amount_total_lp_f) * pool_amount_b_f) as u64;

        pool.amount_a -= amount_a;
        pool.amount_b -= amount_b;
        pool.amount_d = pool.amount_a + pool.amount_b;
        pool.total_lp_amount -= amount_lp;        

        //---------- LP Token Transfer Remover -> Pool PDA -----------------------------
        let lp_token_return_ix = spl_token::instruction::transfer(
            token_program.key,
            ata_remover_lp.to_account_info().key,
            token_acc_lp.to_account_info().key,
            &remover.to_account_info().key(),
            &[&remover.to_account_info().key()],
            amount_lp
        )?;
        invoke(
            &lp_token_return_ix,
            &[
                token_acc_lp.to_account_info().clone(),
                ata_remover_lp.to_account_info().clone(),
                token_program.to_account_info().clone(),
                remover.to_account_info().clone()
            ]
        )?;
        //-------- PDA Generate --------------------------------
        let (pda, _nonce) = Pubkey::find_program_address(
            &[b"swap-pool-pda"],
            ctx.program_id
        );        
        msg!("PDA: {}", pda.to_string());
        //-------- Withdraw Token A POOL PDA -> Remover -----------------------------
        let withdraw_ix_a = spl_token::instruction::transfer(
            token_program.key,
            token_acc_a.to_account_info().key,
            remover_acc_a.to_account_info().key,
            &pda,
            &[&pda],
            amount_a
        )?;
        invoke_signed(
            &withdraw_ix_a,
            &[
                pool_pda.to_account_info().clone(),
                remover_acc_a.to_account_info().clone(),
                token_acc_a.to_account_info().clone(),
                token_program.to_account_info().clone(),
            ],
            &[&[&b"swap-pool-pda".as_ref(), &[_nonce]]],
        )?;
        //-------- Withdraw Token B POOL PDA -> Remover -----------------------------
        let withdraw_ix_b = spl_token::instruction::transfer(
            token_program.key,
            token_acc_b.to_account_info().key,
            remover_acc_b.to_account_info().key,
            &pda,
            &[&pda],
            amount_b
        )?;
        invoke_signed(
            &withdraw_ix_b,
            &[
                pool_pda.to_account_info().clone(),
                remover_acc_b.to_account_info().clone(),
                token_acc_b.to_account_info().clone(),
                token_program.to_account_info().clone(),
            ],
            &[&[&b"swap-pool-pda".as_ref(), &[_nonce]]],
        )?;

        Ok(())
    }

    pub fn swap_pool(ctx: Context<SwapPool>, 
        amount_swap: u64, 
        seed: String,
        bump: u8
    ) -> Result<()> {
        let pool: &mut Account<Pool> = &mut ctx.accounts.pool;
        let swaper: &Signer = &ctx.accounts.swaper;
        let token_swap = &ctx.accounts.token_swap;
        let swaper_acc_a: &AccountInfo = &ctx.accounts.swaper_acc_a;
        let swaper_acc_b: &AccountInfo = &ctx.accounts.swaper_acc_b;
        let token_acc_a: &AccountInfo = &ctx.accounts.token_acc_a;
        let token_acc_b: &AccountInfo = &ctx.accounts.token_acc_b;
        let pool_pda: &AccountInfo = &ctx.accounts.pool_pda;
        let token_program:&Program<Token> = &ctx.accounts.token_program;

        if pool.state != 4 {
            return Err(ErrorCode::AddLiquidityStepError.into());
        }
        
        if amount_swap == 0 {
            return Err(ErrorCode::AmountZeroError.into());
        }

        if pool.token_acc_a != token_acc_a.key() {
            return Err(ErrorCode::TokenAccountError.into());
        }
       
        if pool.token_acc_b != token_acc_b.key() {
            return Err(ErrorCode::TokenAccountError.into());
        }

        //-------- PDA Generate --------------------------------
        let (pda, _nonce) = Pubkey::find_program_address(
            &[b"swap-pool-pda"],
            ctx.program_id
        );        
        msg!("PDA: {}", pda.to_string());

        if token_swap.key() == pool.token_a {

            let amp_f = pool.amp as f64;
            let d_f = pool.amount_d as f64;
            let amount_a_f = (pool.amount_a + amount_swap) as f64;

            let a: f64 = 16.0 * amp_f * amount_a_f;
            let b: f64 = 16.0 * amp_f * amount_a_f * amount_a_f - 4.0 * d_f * (4.0 * amp_f - 1.0 ) * amount_a_f;
            let c: f64 = -1.0 * d_f * d_f * d_f;

            let amount_b_f: f64 = (-1.0*b+(b*b-4.0*a*c).sqrt())/2.0/a;
            let amount_return_f =pool.amount_b as f64 - amount_b_f;
            let amount_return = (amount_return_f * (100.0 - pool.fee as f64 / 10.0) / 100.0) as u64;

            pool.amount_a += amount_swap;
            pool.amount_b -= amount_return;
            pool.amount_d = pool.amount_a + pool.amount_b;


            //---------- Token A Transfer Swaper -> Pool PDA -----------------------------
            let swap_ix_a = spl_token::instruction::transfer(
                token_program.key,
                swaper_acc_a.to_account_info().key,
                token_acc_a.to_account_info().key,
                &swaper.to_account_info().key(),
                &[&swaper.to_account_info().key()],
                amount_swap
            )?;
            invoke(
                &swap_ix_a,
                &[
                    token_acc_a.to_account_info().clone(),
                    swaper_acc_a.to_account_info().clone(),
                    token_program.to_account_info().clone(),
                    swaper.to_account_info().clone()
                ]
            )?;
            //-------- Token B POOL PDA -> Swaper -----------------------------
            let withdraw_ix_b = spl_token::instruction::transfer(
                token_program.key,
                token_acc_b.to_account_info().key,
                swaper_acc_b.to_account_info().key,
                &pda,
                &[&pda],
                amount_return
            )?;
            invoke_signed(
                &withdraw_ix_b,
                &[
                    pool_pda.to_account_info().clone(),
                    swaper_acc_b.to_account_info().clone(),
                    token_acc_b.to_account_info().clone(),
                    token_program.to_account_info().clone(),
                ],
                &[&[&b"swap-pool-pda".as_ref(), &[_nonce]]],
            )?;
        } else if token_swap.key() == pool.token_b {
            let amp_f = pool.amp as f64;
            let d_f = pool.amount_d as f64;
            let amount_b_f = (pool.amount_b + amount_swap) as f64;

            let a: f64 = 16.0 * amp_f * amount_b_f;
            let b: f64 = 16.0 * amp_f * amount_b_f * amount_b_f - 4.0 * d_f * (4.0 * amp_f - 1.0 ) * amount_b_f;
            let c: f64 = -1.0 * d_f * d_f * d_f;

            let amount_a_f: f64 = (-1.0*b+(b*b-4.0*a*c).sqrt())/2.0/a;
            let amount_return_f =pool.amount_a as f64 - amount_a_f;
            let amount_return = (amount_return_f * (100.0 - pool.fee as f64 / 10.0) / 100.0) as u64;

            pool.amount_b += amount_swap;
            pool.amount_a -= amount_return;
            pool.amount_d = pool.amount_a + pool.amount_b;

            //---------- Token B Transfer Swaper -> Pool PDA -----------------------------
            let swap_ix_b = spl_token::instruction::transfer(
                token_program.key,
                swaper_acc_b.to_account_info().key,
                token_acc_b.to_account_info().key,
                &swaper.to_account_info().key(),
                &[&swaper.to_account_info().key()],
                amount_swap
            )?;
            invoke(
                &swap_ix_b,
                &[
                    token_acc_b.to_account_info().clone(),
                    swaper_acc_b.to_account_info().clone(),
                    token_program.to_account_info().clone(),
                    swaper.to_account_info().clone()
                ]
            )?;
            //-------- Token A POOL PDA -> Swaper -----------------------------
            let withdraw_ix_a = spl_token::instruction::transfer(
                token_program.key,
                token_acc_a.to_account_info().key,
                swaper_acc_a.to_account_info().key,
                &pda,
                &[&pda],
                amount_return
            )?;
            invoke_signed(
                &withdraw_ix_a,
                &[
                    pool_pda.to_account_info().clone(),
                    swaper_acc_a.to_account_info().clone(),
                    token_acc_a.to_account_info().clone(),
                    token_program.to_account_info().clone(),
                ],
                &[&[&b"swap-pool-pda".as_ref(), &[_nonce]]],
            )?;
        } else {
            return Err(ErrorCode::TokenError.into());
        }

        Ok(())
    }

}
#[derive(Accounts)]
#[instruction(
    amount_a: u64, 
    amount_b: u64,
    amp: u64, 
    min_lp_amount: u64,
    fee: u8
)]
pub struct CreatePool<'info> {
    #[account(
        init, 
        payer = creator, 
        space = Pool::LEN
    )]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub token_a: Account<'info, Mint>,
    pub token_b: Account<'info, Mint>,
    #[account(
        init,
        payer = creator,
        mint::decimals = 5,
        mint::authority = creator,
    )]    
    pub token_lp: Account<'info, Mint>,
    #[account(
        init,
        payer = creator,
        token::mint = token_lp,
        token::authority = creator,
    )]
    pub token_acc_lp: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CreateAccounts<'info> {
    #[account(mut, has_one = creator)]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub token_a: Account<'info, Mint>,
    pub token_b: Account<'info, Mint>,
    #[account(
        init,
        payer = creator,
        token::mint = token_a,
        token::authority = creator,
    )]
    pub token_acc_a: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = creator,
        token::mint = token_b,
        token::authority = creator,
    )]
    pub token_acc_b: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(
    amount_a: u64, 
    amount_b: u64,
)]
pub struct InitLiquidity<'info> {
    #[account(mut, has_one = creator)]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub creator: Signer<'info>,
    /// CHECK: This is safe
    #[account(mut)]
    pub creator_acc_a: AccountInfo<'info>,
    /// CHECK: This is safe
    #[account(mut)]
    pub creator_acc_b: AccountInfo<'info>,
    /// CHECK: This is safe
    #[account(mut)]
    pub token_acc_a: AccountInfo<'info>,
    /// CHECK: This is safe
    #[account(mut)]
    pub token_acc_b: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(
    seed: String, 
    bump: u8
)]
pub struct InitLpRewards<'info> {
    #[account(mut, has_one = creator)]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub token_lp: Account<'info, Mint>,
    #[account(
        init,
        payer = creator,
        associated_token::mint = token_lp,
        associated_token::authority = creator,
    )]
    pub ata_creator_lp: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = token_lp
    )]
    pub token_acc_lp: Account<'info, TokenAccount>,
    /// CHECK: This is safe
    #[account(seeds = [seed.as_ref()], bump)]
    pub pool_pda: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct DeletePool<'info> {
    #[account(mut, has_one = creator, close = creator)]
    pub pool: Account<'info, Pool>,
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(
    amount_a: u64, 
    seed: String, 
    bump: u8
)]
pub struct AddLiquidity<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub adder: Signer<'info>,
    /// CHECK: This is safe
    #[account(mut)]
    pub adder_acc_a: AccountInfo<'info>,
    /// CHECK: This is safe
    #[account(mut)]
    pub adder_acc_b: AccountInfo<'info>,
    /// CHECK: This is safe
    #[account(mut)]
    pub token_acc_a: AccountInfo<'info>,
    /// CHECK: This is safe
    #[account(mut)]
    pub token_acc_b: AccountInfo<'info>,
    pub token_lp: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = adder,
        associated_token::mint = token_lp,
        associated_token::authority = adder,
    )]
    pub ata_adder_lp: Account<'info, TokenAccount>,
    /// CHECK: This is safe
    #[account(mut)]
    pub token_acc_lp: AccountInfo<'info>,
    /// CHECK: This is safe
    #[account(seeds = [seed.as_ref()], bump)]
    pub pool_pda: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(
    amount_lp: u64, 
    seed: String, 
    bump: u8
)]
pub struct RemoveLiquidity<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub remover: Signer<'info>,
    /// CHECK: This is safe
    #[account(mut)]
    pub remover_acc_a: AccountInfo<'info>,
    /// CHECK: This is safe
    #[account(mut)]
    pub remover_acc_b: AccountInfo<'info>,
    /// CHECK: This is safe
    #[account(mut)]
    pub token_acc_a: AccountInfo<'info>,
    /// CHECK: This is safe
    #[account(mut)]
    pub token_acc_b: AccountInfo<'info>,
    /// CHECK: This is safe
    #[account(mut)]
    pub ata_remover_lp: AccountInfo<'info>,
    /// CHECK: This is safe
    #[account(mut)]
    pub token_acc_lp: AccountInfo<'info>,
    /// CHECK: This is safe
    #[account(seeds = [seed.as_ref()], bump)]
    pub pool_pda: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(
    amount_swap: u64, 
    seed: String, 
    bump: u8
)]
pub struct SwapPool<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub swaper: Signer<'info>,
    pub token_swap: Account<'info, Mint>,
    /// CHECK: This is safe
    #[account(mut)]
    pub swaper_acc_a: AccountInfo<'info>,
    /// CHECK: This is safe
    #[account(mut)]
    pub swaper_acc_b: AccountInfo<'info>,
    /// CHECK: This is safe
    #[account(mut)]
    pub token_acc_a: AccountInfo<'info>,
    /// CHECK: This is safe
    #[account(mut)]
    pub token_acc_b: AccountInfo<'info>,
    /// CHECK: This is safe
    /// CHECK: This is safe
    #[account(seeds = [seed.as_ref()], bump)]
    pub pool_pda: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Pool {
    pub title: String,
    pub creator: Pubkey,
    pub token_a: Pubkey,
    pub token_b: Pubkey,
    pub token_lp: Pubkey,
    pub token_acc_a: Pubkey,
    pub token_acc_b: Pubkey,
    pub token_acc_lp: Pubkey,
    pub amount_a: u64,
    pub amount_b: u64,
    pub amount_d: u64,
    pub amp: u64,               // 500 ~ 1000
    pub total_lp_amount: u64,
    pub min_lp_amount: u64,
    pub state: u8,              // 1 - created & non init   2 - init liquidity   3 - init LP Token
    pub fee: u8,                // real fee = (fee / 10) %
}

const DISCRIMINATOR_LENGTH: usize = 8;
const PUBLIC_KEY_LENGTH: usize = 32;
const U64_LENGTH: usize = 8;
const U8_LENGTH: usize =1;
const TITLE_LENGTH: usize = 4*2; // Title -> pool

impl Pool {
    const LEN: usize = DISCRIMINATOR_LENGTH
    + TITLE_LENGTH          //Title
    + PUBLIC_KEY_LENGTH     // creator
    + PUBLIC_KEY_LENGTH     // token_a
    + PUBLIC_KEY_LENGTH     // token_b
    + PUBLIC_KEY_LENGTH     // token_lp
    + PUBLIC_KEY_LENGTH     // token_acc_a
    + PUBLIC_KEY_LENGTH     // token_acc_b
    + PUBLIC_KEY_LENGTH     // token_account_lp
    + U64_LENGTH            // amount_a
    + U64_LENGTH            // amount_b
    + U64_LENGTH            // amount_d
    + U64_LENGTH            // amp
    + U64_LENGTH            // total_lp_amount
    + U64_LENGTH            // min_lp_amount
    + U8_LENGTH            // pool state
    + U8_LENGTH;            // pool fee
}

#[error_code]
pub enum ErrorCode {
    #[msg("error -> Amount or Amp is zero.")]
    AmountZeroError,
    #[msg("error -> Please create Pool.")]
    CreateAccountStepError,
    #[msg("error -> Please create Accounts.")]
    InitLiquidityStepError,
    #[msg("error -> Please Init Liquidity.")]
    InitLpRewardsStepError,
    #[msg("error -> Amount is not same with create pool.")]
    InitLiquidityAmountError,
    #[msg("error -> LpToken is wrong.")]
    LpTokenError,
    #[msg("error -> LpTokenAccount is wrong.")]
    LpTokenAccountError,
    #[msg("error -> Token is wrong.")]
    TokenError,
    #[msg("error -> TokenAccount is wrong&.")]
    TokenAccountError,
    #[msg("error -> Please finish to create pool.")]
    AddLiquidityStepError,
}