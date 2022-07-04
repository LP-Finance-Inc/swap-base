solana-keygen new -o keys/creator.json --force

solana config set --keypair keys/creator.json

solana airdrop 100

solana address
solana balance

export CREATOR_ADDRESS=$(solana address --keypair keys/creator.json)
echo "creator wallet pubkey ->$CREATOR_ADDRESS"
echo '"'$CREATOR_ADDRESS'"'>'keys/creator_pub.json'


solana-keygen new -o keys/user.json --force

solana config set --keypair keys/user.json

solana airdrop 100

solana address
solana balance

export USER_ADDRESS=$(solana address --keypair keys/user.json)
echo "user wallet pubkey ->$USER_ADDRESS"
echo '"'$USER_ADDRESS'"'>'keys/user_pub.json'

solana config set --keypair ~/.config/solana/id.json
